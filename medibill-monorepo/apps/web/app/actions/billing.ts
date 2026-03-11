"use server";

import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { obtenerLimitesOrg, obtenerPlanes } from "@/lib/suscripcion";
import { wompiProvider } from "@/lib/wompi";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Plan, LimitesOrg, HistorialPago } from "@/lib/types/suscripcion";

// ==========================================
// BILLING — Server Actions
// ==========================================

/** Obtiene la información de billing del usuario (plan, uso, historial) */
export async function obtenerInfoBilling(): Promise<{
  limites: LimitesOrg | null;
  historial: HistorialPago[];
  error?: string;
}> {
  try {
    const ctx = await getContextoOrg();

    const supabase = await createClient();
    const [limites, historialResult] = await Promise.all([
      obtenerLimitesOrg(ctx.orgId),
      supabase
        .from("historial_pagos")
        .select("*")
        .eq("organizacion_id", ctx.orgId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    return {
      limites,
      historial: (historialResult.data || []) as HistorialPago[],
    };
  } catch (error: unknown) {
    return {
      limites: null,
      historial: [],
      error: "Error obteniendo datos de suscripción. Intenta de nuevo.",
    };
  }
}

/** Obtiene los planes disponibles para selección */
export async function obtenerPlanesDisponibles(): Promise<Plan[]> {
  return (await obtenerPlanes()) as Plan[];
}

/** Crea una sesión de checkout para pagar la suscripción */
export async function iniciarCheckout(planId: string, periodo: "mensual" | "anual"): Promise<{ redirectUrl?: string; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_billing");

    const supabase = await createClient();

    // Obtener plan
    const { data: plan } = await supabase
      .from("planes")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) return { error: "Plan no encontrado" };

    const monto = periodo === "anual" && plan.precio_cop_anual
      ? plan.precio_cop_anual
      : plan.precio_cop_mensual;

    // Obtener email de billing de la org
    const { data: org } = await supabase
      .from("organizaciones")
      .select("email_billing")
      .eq("id", ctx.orgId)
      .single();

    const periodoStr = new Date().toISOString().slice(0, 7);
    const referencia = `sub_${ctx.orgId}_${periodoStr}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await wompiProvider.crearCheckout({
      orgId: ctx.orgId,
      emailCliente: org?.email_billing || "",
      montoCop: monto,
      descripcion: `Medibill ${plan.nombre} - ${periodo}`,
      referencia,
      returnUrl: `${appUrl}/configuracion/suscripcion?pago=completado`,
    });

    // Actualizar suscripción con el plan seleccionado
    await supabase
      .from("suscripciones")
      .update({
        plan_id: planId,
        periodo,
        estado: "incomplete",
        updated_at: new Date().toISOString(),
      })
      .eq("organizacion_id", ctx.orgId);

    return { redirectUrl: session.redirectUrl };
  } catch (error: unknown) {
    return { error: "Error al iniciar el pago. Intenta de nuevo." };
  }
}

/** Cambia el plan de la suscripción (upgrade/downgrade) */
export async function cambiarPlan(nuevoPlanId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_billing");

    const supabase = await createClient();

    // Validar que el plan existe
    const { data: plan } = await supabase
      .from("planes")
      .select("*")
      .eq("id", nuevoPlanId)
      .single();

    if (!plan) return { success: false, error: "Plan no encontrado" };

    // Si la suscripción está activa, el cambio aplica al siguiente periodo
    // Si está en trial, aplica inmediatamente
    await supabase
      .from("suscripciones")
      .update({
        plan_id: nuevoPlanId,
        updated_at: new Date().toISOString(),
      })
      .eq("organizacion_id", ctx.orgId);

    // Actualizar límites en la org
    await supabase
      .from("organizaciones")
      .update({
        max_usuarios: plan.max_usuarios,
        max_clasificaciones: plan.max_clasificaciones,
        max_facturas_dian: plan.max_facturas_dian,
        storage_gb: plan.storage_gb,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.orgId);

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al cambiar plan. Intenta de nuevo." };
  }
}

/** Cancela la suscripción al final del periodo actual */
export async function cancelarSuscripcion(): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_billing");

    const supabase = await createClient();
    await supabase
      .from("suscripciones")
      .update({
        cancelada_al_final: true,
        updated_at: new Date().toISOString(),
      })
      .eq("organizacion_id", ctx.orgId);

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al cancelar suscripción. Intenta de nuevo." };
  }
}
