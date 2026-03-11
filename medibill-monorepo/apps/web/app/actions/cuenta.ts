"use server";

import { requireUser } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";

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

  if (error) return { success: false, error: safeError("programarEliminacionCuenta", error) };
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

  if (error) return { success: false, error: safeError("cancelarEliminacionCuenta", error) };
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

/**
 * Exporta todos los datos del usuario (Habeas Data — Ley 1581/2012).
 * Retorna un JSON con perfil, facturas, pacientes, clasificaciones y pagos.
 */
export async function exportarDatosUsuario(): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const { user, supabase } = await requireUser();

  try {
    const [perfil, facturas, pacientes, clasificaciones, pagos] = await Promise.all([
      supabase.from("perfiles").select("*").eq("user_id", user.id).single(),
      supabase.from("facturas").select("id, num_factura, fecha_expedicion, estado, valor_total, subtotal, copago, cuota_moderadora, descuentos, nit_erp, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pacientes").select("id, nombre, tipo_documento, numero_documento, fecha_nacimiento, sexo, eps_nombre, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("auditorias_rips").select("id, texto_original, resultado_json, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("historial_pagos").select("id, monto, estado, metodo_pago, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const exportData = {
      exportado_en: new Date().toISOString(),
      usuario: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      perfil: perfil.data ? (() => {
        const { user_id, ...rest } = perfil.data;
        return rest;
      })() : null,
      facturas: facturas.data ?? [],
      pacientes: pacientes.data ?? [],
      clasificaciones: clasificaciones.data ?? [],
      pagos: pagos.data ?? [],
    };

    return { success: true, data: exportData };
  } catch (e) {
    await devError("exportarDatosUsuario", e);
    return { success: false, error: "Error al exportar datos. Intenta de nuevo." };
  }
}
