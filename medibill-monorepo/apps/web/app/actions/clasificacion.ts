"use server";

import { devLog, devWarn } from "@/lib/logger";
import { getMedibillAI, getRagExtractorAI } from "@/lib/gemini";
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
import { getContextoOrg, getOrgIdActual } from "@/lib/organizacion";
import { verificarLimite, incrementarUso } from "@/lib/suscripcion";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

// ==========================================
// FUNCIONES PURAS — Extraídas de clasificarTextoMedico
// ==========================================

/** RAG: Extrae términos clínicos y augmenta el prompt con candidatos CUPS/CIE-10. */
async function extraerTerminosRAG(textoParaIA: string): Promise<string> {
  try {
    const extractResult = await getRagExtractorAI().generateContent(textoParaIA);
    const extractResponse = await extractResult.response;
    const terminos = JSON.parse(extractResponse.text());

    devLog("RAG — Términos extraídos", JSON.stringify(terminos, null, 2));

    const terminosProcRaw: unknown[] = terminos.terminos_procedimientos || [];
    const terminosProc: TerminoProcedimiento[] = terminosProcRaw.map((t: unknown) => {
      if (typeof t === "string") {
        return { termino: t, categoria: "otro" as const, negado: false };
      }
      const obj = t as Record<string, unknown>;
      return {
        termino: String(obj.termino || ""),
        categoria: (obj.categoria as TerminoProcedimiento["categoria"]) || "otro",
        negado: Boolean(obj.negado),
        futuro: Boolean(obj.futuro),
      };
    });
    const terminosDx: string[] = terminos.terminos_diagnosticos || [];

    if (terminosProc.length > 0 || terminosDx.length > 0) {
      const contexto = await buscarContextoRAG(terminosProc, terminosDx);
      const candidatosTexto = formatearCandidatosParaPrompt(contexto);

      devLog("RAG — candidatos", `${contexto.candidatosCups.length} CUPS + ${contexto.candidatosCie10.length} CIE-10`);

      return `NOTA CLÍNICA:\n${textoParaIA}\n\n${candidatosTexto}`;
    }
  } catch (ragError) {
    devWarn("RAG extraction failed", ragError);
  }
  return textoParaIA;
}

/** Llama a Gemini (medibillAI) con el prompt augmentado y parsea la respuesta JSON. */
async function clasificarConGemini(promptAugmentado: string) {
  const result = await getMedibillAI().generateContent(promptAugmentado);
  const response = await result.response;
  return JSON.parse(response.text());
}

/** Aplica las 5 sub-validaciones, dedup, corrección de Dx asociado, defaults y tarifas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function validarYEnriquecerResultado(datos: any, misTarifas: { codigo_cups: string; tarifa: number }[] | null) {
  // VALIDAR CUPS (Resolución 2706 de 2025)
  if (datos.procedimientos && datos.procedimientos.length > 0) {
    datos.procedimientos = datos.procedimientos.map((p: ProcedimientoIA) => ({
      ...p,
      descripcion_ia_original: p.descripcion,
    }));
    datos.procedimientos = await validarYCorregirCups(datos.procedimientos);
  }

  // DEDUP: Eliminar CUPS que coincida con la consulta
  if (datos.procedimientos && datos.procedimientos.length > 0 && datos.atencion?.codConsultaCups) {
    const codConsulta = String(datos.atencion.codConsultaCups).replace(/[.\s-]/g, "");
    const antes = datos.procedimientos.length;
    datos.procedimientos = datos.procedimientos.filter(
      (p: ProcedimientoIA) => String(p.codigo_cups).replace(/[.\s-]/g, "") !== codConsulta
    );
    if (datos.procedimientos.length < antes) {
      devLog("Dedup consulta", `Eliminado CUPS ${codConsulta} de procedimientos (era consulta)`);
    }
  }

  // VALIDAR COHERENCIA ANATÓMICA
  if (datos.procedimientos && datos.procedimientos.length > 0) {
    datos.procedimientos = await validarCoherenciaAnatomica(datos.procedimientos);
  }

  // VALIDAR CIE-10 (CIE-10 Colombia 2026)
  if (datos.diagnosticos && datos.diagnosticos.length > 0) {
    datos.diagnosticos = await validarYCorregirCie10(datos.diagnosticos);
  }

  // ORDENAR DIAGNÓSTICOS: principal → relacionado → causa_externa
  if (datos.diagnosticos && datos.diagnosticos.length > 0) {
    datos.diagnosticos = ordenarDiagnosticosPorRol(datos.diagnosticos);
  }

  // VALIDAR diagnostico_asociado contra lista de Dx validados
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

  // ASEGURAR tipo_servicio: defaults a "consulta"
  if (datos.atencion && !datos.atencion.tipo_servicio) {
    datos.atencion.tipo_servicio = "consulta";
  }

  // CRUCE DE DATOS: Sobreescribir tarifas con las del usuario
  if (datos.atencion && misTarifas) {
    const miTarifaConsulta = misTarifas.find(t => t.codigo_cups === "890201");
    if (miTarifaConsulta) {
      datos.atencion.valor_consulta = miTarifaConsulta.tarifa;
    }
  }

  if (datos.procedimientos && misTarifas) {
    datos.procedimientos = datos.procedimientos.map((proc: ProcedimientoIA) => {
      const coincidencia = misTarifas.find(t => t.codigo_cups === proc.codigo_cups);
      return coincidencia ? { ...proc, valor_procedimiento: coincidencia.tarifa } : proc;
    });
  }

  return datos;
}

// ==========================================
// ORQUESTADOR — clasificarTextoMedico
// ==========================================
export async function clasificarTextoMedico(texto: string, nombrePaciente?: string, documentoPaciente?: string) {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    // Verificar límite de clasificaciones IA del plan
    const limiteOk = await verificarLimite(ctx.orgId, "clasificacion");
    if (!limiteOk.permitido) {
      return { exito: false, error: limiteOk.mensaje || "Has alcanzado el límite de clasificaciones IA de tu plan" };
    }

    const { data: misTarifas } = await supabase
      .from('servicios_medico')
      .select('codigo_cups, tarifa')
      .eq('user_id', ctx.userId);

    const textoParaIA = anonimizarTextoMedico(texto, nombrePaciente, documentoPaciente);
    const promptAugmentado = await extraerTerminosRAG(textoParaIA);
    const datos = await clasificarConGemini(promptAugmentado);
    const datosValidados = await validarYEnriquecerResultado(datos, misTarifas);

    devLog("clasificarTextoMedico:resultado", JSON.stringify({
      diagnosticos: datosValidados.diagnosticos?.length || 0,
      procedimientos: datosValidados.procedimientos?.length || 0,
      dxPrincipal: datosValidados.diagnosticos?.find((d: DiagnosticoIA) => d.rol === "principal")?.codigo_cie10,
      cupsDetectados: datosValidados.procedimientos?.map((p: ProcedimientoIA) => p.codigo_cups),
      tipoServicio: datosValidados.atencion?.tipo_servicio,
    }));

    if (ctx.userId) {
      await supabase.from("auditorias_rips").insert({
        user_id: ctx.userId,
        organizacion_id: ctx.orgId,
        nombre_paciente: nombrePaciente || "Paciente Anónimo",
        documento_paciente: documentoPaciente || "Sin Documento",
        nota_original: textoParaIA,
        resultado_ia: datosValidados,
      });
      await incrementarUso(ctx.orgId, "clasificacion");
    }

    return { exito: true, datos: datosValidados };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    devLog("Error en clasificarTextoMedico", msg);
    return { exito: false, error: `Error al procesar la información médica: ${msg}` };
  }
}

export async function obtenerHistorialAuditorias() {
  noStore(); 
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  revalidatePath("/"); 

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("organizacion_id", orgId)
    .order("creado_en", { ascending: false }) 
    .limit(5);

  if (error) return [];
  return data;
}

export async function buscarPacientePorCedula(cedula: string) {
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  if (!cedula) return null;

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("organizacion_id", orgId)
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
