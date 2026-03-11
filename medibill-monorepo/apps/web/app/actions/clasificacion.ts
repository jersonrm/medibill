"use server";

import { devLog } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import {
  anonimizarTextoMedico,
} from "@/lib/validacion-medica";
import { getContextoOrg, getOrgIdActual } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { verificarLimite, incrementarUso, TRIAL_FULL_RESULTS } from "@/lib/suscripcion";
import { createRateLimiter } from "@/lib/rate-limit";
import { extraerTerminosRAG, clasificarConGemini, validarYEnriquecerResultado } from "@/lib/clasificacion-pipeline";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

// Rate limit: 10 clasificaciones/min por usuario
const clasificacionRateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });

// ==========================================
// ORQUESTADOR — clasificarTextoMedico
// ==========================================
export async function clasificarTextoMedico(texto: string, nombrePaciente?: string, documentoPaciente?: string) {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "clasificar_ia");

    if (await clasificacionRateLimiter.isLimited(ctx.userId)) {
      return { success: false, error: "Demasiadas solicitudes. Intenta de nuevo en un momento." };
    }

    const supabase = await createClient();

    // Verificar límite de clasificaciones IA del plan
    const limiteOk = await verificarLimite(ctx.orgId, "clasificacion");
    if (!limiteOk.permitido) {
      return { success: false, error: limiteOk.mensaje || "Has alcanzado el límite de clasificaciones IA de tu plan" };
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

    // En trial, enmascarar códigos después de las primeras clasificaciones completas
    const { data: subInfo } = await supabase
      .from("suscripciones")
      .select("estado")
      .eq("organizacion_id", ctx.orgId)
      .single();

    if (subInfo?.estado === "trialing") {
      // Contar uso total acumulado (ya se incrementó arriba)
      const { data: usoRows } = await supabase
        .from("uso_mensual")
        .select("clasificaciones_ia")
        .eq("organizacion_id", ctx.orgId);

      const usoTotal = (usoRows ?? []).reduce((acc, r) => acc + (r.clasificaciones_ia ?? 0), 0);

      if (usoTotal > TRIAL_FULL_RESULTS) {
        // Ocultar los códigos exactos — mostrar solo descripciones
        const enmascarado = { ...datosValidados };
        if (enmascarado.diagnosticos) {
          enmascarado.diagnosticos = enmascarado.diagnosticos.map((d: DiagnosticoIA) => ({
            ...d,
            codigo: d.codigo ? d.codigo.slice(0, 2) + "•••" : d.codigo,
            codigo_cie10: d.codigo_cie10 ? d.codigo_cie10.slice(0, 2) + "•••" : d.codigo_cie10,
            alternativas: [],
          }));
        }
        if (enmascarado.procedimientos) {
          enmascarado.procedimientos = enmascarado.procedimientos.map((p: ProcedimientoIA) => ({
            ...p,
            codigo_cups: p.codigo_cups ? p.codigo_cups.slice(0, 2) + "••••" : p.codigo_cups,
            alternativas: [],
          }));
        }
        return {
          success: true,
          datos: enmascarado,
          trial_parcial: true,
          trial_mensaje: `Resultado parcial — activa tu plan desde $99.000/mes para ver los códigos completos. Te quedan ${Math.max(0, 10 - usoTotal)} clasificaciones de prueba.`,
        };
      }

      return {
        success: true,
        datos: datosValidados,
        trial_restante: Math.max(0, 10 - usoTotal),
      };
    }

    return { success: true, datos: datosValidados };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    devLog("Error en clasificarTextoMedico", msg);
    return { success: false, error: "Error al procesar la información médica. Intenta de nuevo." };
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
