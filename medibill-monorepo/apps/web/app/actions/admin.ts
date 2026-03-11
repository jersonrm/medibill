"use server";

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createServiceClient } from "@/lib/supabase-server";
import { safeError } from "@/lib/safe-error";

function getServiceClient() {
  return createServiceClient();
}

// ─── Métricas globales ─────────────────────────────────────────────

export interface MetricasGlobales {
  totalOrganizaciones: number;
  orgActivas: number;
  orgTrial: number;
  orgCanceladas: number;
  revenueMensualEstimado: number;
  clasificacionesMes: number;
  facturasDianMes: number;
}

export async function obtenerMetricasGlobales(): Promise<MetricasGlobales> {
  await requirePlatformAdmin();
  const db = getServiceClient();

  const periodo = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const [orgsResult, subsResult, usoResult, planesResult] = await Promise.all([
    db.from("organizaciones").select("id", { count: "exact", head: true }),
    db.from("suscripciones").select("estado, plan_id"),
    db.from("uso_mensual").select("clasificaciones_ia, facturas_dian").eq("periodo", periodo),
    db.from("planes").select("id, precio_cop_mensual"),
  ]);

  const subs = subsResult.data || [];
  const planes = new Map((planesResult.data || []).map((p) => [p.id, p.precio_cop_mensual]));

  const activas = subs.filter((s) => s.estado === "active").length;
  const trial = subs.filter((s) => s.estado === "trialing").length;
  const canceladas = subs.filter((s) => s.estado === "canceled").length;

  const revenue = subs
    .filter((s) => s.estado === "active")
    .reduce((acc, s) => acc + (planes.get(s.plan_id) || 0), 0);

  const uso = usoResult.data || [];
  const clasificaciones = uso.reduce((a, u) => a + (u.clasificaciones_ia || 0), 0);
  const facturas = uso.reduce((a, u) => a + (u.facturas_dian || 0), 0);

  return {
    totalOrganizaciones: orgsResult.count || 0,
    orgActivas: activas,
    orgTrial: trial,
    orgCanceladas: canceladas,
    revenueMensualEstimado: revenue,
    clasificacionesMes: clasificaciones,
    facturasDianMes: facturas,
  };
}

// ─── Listar organizaciones ─────────────────────────────────────────

export interface OrgResumen {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: string;
  created_at: string;
  plan_id: string | null;
  estado_suscripcion: string | null;
  usuarios_activos: number;
}

export async function listarOrganizaciones(): Promise<OrgResumen[]> {
  await requirePlatformAdmin();
  const db = getServiceClient();

  const { data: orgs } = await db
    .from("organizaciones")
    .select("id, nombre, nit, tipo, created_at")
    .order("created_at", { ascending: false });

  if (!orgs || orgs.length === 0) return [];

  const orgIds = orgs.map((o) => o.id);

  const [subsResult, membersResult] = await Promise.all([
    db.from("suscripciones").select("organizacion_id, plan_id, estado").in("organizacion_id", orgIds),
    db.from("usuarios_organizacion").select("organizacion_id").eq("activo", true).in("organizacion_id", orgIds),
  ]);

  const subsMap = new Map(
    (subsResult.data || []).map((s) => [s.organizacion_id, { plan_id: s.plan_id, estado: s.estado }]),
  );

  const memberCounts = new Map<string, number>();
  for (const m of membersResult.data || []) {
    memberCounts.set(m.organizacion_id, (memberCounts.get(m.organizacion_id) || 0) + 1);
  }

  return orgs.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    nit: o.nit,
    tipo: o.tipo,
    created_at: o.created_at,
    plan_id: subsMap.get(o.id)?.plan_id || null,
    estado_suscripcion: subsMap.get(o.id)?.estado || null,
    usuarios_activos: memberCounts.get(o.id) || 0,
  }));
}

// ─── Detalle de organización ───────────────────────────────────────

export interface OrgDetalle {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: string;
  email_billing: string;
  created_at: string;
  suscripcion: {
    plan_id: string;
    estado: string;
    periodo: string;
    trial_fin: string | null;
    periodo_actual_fin: string | null;
  } | null;
  miembros: {
    user_id: string;
    rol: string;
    activo: boolean;
    invitado_email: string | null;
  }[];
  uso_mensual: {
    clasificaciones_ia: number;
    facturas_dian: number;
  } | null;
}

export async function detalleOrganizacion(orgId: string): Promise<OrgDetalle | null> {
  await requirePlatformAdmin();
  const db = getServiceClient();

  const { data: org } = await db
    .from("organizaciones")
    .select("id, nombre, nit, tipo, email_billing, created_at")
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const periodo = new Date().toISOString().slice(0, 7);

  const [subResult, membersResult, usoResult] = await Promise.all([
    db.from("suscripciones").select("plan_id, estado, periodo, trial_fin, periodo_actual_fin").eq("organizacion_id", orgId).single(),
    db.from("usuarios_organizacion").select("user_id, rol, activo, invitado_email").eq("organizacion_id", orgId),
    db.from("uso_mensual").select("clasificaciones_ia, facturas_dian").eq("organizacion_id", orgId).eq("periodo", periodo).single(),
  ]);

  return {
    ...org,
    suscripcion: subResult.data || null,
    miembros: membersResult.data || [],
    uso_mensual: usoResult.data || null,
  };
}

// ─── Cambiar plan de una organización ──────────────────────────────

export async function cambiarPlanOrg(
  orgId: string,
  planId: string,
): Promise<{ success: boolean; error?: string }> {
  await requirePlatformAdmin();
  const db = getServiceClient();

  const { data: plan } = await db.from("planes").select("id, max_usuarios, max_clasificaciones, max_facturas_dian, storage_gb").eq("id", planId).single();
  if (!plan) return { success: false, error: "Plan no encontrado" };

  const [subUpdate, orgUpdate] = await Promise.all([
    db.from("suscripciones").update({ plan_id: planId, updated_at: new Date().toISOString() }).eq("organizacion_id", orgId),
    db.from("organizaciones").update({
      max_usuarios: plan.max_usuarios,
      max_clasificaciones: plan.max_clasificaciones,
      max_facturas_dian: plan.max_facturas_dian,
      storage_gb: plan.storage_gb,
      updated_at: new Date().toISOString(),
    }).eq("id", orgId),
  ]);

  if (subUpdate.error) return { success: false, error: safeError("cambiarPlanOrg", subUpdate.error) };
  if (orgUpdate.error) return { success: false, error: safeError("cambiarPlanOrg", orgUpdate.error) };

  return { success: true };
}

// ─── Suspender / Activar organización ──────────────────────────────

export async function suspenderOrg(
  orgId: string,
  suspender: boolean,
): Promise<{ success: boolean; error?: string }> {
  await requirePlatformAdmin();
  const db = getServiceClient();

  const nuevoEstado = suspender ? "paused" : "active";

  const { error } = await db
    .from("suscripciones")
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq("organizacion_id", orgId);

  if (error) return { success: false, error: safeError("suspenderOrg", error) };
  return { success: true };
}
