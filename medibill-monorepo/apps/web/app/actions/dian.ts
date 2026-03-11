"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { mapFacturaToMatiasJson } from "@/lib/providers/matias-mapper";
import * as matiasClient from "@/lib/providers/matias-client";
import { obtenerContextoFacturacion } from "@/lib/services/contexto-facturacion";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { createRateLimiter } from "@/lib/rate-limit";
import type { EstadoDian } from "@/lib/types/factura";

// Rate limit: 5 envíos DIAN/min por usuario
const dianRateLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });

// ==========================================
// DIAN — Server Actions (Matias API)
// ==========================================

/**
 * Envía una factura a la DIAN a través de Matias API.
 * Solo disponible para facturas en estado "aprobada" sin envío previo.
 */
export async function enviarFacturaDian(
  facturaId: string,
): Promise<{ success: true; cufe: string; trackId: string } | { success: false; error: string }> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");

  if (await dianRateLimiter.isLimited(ctx.userId)) {
    return { success: false, error: "Demasiadas solicitudes. Intenta de nuevo en un momento." };
  }

  const supabase = await createClient();

  // 1. Obtener factura con paciente
  const { data: facturaRow, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (errFactura || !facturaRow) {
    return { success: false, error: "Factura no encontrada" };
  }

  if (facturaRow.estado !== "aprobada" && facturaRow.estado !== "descargada") {
    return { success: false, error: `La factura debe estar aprobada para enviar a la DIAN. Estado actual: ${facturaRow.estado}` };
  }

  if (facturaRow.estado_dian === "enviada" || facturaRow.estado_dian === "aceptada") {
    return { success: false, error: `La factura ya fue enviada a la DIAN. Estado DIAN: ${facturaRow.estado_dian}` };
  }

  // 2. Obtener contexto (perfil + resolución + mapeos)
  const ctxFact = await obtenerContextoFacturacion(supabase, ctx.userId, facturaRow);
  if (!ctxFact.ok) return { success: false, error: ctxFact.error };

  const { factura, perfilInput, resolucionInput, clienteInput, pacienteInput } = ctxFact.data;

  // 2. Mapear a formato Matias JSON
  const matiasJson = mapFacturaToMatiasJson(factura, perfilInput, resolucionInput, clienteInput, pacienteInput);

  // 6. Enviar a Matias API
  try {
    const respuesta = await matiasClient.enviarFactura(matiasJson);

    if (!respuesta.success || !respuesta.document) {
      const errorMsg = respuesta.errors
        ? Object.entries(respuesta.errors).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ")
        : respuesta.message || "Error desconocido";
      return { success: false, error: `Error DIAN: ${errorMsg}` };
    }

    // 7. Actualizar factura con datos DIAN
    const { error: errUpdate } = await supabase
      .from("facturas")
      .update({
        cufe: respuesta.document.document_key,
        estado_dian: "enviada" as EstadoDian,
        track_id_dian: respuesta.document.document_key,
        fecha_envio_dian: new Date().toISOString(),
        respuesta_dian_json: respuesta.document as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("organizacion_id", ctx.orgId);

    if (errUpdate) {
      devError("Error actualizando factura post-DIAN", errUpdate);
    }

    return {
      success: true,
      cufe: respuesta.document.document_key,
      trackId: respuesta.document.document_key,
      ...(errUpdate && { warning: "Factura enviada a DIAN exitosamente, pero falló la actualización local. Verifique manualmente." }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de conexión con Matias API";
    return { success: false, error: message };
  }
}

/**
 * Consulta el estado de una factura en la DIAN a través de Matias API.
 */
export async function consultarEstadoDian(
  facturaId: string,
): Promise<{ success: true; estadoDian: EstadoDian; mensaje: string } | { success: false; error: string }> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");
  const supabase = await createClient();

  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("track_id_dian, estado_dian")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (errFactura || !factura) {
    return { success: false, error: "Factura no encontrada" };
  }

  if (!factura.track_id_dian) {
    return { success: false, error: "La factura no ha sido enviada a la DIAN" };
  }

  try {
    const status = await matiasClient.consultarEstado(factura.track_id_dian);

    let nuevoEstado: EstadoDian = "enviada";
    if (status.document?.is_valid === true) {
      nuevoEstado = "aceptada";
    } else if (status.document?.is_valid === false) {
      nuevoEstado = "rechazada";
    }

    // Actualizar estado en BD
    await supabase
      .from("facturas")
      .update({
        estado_dian: nuevoEstado,
        respuesta_dian_json: status.document as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("organizacion_id", ctx.orgId);

    return {
      success: true,
      estadoDian: nuevoEstado,
      mensaje: status.document?.status || status.message || "Estado consultado",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error consultando estado en Matias API";
    return { success: false, error: message };
  }
}

/**
 * Descarga el XML firmado por la DIAN (vía Matias API).
 */
export async function descargarXmlFirmado(
  facturaId: string,
): Promise<{ success: true; xml: string } | { success: false; error: string }> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("track_id_dian, estado_dian")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (!factura?.track_id_dian) {
    return { success: false, error: "La factura no ha sido enviada a la DIAN" };
  }

  try {
    const xml = await matiasClient.descargarXml(factura.track_id_dian);
    return { success: true, xml };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error descargando XML";
    return { success: false, error: message };
  }
}

/**
 * Descarga el PDF (representación gráfica) de la DIAN (vía Matias API).
 * Retorna los bytes en base64 para poder enviarlos al cliente.
 */
export async function descargarPdfDian(
  facturaId: string,
): Promise<{ success: true; pdfBase64: string } | { success: false; error: string }> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("track_id_dian, estado_dian")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (!factura?.track_id_dian) {
    return { success: false, error: "La factura no ha sido enviada a la DIAN" };
  }

  try {
    const buffer = await matiasClient.descargarPdf(factura.track_id_dian);
    const base64 = Buffer.from(buffer).toString("base64");
    return { success: true, pdfBase64: base64 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error descargando PDF";
    return { success: false, error: message };
  }
}
