import JSZip from "jszip";
import { createClient } from "@/lib/supabase-server";
import * as matiasClient from "@/lib/providers/matias-client";
import { generarJsonRipsMVP } from "@/app/actions/rips";

/**
 * Genera el paquete ZIP de radicación con todos los soportes normativos.
 *
 * Contenido:
 *   - FEV_{numFactura}.xml  — XML firmado DIAN
 *   - RIPS_{numFactura}.json — JSON RIPS Resolución 2275
 *   - SOPORTE_{numFactura}.pdf — PDF representación gráfica DIAN
 *   - manifest.json — Metadatos del paquete
 */
export async function generarPaqueteRadicacion(
  facturaId: string,
): Promise<{ zipBase64: string; nombreArchivo: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Obtener factura con paciente
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("user_id", user.id)
    .single();

  if (errFactura || !factura) throw new Error("Factura no encontrada");

  // 2. Guards
  if (!factura.cufe) {
    throw new Error(`La factura no tiene CUFE (estado actual: ${factura.estado}). Debe estar aceptada por la DIAN antes de empaquetar.`);
  }
  if (!factura.cuv) {
    throw new Error(`La factura no tiene CUV (estado actual: ${factura.estado}). Debe estar validada ante el MUV antes de empaquetar.`);
  }
  if (factura.estado !== "aprobada" && factura.estado !== "descargada") {
    throw new Error(
      `La factura debe estar en estado aprobada o descargada para empaquetarla. Estado actual: ${factura.estado}`,
    );
  }
  if (!factura.track_id_dian) {
    throw new Error(`La factura no tiene Track ID de la DIAN (estado actual: ${factura.estado}). Verifique que fue enviada correctamente a la DIAN.`);
  }

  const numFactura = factura.num_factura || facturaId;
  const pacienteData = Array.isArray(factura.pacientes)
    ? factura.pacientes[0]
    : factura.pacientes;
  const metadata = (factura.metadata || {}) as Record<string, string>;

  // 3. Obtener archivos en paralelo
  const [xmlFirmado, pdfBuffer, ripsJson] = await Promise.all([
    matiasClient.descargarXml(factura.track_id_dian),
    matiasClient.descargarPdf(factura.track_id_dian),
    generarJsonRipsMVP(facturaId),
  ]);

  // 4. Construir manifest
  const perfil = factura.perfil_prestador_snapshot as Record<string, string> | null;
  const manifest = {
    version: "1.0",
    generado: new Date().toISOString(),
    factura: {
      numero: numFactura,
      fecha_expedicion: factura.fecha_expedicion,
      valor_total: factura.valor_total,
      cufe: factura.cufe,
      cuv: factura.cuv,
    },
    prestador: {
      nit: factura.nit_prestador,
      razon_social: perfil?.razon_social || perfil?.nombre_completo || "",
      codigo_habilitacion: perfil?.codigo_habilitacion || "",
    },
    eps: {
      nit: factura.nit_erp,
      nombre: metadata.eps_nombre || "",
    },
    paciente: pacienteData
      ? {
          documento: pacienteData.numero_documento,
          tipo_documento: pacienteData.tipo_documento,
          nombre: [
            pacienteData.primer_nombre,
            pacienteData.segundo_nombre,
            pacienteData.primer_apellido,
            pacienteData.segundo_apellido,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    archivos: [
      `FEV_${numFactura}.xml`,
      `RIPS_${numFactura}.json`,
      `SOPORTE_${numFactura}.pdf`,
    ],
  };

  // 5. Crear ZIP
  const zip = new JSZip();
  zip.file(`FEV_${numFactura}.xml`, xmlFirmado);
  zip.file(`RIPS_${numFactura}.json`, JSON.stringify(ripsJson, null, 2));
  zip.file(`SOPORTE_${numFactura}.pdf`, pdfBuffer);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipBase64 = zipBuffer.toString("base64");

  const nombreArchivo = `RAD_${numFactura}_${new Date().toISOString().slice(0, 10)}.zip`;

  return { zipBase64, nombreArchivo };
}
