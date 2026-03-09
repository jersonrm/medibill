"use server";

import { requireUser } from "@/lib/supabase-server";

/**
 * Programa la eliminación de la cuenta del usuario actual.
 * Establece `eliminacion_programada_at` = NOW() en la tabla perfiles.
 * Después de 7 días, un cron purga los datos.
 */
export async function programarEliminacionCuenta(): Promise<{ success: boolean; error?: string }> {
  const { user, supabase } = await requireUser();

  const { error } = await supabase
    .from("perfiles")
    .update({ eliminacion_programada_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Cancela la eliminación programada de la cuenta.
 * Restablece `eliminacion_programada_at` a NULL.
 */
export async function cancelarEliminacionCuenta(): Promise<{ success: boolean; error?: string }> {
  const { user, supabase } = await requireUser();

  const { error } = await supabase
    .from("perfiles")
    .update({ eliminacion_programada_at: null })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Obtiene el estado de eliminación programada.
 */
export async function estadoEliminacionCuenta(): Promise<{ programada: boolean; fecha?: string }> {
  const { user, supabase } = await requireUser();

  const { data } = await supabase
    .from("perfiles")
    .select("eliminacion_programada_at")
    .eq("user_id", user.id)
    .single();

  if (data?.eliminacion_programada_at) {
    return { programada: true, fecha: data.eliminacion_programada_at };
  }
  return { programada: false };
}
