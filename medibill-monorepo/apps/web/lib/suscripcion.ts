import { createClient } from "@/lib/supabase-server";
import type {
  ResultadoVerificacion,
  TipoUso,
  FeatureFlag,
  LimitesOrg,
  PlanId,
  EstadoSuscripcion,
} from "@/lib/types/suscripcion";

// Límites absolutos para el período de trial (14 días, NO mensuales)
const TRIAL_LIMITS = {
  clasificacion: 10,
  factura_dian: 0, // No se pueden aprobar facturas DIAN en trial
} as const;

// Clasificaciones con resultado completo en trial (las demás muestran códigos parciales)
export const TRIAL_FULL_RESULTS = 3;

/**
 * Verifica si la organización puede realizar una operación según su plan.
 * Retorna { permitido, restante, mensaje }.
 */
export async function verificarLimite(
  orgId: string,
  tipo: TipoUso
): Promise<ResultadoVerificacion> {
  const supabase = await createClient();

  // 1. Obtener suscripción y plan
  const { data: sub } = await supabase
    .from("suscripciones")
    .select("estado, plan_id, plan:planes!inner(*)")
    .eq("organizacion_id", orgId)
    .single();

  if (!sub || !["active", "trialing"].includes(sub.estado)) {
    return {
      permitido: false,
      restante: 0,
      mensaje: "Tu suscripción no está activa. Actualiza tu plan para continuar.",
    };
  }

  const plan = sub.plan as unknown as {
    max_clasificaciones: number | null;
    max_facturas_dian: number | null;
    nombre: string;
  };

  // ── Trial: límites absolutos (NO mensuales) ──
  if (sub.estado === "trialing") {
    const trialLimite = TRIAL_LIMITS[tipo];

    if (trialLimite === 0) {
      const recurso = tipo === "clasificacion" ? "clasificaciones IA" : "facturas DIAN";
      return {
        permitido: false,
        restante: 0,
        mensaje: `La generación de ${recurso} no está disponible durante el período de prueba. Activa tu plan para continuar.`,
      };
    }

    // Sumar uso total acumulado (todas las filas de uso_mensual, no solo el mes actual)
    const { data: usoTotal } = await supabase
      .from("uso_mensual")
      .select("clasificaciones_ia, facturas_dian")
      .eq("organizacion_id", orgId);

    const usadoTotal = (usoTotal ?? []).reduce(
      (acc, row) => acc + (tipo === "clasificacion" ? (row.clasificaciones_ia ?? 0) : (row.facturas_dian ?? 0)),
      0
    );

    const restante = trialLimite - usadoTotal;

    if (restante <= 0) {
      return {
        permitido: false,
        restante: 0,
        mensaje: `Has alcanzado el límite de ${trialLimite} ${tipo === "clasificacion" ? "clasificaciones IA" : "facturas DIAN"} de tu período de prueba. Activa tu plan para continuar.`,
      };
    }

    return { permitido: true, restante };
  }

  // ── Plan pagado: límites mensuales normales ──
  const limite =
    tipo === "clasificacion"
      ? plan.max_clasificaciones
      : plan.max_facturas_dian;

  // null = ilimitado
  if (limite === null) {
    return { permitido: true, restante: null };
  }

  // 2. Obtener uso del mes actual
  const periodo = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const { data: uso } = await supabase
    .from("uso_mensual")
    .select("clasificaciones_ia, facturas_dian")
    .eq("organizacion_id", orgId)
    .eq("periodo", periodo)
    .single();

  const usado =
    tipo === "clasificacion"
      ? (uso?.clasificaciones_ia ?? 0)
      : (uso?.facturas_dian ?? 0);

  const restante = limite - usado;

  if (restante <= 0) {
    const recurso =
      tipo === "clasificacion" ? "clasificaciones IA" : "facturas DIAN";
    return {
      permitido: false,
      restante: 0,
      mensaje: `Has alcanzado el límite de ${limite} ${recurso} de tu plan ${plan.nombre}. Actualiza tu plan para continuar.`,
    };
  }

  return { permitido: true, restante };
}

/**
 * Incrementa el uso mensual de la organización.
 * Llamar DESPUÉS de completar exitosamente la operación.
 */
export async function incrementarUso(
  orgId: string,
  tipo: TipoUso
): Promise<void> {
  const supabase = await createClient();
  const periodo = new Date().toISOString().slice(0, 7);
  const campo =
    tipo === "clasificacion" ? "clasificaciones_ia" : "facturas_dian";

  await supabase.rpc("incrementar_uso_mensual", {
    p_org_id: orgId,
    p_periodo: periodo,
    p_campo: campo,
  });
}

/**
 * Verifica si la organización tiene acceso a una feature específica del plan.
 */
export async function tieneFeature(
  orgId: string,
  feature: FeatureFlag
): Promise<boolean> {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("suscripciones")
    .select("estado, plan:planes!inner(*)")
    .eq("organizacion_id", orgId)
    .single();

  if (!sub || !["active", "trialing"].includes(sub.estado)) {
    return false;
  }

  const plan = sub.plan as unknown as Record<string, unknown>;
  return !!plan[feature];
}

/**
 * Obtiene los límites y uso actual de la organización.
 * Usado para mostrar en la UI de billing.
 */
export async function obtenerLimitesOrg(orgId: string): Promise<LimitesOrg | null> {
  const supabase = await createClient();

  // Cargar suscripción + plan + uso en paralelo
  const periodo = new Date().toISOString().slice(0, 7);

  const [subResult, usoResult, miembrosResult] = await Promise.all([
    supabase
      .from("suscripciones")
      .select("estado, plan_id, trial_fin, periodo_actual_fin, plan:planes!inner(*)")
      .eq("organizacion_id", orgId)
      .single(),
    supabase
      .from("uso_mensual")
      .select("*")
      .eq("organizacion_id", orgId)
      .eq("periodo", periodo)
      .single(),
    supabase
      .from("usuarios_organizacion")
      .select("id")
      .eq("organizacion_id", orgId)
      .eq("activo", true),
  ]);

  if (!subResult.data) return null;

  const plan = subResult.data.plan as unknown as {
    id: string;
    nombre: string;
    precio_cop_mensual: number;
    max_clasificaciones: number | null;
    max_facturas_dian: number | null;
    max_usuarios: number;
    storage_gb: number;
    ia_sugerencias_glosas: boolean;
    importacion_sabana: boolean;
    importacion_masiva: boolean;
    bot_telegram: boolean;
  };

  const sub = subResult.data as unknown as {
    estado: string;
    plan_id: string;
    trial_fin: string | null;
    periodo_actual_fin: string | null;
    plan: unknown;
  };

  return {
    plan: subResult.data.plan_id as PlanId,
    planNombre: plan.nombre,
    precioCopMensual: plan.precio_cop_mensual,
    estado: subResult.data.estado as EstadoSuscripcion,
    finPeriodo: sub.trial_fin || sub.periodo_actual_fin,
    maxClasificaciones: plan.max_clasificaciones,
    maxFacturasDian: plan.max_facturas_dian,
    maxUsuarios: plan.max_usuarios,
    storageGb: plan.storage_gb,
    features: {
      iaSugerenciasGlosas: plan.ia_sugerencias_glosas,
      importacionSabana: plan.importacion_sabana,
      importacionMasiva: plan.importacion_masiva,
      botTelegram: plan.bot_telegram,
    },
    uso: {
      clasificaciones: usoResult.data?.clasificaciones_ia ?? 0,
      facturasDian: usoResult.data?.facturas_dian ?? 0,
      usuarios: miembrosResult.data?.length ?? 0,
      storageMb: usoResult.data?.storage_usado_mb ?? 0,
    },
  };
}

/**
 * Verifica si la suscripción está activa (active o trialing).
 */
export async function suscripcionActiva(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suscripciones")
    .select("estado")
    .eq("organizacion_id", orgId)
    .single();

  return !!data && ["active", "trialing"].includes(data.estado);
}


