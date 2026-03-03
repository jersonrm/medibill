"use server";

import { devLog, devWarn } from "@/lib/logger";
import { medibillAI, ragExtractorAI } from "@/lib/gemini";
import { createClient } from "@/lib/supabase-server";
import { buscarContextoRAG, formatearCandidatosParaPrompt, type TerminoProcedimiento } from "@/lib/rag-service";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import {
  anonimizarTextoMedico,
  validarYCorregirCups,
  validarYCorregirCie10,
  validarCoherenciaAnatomica,
  ordenarDiagnosticosPorRol,
} from "@/lib/validacion-medica";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

// ==========================================
// PROCESAMIENTO CON INTELIGENCIA ARTIFICIAL
// ==========================================
export async function clasificarTextoMedico(texto: string, nombrePaciente?: string, documentoPaciente?: string) {
  try {
    const supabase = await createClient();
    
    // 1. Obtener las tarifas personalizadas del usuario
    const { data: misTarifas } = await supabase
      .from('servicios_medico')
      .select('codigo_cups, tarifa');

    const textoParaIA = anonimizarTextoMedico(texto, nombrePaciente, documentoPaciente);

    // 2. RAG: Extraer términos clínicos con ragExtractorAI
    let promptAugmentado = textoParaIA;
    try {
      const extractResult = await ragExtractorAI.generateContent(textoParaIA);
      const extractResponse = await extractResult.response;
      const terminos = JSON.parse(extractResponse.text());

      devLog("RAG — Términos extraídos", JSON.stringify(terminos, null, 2));

      // v2: Los términos de procedimientos ahora son objetos {termino, categoria, negado}
      const terminosProcRaw: any[] = terminos.terminos_procedimientos || [];
      const terminosProc: TerminoProcedimiento[] = terminosProcRaw.map((t: any) => {
        if (typeof t === "string") {
          // Retrocompatibilidad: si llegan strings planos, asignar categoría "otro"
          return { termino: t, categoria: "otro" as const, negado: false };
        }
        return { 
          termino: String(t.termino || ""), 
          categoria: t.categoria || "otro",
          negado: Boolean(t.negado),
        };
      });
      const terminosDx: string[] = terminos.terminos_diagnosticos || [];

      if (terminosProc.length > 0 || terminosDx.length > 0) {
        const contexto = await buscarContextoRAG(terminosProc, terminosDx);
        const candidatosTexto = formatearCandidatosParaPrompt(contexto);

        devLog("RAG — candidatos", `${contexto.candidatosCups.length} CUPS + ${contexto.candidatosCie10.length} CIE-10`);

        promptAugmentado = `NOTA CLÍNICA:\n${textoParaIA}\n\n${candidatosTexto}`;
      }
    } catch (ragError) {
      devWarn("RAG extraction failed", ragError);
      // Continuar sin RAG — la IA generará desde su conocimiento
    }

    // 3. Llamamos a medibillAI con el prompt augmentado (nota + candidatos RAG)
    const result = await medibillAI.generateContent(promptAugmentado);
    const response = await result.response;
    const datos = JSON.parse(response.text());

    // 2.5. VALIDAR CUPS: Cruzar códigos generados por la IA contra la DB (Resolución 2706 de 2025)
    if (datos.procedimientos && datos.procedimientos.length > 0) {
      // Preservar descripción original de la IA ANTES de validación (para validación anatómica)
      datos.procedimientos = datos.procedimientos.map((p: ProcedimientoIA) => ({
        ...p,
        descripcion_ia_original: p.descripcion,
      }));
      datos.procedimientos = await validarYCorregirCups(datos.procedimientos);
    }

    // 2.5b. VALIDAR COHERENCIA ANATÓMICA: Verificar que la región del CUPS coincida con la nota
    if (datos.procedimientos && datos.procedimientos.length > 0) {
      datos.procedimientos = await validarCoherenciaAnatomica(datos.procedimientos);
    }

    // 2.6. VALIDAR CIE-10: Cruzar diagnósticos generados por la IA contra la DB (CIE-10 Colombia 2026)
    if (datos.diagnosticos && datos.diagnosticos.length > 0) {
      datos.diagnosticos = await validarYCorregirCie10(datos.diagnosticos);
    }

    // 2.7. ORDENAR DIAGNÓSTICOS: principal → relacionado → causa_externa
    if (datos.diagnosticos && datos.diagnosticos.length > 0) {
      datos.diagnosticos = ordenarDiagnosticosPorRol(datos.diagnosticos);
    }

    // 2.8. VALIDAR diagnostico_asociado de cada procedimiento contra lista de Dx validados
    if (datos.procedimientos?.length > 0 && datos.diagnosticos?.length > 0) {
      const codigosDxValidos = new Set(
        datos.diagnosticos.map((d: DiagnosticoIA) => 
          String(d.codigo_cie10 || "").replace(/[.\s-]/g, "").toUpperCase()
        )
      );
      const dxPrincipalCodigo = datos.diagnosticos[0]?.codigo_cie10?.replace(/[.\s-]/g, "").toUpperCase() || "";

      datos.procedimientos = datos.procedimientos.map((proc: ProcedimientoIA) => {
        const dxAsoc = String(proc.diagnostico_asociado || "").replace(/[.\s-]/g, "").toUpperCase();
        if (dxAsoc && !codigosDxValidos.has(dxAsoc)) {
          devLog("Dx asociado corregido", `proc ${proc.codigo_cups}: dxAsoc no válido → corrigiendo a Dx principal`);
          return {
            ...proc,
            diagnostico_asociado: dxPrincipalCodigo,
            diagnostico_asociado_corregido: true,
          };
        }
        return proc;
      });
    }

    // ═══ DEBUG IA ═══
    devLog("clasificarTextoMedico", "═══ AI DEBUG ═══");
    devLog("Atención IA", JSON.stringify(datos.atencion, null, 2));
    devLog("Diagnósticos (post-validación)", `${datos.diagnosticos?.length || 0} diagnósticos`);
    datos.diagnosticos?.forEach((d: DiagnosticoIA, i: number) => {
      devLog("Dx", `[${i}] ${d.codigo_cie10} | rol: ${d.rol} | validado: ${d.cie10_validado} | corregido: ${d.cie10_corregido || false}`);
      devLog("Dx desc", d.descripcion?.substring(0, 60));
      if (d.alternativas?.length) {
        d.alternativas.forEach((a: { codigo: string; descripcion: string }) => devLog("Dx alt", `${a.codigo} ${a.descripcion?.substring(0, 50)}`));
      }
    });
    devLog("Procedimientos (post-validación)", `${datos.procedimientos?.length || 0} procedimientos`);
    datos.procedimientos?.forEach((p: ProcedimientoIA, i: number) => {
      devLog("Proc", `[${i}] ${p.codigo_cups} | validado: ${p.cups_validado} | corregido: ${p.cups_corregido || false} | dxAsociado: ${p.diagnostico_asociado || "N/A"}`);
      devLog("Proc desc", p.descripcion?.substring(0, 60));
      if (p.alternativas?.length) {
        p.alternativas.forEach((a: { codigo: string; descripcion: string }) => devLog("Proc alt", `${a.codigo} ${a.descripcion?.substring(0, 50)}`));
      }
    });
    devLog("clasificarTextoMedico", "═══ FIN DEBUG ═══");

    // 2.8. ASEGURAR tipo_servicio: defaults a "consulta" si la IA no lo generó
    if (datos.atencion && !datos.atencion.tipo_servicio) {
      datos.atencion.tipo_servicio = "consulta";
    }

    // 3. CRUCE DE DATOS: Si el CUPS analizado está en mis tarifas, sobreescribir el valor
    if (datos.atencion && misTarifas) {
      // Por defecto la IA clasifica la consulta como 890201
      const miTarifaConsulta = misTarifas.find(t => t.codigo_cups === "890201");
      if (miTarifaConsulta) {
        datos.atencion.valor_consulta = miTarifaConsulta.tarifa;
      }
    }

    // También para procedimientos extra si los hubiera con precio
    if (datos.procedimientos && misTarifas) {
      datos.procedimientos = datos.procedimientos.map((proc: ProcedimientoIA) => {
        const coincidencia = misTarifas.find(t => t.codigo_cups === proc.codigo_cups);
        return coincidencia ? { ...proc, valor_procedimiento: coincidencia.tarifa } : proc;
      });
    }

    // 4. Guardar en el historial (Auditoría)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("auditorias_rips").insert({
        user_id: user.id,
        nombre_paciente: nombrePaciente || "Paciente Anónimo",
        documento_paciente: documentoPaciente || "Sin Documento",
        nota_original: texto,
        resultado_ia: datos,
      });
    }

    return { exito: true, datos };
  } catch (error: any) {
    console.error("Error en clasificarTextoMedico:", error?.message || "error desconocido");
    console.error("Stack:", error?.stack);
    return { exito: false, error: `Error al procesar la información médica: ${error?.message || String(error)}` };
  }
}

export async function obtenerHistorialAuditorias() {
  noStore(); 
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  revalidatePath("/"); 

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .order("creado_en", { ascending: false }) 
    .limit(5);

  if (error) return [];
  return data;
}

export async function buscarPacientePorCedula(cedula: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !cedula) return null;

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .eq("documento_paciente", cedula)
    .order("creado_en", { ascending: false });

  if (error) return null;

  if (data && data.length > 0) {
    return {
      nombre: data[0].nombre_paciente, 
      historial: data 
    };
  }

  return null; 
}
