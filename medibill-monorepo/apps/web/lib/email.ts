"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "soporte@medibill.com.co";
const FROM_NAME = "Medibill Radicación";

interface EmailRadicacionParams {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
  adjuntos: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * Envía un email de radicación con paquete ZIP adjunto.
 * Retorna el message_id de Resend para tracking.
 */
export async function enviarEmailRadicacion({
  destinatario,
  asunto,
  cuerpoHtml,
  adjuntos,
}: EmailRadicacionParams): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [destinatario],
      subject: asunto,
      html: cuerpoHtml,
      attachments: adjuntos.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id ?? "" };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error enviando email",
    };
  }
}

/**
 * Genera el HTML del email de radicación con tabla resumen.
 */
export function generarHtmlRadicacion(datos: {
  prestadorNit: string;
  prestadorNombre: string;
  numFactura: string;
  fechaExpedicion: string;
  valorTotal: number;
  cufe: string;
  cuv: string;
  epsNombre: string;
  pacienteDocumento: string;
  pacienteTipoDoc: string;
}): string {
  const valorFormateado = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(datos.valorTotal);

  // Anonimizar documento del paciente: mostrar solo últimos 4 dígitos
  const docAnonimizado = datos.pacienteDocumento.length > 4
    ? "****" + datos.pacienteDocumento.slice(-4)
    : datos.pacienteDocumento;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f7; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #1e3a5f; color: white; padding: 24px 32px;">
      <h1 style="margin: 0; font-size: 18px;">📋 Radicación FEV-RIPS</h1>
      <p style="margin: 8px 0 0; opacity: 0.8; font-size: 13px;">Factura Electrónica de Venta con RIPS adjuntos</p>
    </div>
    <div style="padding: 24px 32px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Prestador (NIT)</td>
          <td style="padding: 10px 0; text-align: right;">${datos.prestadorNit}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Razón Social</td>
          <td style="padding: 10px 0; text-align: right;">${datos.prestadorNombre}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">No. Factura</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold;">${datos.numFactura}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Fecha Expedición</td>
          <td style="padding: 10px 0; text-align: right;">${datos.fechaExpedicion}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Valor Total</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #059669;">${valorFormateado}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">CUFE</td>
          <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${datos.cufe}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">CUV</td>
          <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${datos.cuv}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">EPS</td>
          <td style="padding: 10px 0; text-align: right;">${datos.epsNombre}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Paciente (${datos.pacienteTipoDoc})</td>
          <td style="padding: 10px 0; text-align: right;">${docAnonimizado}</td>
        </tr>
      </table>
      <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
        <p style="margin: 0; font-size: 13px; color: #1e40af;">
          📎 Se adjunta paquete ZIP con: XML firmado DIAN, JSON RIPS (Res. 2275/2023), PDF representación gráfica y manifest.
        </p>
      </div>
    </div>
    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">
        Enviado automáticamente por Medibill — medibill.co
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
