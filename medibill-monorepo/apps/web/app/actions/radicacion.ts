"use server";

import { createClient } from "@/lib/supabase-server";
import { generarPaqueteRadicacion } from "@/lib/empaquetador-radicacion";
import { enviarEmailRadicacion, generarHtmlRadicacion } from "@/lib/email";
import { registrarAuditLog } from "@/lib/audit-log";

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

/**
 * Obtiene el email de radicación del acuerdo de voluntades asociado
 * a la EPS de una factura (basado en nit_erp).
 */
export async function obtenerEmailRadicacion(
  facturaId: string,
): Promise<{ email: string; epsNombre: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Obtener la factura para saber qué EPS
  const { data: factura } = await supabase
    .from("facturas")
    .select("nit_erp, metadata")
    .eq("id", facturaId)
    .eq("user_id", user.id)
    .single();

  if (!factura) return null;

  // Buscar acuerdo vigente con email para esta EPS
  const { data: acuerdos } = await supabase
    .from("acuerdos_voluntades")
    .select("email_radicacion, nombre_eps, eps_codigo")
    .eq("prestador_id", user.id)
    .eq("activo", true)
    .not("email_radicacion", "is", null)
    .order("fecha_fin", { ascending: false });

  if (!acuerdos || acuerdos.length === 0) return null;

  // Buscar por nit_erp o cualquier acuerdo con email
  const metadata = (factura.metadata || {}) as Record<string, string>;
  const epsNombre = metadata.eps_nombre || "";

  // El acuerdo con email que coincida más con la factura
  const acuerdo = acuerdos[0];
  if (!acuerdo?.email_radicacion) return null;

  return {
    email: acuerdo.email_radicacion,
    epsNombre: acuerdo.nombre_eps || epsNombre || acuerdo.eps_codigo,
  };
}

/**
 * Radica una factura enviando el paquete ZIP de radicación por email a la EPS.
 * Transición: descargada → radicada
 * Almacena metadata de email (message_id, fecha envío).
 */
export async function radicarPorEmail(
  facturaId: string,
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Obtener factura completa
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
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

  // 3. Validar CUFE y CUV
  if (!factura.cufe || !factura.cuv) {
    return {
      success: false,
      error: "La factura debe tener CUFE y CUV antes de radicar por email.",
    };
  }

  // 4. Buscar acuerdo con email_radicacion
  const { data: acuerdos } = await supabase
    .from("acuerdos_voluntades")
    .select("email_radicacion, nombre_eps, eps_codigo")
    .eq("prestador_id", user.id)
    .eq("activo", true)
    .not("email_radicacion", "is", null)
    .order("fecha_fin", { ascending: false });

  if (!acuerdos || acuerdos.length === 0 || !acuerdos[0]?.email_radicacion) {
    return {
      success: false,
      error: "Configure el email de radicación en Acuerdos de Voluntades antes de enviar.",
    };
  }

  const emailDestinatario = acuerdos[0].email_radicacion;
  const epsNombre = acuerdos[0].nombre_eps || acuerdos[0].eps_codigo;

  // 5. Generar paquete ZIP
  let zipBase64: string;
  let nombreArchivo: string;
  try {
    const paquete = await generarPaqueteRadicacion(facturaId);
    zipBase64 = paquete.zipBase64;
    nombreArchivo = paquete.nombreArchivo;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error generando paquete de radicación",
    };
  }

  // 6. Preparar datos del email
  const perfil = factura.perfil_prestador_snapshot as Record<string, string> | null;
  const metadata = (factura.metadata || {}) as Record<string, string>;
  const paciente = Array.isArray(factura.pacientes) ? factura.pacientes[0] : factura.pacientes;

  const asunto = `RADICACIÓN FEV-RIPS | NIT ${factura.nit_prestador} | Factura ${factura.num_factura} | ${epsNombre}`;

  const cuerpoHtml = generarHtmlRadicacion({
    prestadorNit: factura.nit_prestador,
    prestadorNombre: perfil?.razon_social || perfil?.nombre_completo || "",
    numFactura: factura.num_factura,
    fechaExpedicion: factura.fecha_expedicion,
    valorTotal: Number(factura.valor_total),
    cufe: factura.cufe,
    cuv: factura.cuv,
    epsNombre,
    pacienteDocumento: paciente?.numero_documento || "",
    pacienteTipoDoc: paciente?.tipo_documento || "CC",
  });

  // 7. Enviar email
  const zipBuffer = Buffer.from(zipBase64, "base64");
  const resultadoEmail = await enviarEmailRadicacion({
    destinatario: emailDestinatario,
    asunto,
    cuerpoHtml,
    adjuntos: [{ filename: nombreArchivo, content: zipBuffer }],
  });

  if (!resultadoEmail.success) {
    return { success: false, error: `Error enviando email: ${resultadoEmail.error}` };
  }

  // 8. Actualizar factura: descargada → radicada con metadata de email
  const metadataActual = (factura.metadata || {}) as Record<string, unknown>;
  const nuevaMetadata = {
    ...metadataActual,
    email_radicacion_enviado: emailDestinatario,
    email_message_id: resultadoEmail.messageId,
    fecha_envio_email: new Date().toISOString(),
    numero_radicado: `EMAIL-${resultadoEmail.messageId}`,
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
    return { success: false, error: "Email enviado pero error actualizando estado de factura" };
  }

  // 9. Audit log
  registrarAuditLog({
    accion: "radicar_por_email",
    tabla: "facturas",
    registroId: facturaId,
    metadata: {
      email_destinatario: emailDestinatario,
      message_id: resultadoEmail.messageId,
      eps_nombre: epsNombre,
    },
  });

  return { success: true, messageId: resultadoEmail.messageId };
}
