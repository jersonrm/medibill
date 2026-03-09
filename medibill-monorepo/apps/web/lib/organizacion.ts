"use server";

import { createClient } from "@/lib/supabase-server";
import type { ContextoOrg, RolOrganizacion, TipoOrganizacion } from "@/lib/types/suscripcion";

/**
 * Obtiene el contexto completo de organización del usuario autenticado.
 * Incluye: userId, orgId, rol, suscripción.
 * Usado en TODAS las server actions como reemplazo de `supabase.auth.getUser()` solo.
 */
export async function getContextoOrg(): Promise<ContextoOrg> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: membership, error } = await supabase
    .from("usuarios_organizacion")
    .select(`
      rol,
      organizacion:organizaciones!inner(
        id,
        nombre,
        tipo
      )
    `)
    .eq("user_id", user.id)
    .eq("activo", true)
    .limit(1)
    .single();

  if (error || !membership) {
    throw new Error("Usuario sin organización asignada");
  }

  // Cargar suscripción de la org
  const org = membership.organizacion as unknown as {
    id: string;
    nombre: string;
    tipo: TipoOrganizacion;
  };

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("plan_id, estado, trial_fin, periodo_actual_fin")
    .eq("organizacion_id", org.id)
    .single();

  return {
    userId: user.id,
    orgId: org.id,
    orgNombre: org.nombre,
    orgTipo: org.tipo,
    rol: membership.rol as RolOrganizacion,
    suscripcion: suscripcion
      ? {
          plan_id: suscripcion.plan_id as ContextoOrg["suscripcion"] extends null ? never : NonNullable<ContextoOrg["suscripcion"]>["plan_id"],
          estado: suscripcion.estado as NonNullable<ContextoOrg["suscripcion"]>["estado"],
          trial_fin: suscripcion.trial_fin,
          periodo_actual_fin: suscripcion.periodo_actual_fin,
        }
      : null,
  };
}

/**
 * Versión simplificada que retorna solo el orgId.
 * Para uso rápido en queries que solo necesitan filtrar por org.
 */
export async function getOrgIdActual(): Promise<string> {
  const ctx = await getContextoOrg();
  return ctx.orgId;
}

/**
 * Crea una organización nueva + membership owner + suscripción trial.
 * Llamada durante el onboarding.
 */
export async function crearOrganizacion(params: {
  nombre: string;
  tipo: TipoOrganizacion;
  nit?: string;
  emailBilling: string;
  userId: string;
}): Promise<{ orgId: string; error?: string }> {
  const supabase = await createClient();

  const planDefault = params.tipo === "independiente" ? "starter" : "clinica";

  const maxUsuarios = params.tipo === "independiente" ? 1 : 20;

  // 1. Crear organización
  const { data: org, error: orgError } = await supabase
    .from("organizaciones")
    .insert({
      nombre: params.nombre,
      nit: params.nit || null,
      tipo: params.tipo,
      email_billing: params.emailBilling,
      max_usuarios: maxUsuarios,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    return { orgId: "", error: orgError?.message || "Error creando organización" };
  }

  // 2. Vincular usuario como owner
  const { error: memberError } = await supabase
    .from("usuarios_organizacion")
    .insert({
      organizacion_id: org.id,
      user_id: params.userId,
      rol: "owner",
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    return { orgId: "", error: memberError.message };
  }

  // 3. Crear suscripción trial
  const ahora = new Date();
  const trialFin = new Date(ahora);
  trialFin.setDate(trialFin.getDate() + 14);

  const { error: subError } = await supabase
    .from("suscripciones")
    .insert({
      organizacion_id: org.id,
      plan_id: planDefault,
      estado: "trialing",
      trial_inicio: ahora.toISOString(),
      trial_fin: trialFin.toISOString(),
    });

  if (subError) {
    return { orgId: "", error: subError.message };
  }

  return { orgId: org.id };
}
