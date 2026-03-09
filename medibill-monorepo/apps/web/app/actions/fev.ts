"use server";

import { createClient } from "@/lib/supabase-server";
import { generarXmlFev } from "@/lib/generar-fev-xml";
import { registrarAuditLog } from "@/lib/audit-log";
import { obtenerContextoFacturacion } from "@/lib/services/contexto-facturacion";
import type { FevXmlResult } from "@/lib/types/fev-xml";

// ==========================================
// FEV XML — Server Actions
// ==========================================

/**
 * Genera el XML de Factura Electrónica de Venta (FEV) UBL 2.1 para la DIAN.
 * Solo disponible para facturas en estado "aprobada" o "descargada".
 *
 * @param facturaId - ID de la factura en Supabase
 * @returns FevXmlResult con XML, CUFE, invoice y numFactura, o error
 */
export async function generarFevXml(
  facturaId: string,
): Promise<{ success: true; data: FevXmlResult } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Obtener factura con datos del paciente
  const { data: facturaRow, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("user_id", user.id)
    .single();

  if (errFactura || !facturaRow) {
    return { success: false, error: "Factura no encontrada" };
  }

  if (facturaRow.estado !== "aprobada" && facturaRow.estado !== "descargada") {
    return { success: false, error: `La factura debe estar aprobada para generar FEV XML. Estado actual: ${facturaRow.estado}` };
  }

  // 2. Obtener contexto (perfil + resolución + mapeos)
  const ctx = await obtenerContextoFacturacion(supabase, user.id, facturaRow);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { factura, perfilInput, resolucionInput, clienteInput, pacienteInput } = ctx.data;

  // clave_tecnica: placeholder hasta configurar sandbox DIAN
  if (!resolucionInput.clave_tecnica) {
    resolucionInput.clave_tecnica = "0000000000000000000000000000000000000000000000000000000000000000";
  }

  // 2. Generar XML
  const ambiente = (process.env.DIAN_AMBIENTE === "1" ? "1" : "2") as "1" | "2";
  const resultado = generarXmlFev(factura, perfilInput, resolucionInput, clienteInput, ambiente, pacienteInput);

  registrarAuditLog({ accion: "generar_fev_xml", tabla: "facturas", registroId: facturaId, metadata: { num_factura: factura.num_factura, ambiente, cufe: resultado.cufe } });

  return { success: true, data: resultado };
}
