"use server";

import { createClient } from "@/lib/supabase-server";

/**
 * Obtiene todos los planes disponibles.
 */
export async function obtenerPlanes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planes")
    .select("*")
    .eq("activo", true)
    .order("precio_cop_mensual");
  return data ?? [];
}

/**
 * Obtiene las features y límites del plan del usuario autenticado.
 * Usado por Sidebar y páginas para gating de UI.
 */
export async function obtenerFeaturesUsuario(): Promise<{
  orgId: string;
  rol: string;
  features: {
    iaSugerenciasGlosas: boolean;
    importacionSabana: boolean;
    importacionMasiva: boolean;
    botTelegram: boolean;
  };
  maxUsuarios: number;
} | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memb } = await supabase
    .from("usuarios_organizacion")
    .select("organizacion_id, rol")
    .eq("user_id", user.id)
    .eq("activo", true)
    .limit(1)
    .single();

  if (!memb) return null;

  const { data: sub } = await supabase
    .from("suscripciones")
    .select("estado, plan:planes!inner(ia_sugerencias_glosas, importacion_sabana, importacion_masiva, bot_telegram, max_usuarios)")
    .eq("organizacion_id", memb.organizacion_id)
    .single();

  if (!sub || !["active", "trialing"].includes(sub.estado)) {
    return {
      orgId: memb.organizacion_id,
      rol: memb.rol,
      features: { iaSugerenciasGlosas: false, importacionSabana: false, importacionMasiva: false, botTelegram: false },
      maxUsuarios: 1,
    };
  }

  const plan = sub.plan as unknown as {
    ia_sugerencias_glosas: boolean;
    importacion_sabana: boolean;
    importacion_masiva: boolean;
    bot_telegram: boolean;
    max_usuarios: number;
  };

  return {
    orgId: memb.organizacion_id,
    rol: memb.rol,
    features: {
      iaSugerenciasGlosas: plan.ia_sugerencias_glosas,
      importacionSabana: plan.importacion_sabana,
      importacionMasiva: plan.importacion_masiva,
      botTelegram: plan.bot_telegram,
    },
    maxUsuarios: plan.max_usuarios,
  };
}
