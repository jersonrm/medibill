/**
 * Catálogo de Códigos de Respuesta RS01-RS05 — Medibill
 *
 * Resolución 2284 de 2023 · Ley 1438 de 2011, Art. 57
 * Circular Conjunta 007 de 2025 (MinSalud + SuperSalud)
 */

import type { CodigoRespuesta, ConfigRespuestaRS } from "@/lib/types/glosas";

// =====================================================================
// CONFIGURACIÓN DE CÓDIGOS RS01-RS05
// =====================================================================

export const CODIGOS_RESPUESTA: Record<CodigoRespuesta, ConfigRespuestaRS> = {
  RS01: {
    codigo: "RS01",
    nombre: "Aceptación total",
    descripcion:
      "El prestador acepta la totalidad de la glosa formulada por la ERP",
    requiereJustificacion: false,
    requiereSoportes: false,
    generaNotaCredito: true,
    icono: "✓",
    color: "red",
  },
  RS02: {
    codigo: "RS02",
    nombre: "Aceptación parcial",
    descripcion:
      "El prestador acepta parcialmente la glosa y controvierte el saldo restante",
    requiereJustificacion: true,
    requiereSoportes: true,
    generaNotaCredito: true,
    icono: "⚖",
    color: "orange",
  },
  RS03: {
    codigo: "RS03",
    nombre: "Rechazo total con justificación",
    descripcion:
      "El prestador rechaza la glosa y sustenta con evidencia la conformidad del cobro",
    requiereJustificacion: true,
    requiereSoportes: true,
    generaNotaCredito: false,
    icono: "✕",
    color: "green",
  },
  RS04: {
    codigo: "RS04",
    nombre: "Rechazo por glosa extemporánea",
    descripcion:
      "La ERP formuló la glosa fuera de los 20 días hábiles (Art. 57 Ley 1438/2011)",
    requiereJustificacion: false,
    requiereSoportes: false,
    generaNotaCredito: false,
    icono: "⏰",
    color: "purple",
  },
  RS05: {
    codigo: "RS05",
    nombre: "Rechazo por glosa infundada",
    descripcion:
      "La glosa no corresponde a causal válida del Manual Único (Art. 4 Res. 2284/2023)",
    requiereJustificacion: true,
    requiereSoportes: false,
    generaNotaCredito: false,
    icono: "⚠",
    color: "cyan",
  },
};

// =====================================================================
// PLANTILLAS DE JUSTIFICACIÓN POR CONCEPTO GENERAL
// =====================================================================

export const PLANTILLAS_JUSTIFICACION: Record<string, string> = {
  FA: "Se adjuntan soportes que evidencian la correcta facturación del servicio prestado conforme al acuerdo de voluntades vigente. Los valores corresponden a las tarifas pactadas y las cantidades registradas en la historia clínica.",
  TA: "La tarifa aplicada corresponde a lo establecido en el acuerdo de voluntades suscrito entre las partes. Se adjunta copia del acuerdo con la tarifa pactada.",
  SO: "El servicio fue prestado en el marco de una atención de urgencias (Art. 168 Ley 100/1993), por lo cual no requiere autorización previa. Se adjunta registro de atención de urgencias.",
  AU: "Se verificó la afiliación del paciente al momento de la atención mediante consulta a la BDUA. Se adjunta captura de pantalla de la verificación de derechos.",
  PE: "El procedimiento se realizó conforme a la indicación médica basada en la condición clínica del paciente, documentada en la historia clínica. La pertinencia fue evaluada por el médico tratante especialista.",
  DE: "Se adjuntan los soportes que demuestran que la factura cumple con los requisitos de radicación establecidos en la Resolución 510/2022.",
  SA: "Los indicadores de seguimiento del acuerdo de voluntades se encuentran dentro de los rangos pactados. Se adjunta informe de cumplimiento del período evaluado.",
};

// =====================================================================
// PLANTILLAS AUTOMÁTICAS PARA RS04 Y RS05
// =====================================================================

/**
 * Genera justificación automática para RS04 (extemporánea).
 * @param diasTranscurridos Días hábiles entre radicación y formulación de la glosa
 */
export function generarJustificacionRS04(
  codigoGlosa: string,
  fechaRadicacion: string,
  fechaGlosa: string,
  diasTranscurridos: number
): string {
  return (
    `Se rechaza la glosa ${codigoGlosa} por EXTEMPORÁNEA. ` +
    `La EPS formuló esta glosa el ${fechaGlosa}, transcurridos ${diasTranscurridos} días hábiles ` +
    `desde la radicación de la factura (${fechaRadicacion}), superando el plazo legal de 20 días hábiles ` +
    `establecido en el Art. 57 de la Ley 1438 de 2011. ` +
    `Conforme a la Resolución 2284 de 2023, Art. 8, la EPS pierde competencia temporal para formular la glosa.`
  );
}

/**
 * Genera justificación automática para RS05 (infundada).
 * @param codigoGlosa Código de la glosa rechazada
 */
export function generarJustificacionRS05(codigoGlosa: string): string {
  return (
    `Se rechaza la glosa con código "${codigoGlosa}" por INFUNDADA. ` +
    `El código utilizado por la EPS NO corresponde a una causal válida del Manual Único de Devoluciones, ` +
    `Glosas y Respuestas (Resolución 2284 de 2023, Anexo Técnico No. 3). ` +
    `Las causas de glosa y devolución son TAXATIVAS (Art. 4 Res. 2284/2023) y la EPS no puede ` +
    `formular glosas con códigos no contemplados en el Manual. ` +
    `Se solicita el levantamiento inmediato de la glosa. La ERP deberá pagar intereses moratorios ` +
    `conforme al Art. 2.5.3.4.5.7 del Decreto 780 de 2016.`
  );
}

/** Fundamento legal estándar para RS04 */
export const FUNDAMENTO_LEGAL_RS04 =
  "Art. 57 Ley 1438/2011: la EPS tiene 20 días hábiles para formular glosas desde la radicación. " +
  "Res. 2284/2023, Art. 8: plazos para formulación de glosas. " +
  "Vencido el plazo, opera silencio administrativo positivo a favor del prestador.";

/** Fundamento legal estándar para RS05 */
export const FUNDAMENTO_LEGAL_RS05 =
  "Art. 4 Resolución 2284 de 2023: las causas de devolución y glosa son las establecidas " +
  "en el Anexo Técnico No. 3 y son de carácter TAXATIVO. " +
  "Circular Conjunta 007 de 2025 (MinSalud + SuperSalud), §2: " +
  "las ERP no podrán formular glosas con causas distintas a las del Manual Único. " +
  "Art. 57 Ley 1438/2011: intereses moratorios por glosas infundadas. " +
  "Art. 2.5.3.4.5.7 Decreto 780 de 2016.";
