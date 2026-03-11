"use server";

import { createClient } from "@/lib/supabase-server";

/**
 * Genera un código de vinculación MDB-XXXX (TTL 10 min).
 */
export async function generarCodigoVinculacion(): Promise<{
  codigo: string | null;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { codigo: null, error: "No autenticado" };

  // Generar código alfanumérico corto
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sin I,O,0,1 para evitar confusión
  let code = "MDB-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  const expiraAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  // Invalidar códigos anteriores no usados
  await supabase
    .from("telegram_codigos_vinculacion")
    .delete()
    .eq("user_id", user.id)
    .eq("usado", false);

  const { error } = await supabase.from("telegram_codigos_vinculacion").insert({
    codigo: code,
    user_id: user.id,
    expira_at: expiraAt.toISOString(),
    usado: false,
  });

  if (error) return { codigo: null, error: "Error generando código" };

  return { codigo: code };
}

/**
 * Obtiene el estado de vinculación del usuario actual.
 */
export async function obtenerEstadoVinculacion(): Promise<{
  vinculado: boolean;
  telegramUsername: string | null;
  fechaVinculacion: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { vinculado: false, telegramUsername: null, fechaVinculacion: null };

  const { data } = await supabase
    .from("telegram_vinculaciones")
    .select("telegram_username, created_at, activo")
    .eq("user_id", user.id)
    .eq("activo", true)
    .single();

  if (!data) return { vinculado: false, telegramUsername: null, fechaVinculacion: null };

  return {
    vinculado: true,
    telegramUsername: data.telegram_username,
    fechaVinculacion: data.created_at,
  };
}

/**
 * Desvincula la cuenta de Telegram del usuario.
 */
export async function desvincularTelegram(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("telegram_vinculaciones")
    .update({ activo: false })
    .eq("user_id", user.id)
    .eq("activo", true);

  if (error) return { success: false, error: "Error desvinculando" };

  return { success: true };
}
