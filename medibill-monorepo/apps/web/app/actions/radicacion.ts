"use server";

import { createClient } from "@/lib/supabase-server";
import { generarPaqueteRadicacion } from "@/lib/empaquetador-radicacion";

// ==========================================
// RADICACIÓN — Server Actions
// ==========================================

/**
 * Genera el paquete ZIP de radicación para una factura.
 * Incluye XML firmado DIAN, JSON RIPS, PDF representación gráfica y manifest.
 */
export async function generarPaqueteDescarga(
  facturaId: string,
): Promise<
  | { success: true; zipBase64: string; nombreArchivo: string }
  | { success: false; error: string }
> {
  try {
    const { zipBase64, nombreArchivo } =
      await generarPaqueteRadicacion(facturaId);
    return { success: true, zipBase64, nombreArchivo };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error generando paquete de radicación";
    return { success: false, error: message };
  }
}

/**
 * Marca una factura como radicada ante la EPS.
 * Transición: descargada → radicada
 * Almacena numero_radicado y fecha_radicacion.
 */
export async function radicarFactura(
  facturaId: string,
  numeroRadicado: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!numeroRadicado || numeroRadicado.trim().length === 0) {
    return { success: false, error: "El número de radicado es obligatorio" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Obtener factura
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("estado, metadata")
    .eq("id", facturaId)
    .eq("user_id", user.id)
    .single();

  if (errFactura || !factura) {
    return { success: false, error: "Factura no encontrada" };
  }

  // 2. Validar estado
  if (factura.estado !== "descargada") {
    return {
      success: false,
      error: `Solo se puede radicar una factura descargada. Estado actual: ${factura.estado}`,
    };
  }

  // 3. Actualizar estado y metadata
  const metadataActual = (factura.metadata || {}) as Record<string, unknown>;
  const nuevaMetadata = {
    ...metadataActual,
    numero_radicado: numeroRadicado.trim(),
    fecha_radicacion: new Date().toISOString(),
  };

  const { error: errUpdate } = await supabase
    .from("facturas")
    .update({
      estado: "radicada",
      fecha_radicacion: new Date().toISOString(),
      metadata: nuevaMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .eq("user_id", user.id);

  if (errUpdate) {
    return { success: false, error: "Error actualizando la factura" };
  }

  return { success: true };
}
