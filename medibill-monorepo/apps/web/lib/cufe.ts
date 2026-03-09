/**
 * Cálculo del CUFE — Código Único de Factura Electrónica
 * Resolución 000012 de 2021, Anexo Técnico DIAN 1.9
 *
 * CUFE = SHA-384 de la concatenación:
 *   NumFac + FecFac + HorFac + ValFac +
 *   CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 +
 *   ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente
 *
 * Donde:
 *   NumFac     = Número de factura (prefijo + consecutivo)
 *   FecFac     = Fecha factura (YYYY-MM-DD)
 *   HorFac     = Hora factura (HH:MM:SS-05:00)
 *   ValFac     = Valor factura (subtotal sin impuestos), 2 decimales
 *   CodImp1    = "01" (IVA)
 *   ValImp1    = Valor IVA, 2 decimales
 *   CodImp2    = "04" (ICA)
 *   ValImp2    = Valor ICA, 2 decimales
 *   CodImp3    = "03" (IC)
 *   ValImp3    = Valor IC, 2 decimales
 *   ValTot     = Valor total factura (con impuestos), 2 decimales
 *   NitOFE     = NIT del obligado a facturar electrónicamente
 *   NumAdq     = NIT / documento del adquirente (EPS)
 *   ClTec      = Clave técnica DIAN asignada al rango de numeración
 *   TipoAmbiente = "1" (producción) o "2" (habilitación/pruebas)
 */

import { createHash } from "crypto";

// =====================================================================
// TIPOS
// =====================================================================

export interface DatosCufe {
  /** Número de factura (prefijo + consecutivo). Ej: "SETP990000001" */
  numFac: string;
  /** Fecha de factura: YYYY-MM-DD */
  fecFac: string;
  /** Hora de factura: HH:MM:SS-05:00 */
  horFac: string;
  /** Valor factura antes de impuestos (subtotal). 2 decimales */
  valFac: number;
  /** Valor del IVA. 2 decimales */
  valImp1: number;
  /** Valor del ICA. 2 decimales */
  valImp2: number;
  /** Valor del Impuesto al Consumo (IC). 2 decimales */
  valImp3: number;
  /** Valor total factura (con impuestos). 2 decimales */
  valTot: number;
  /** NIT del emisor (Obligado a Facturar Electrónicamente) */
  nitOFE: string;
  /** NIT / documento del adquirente (EPS) */
  numAdq: string;
  /** Clave técnica DIAN asignada al rango de resolución */
  clTec: string;
  /** "1" = producción, "2" = habilitación/pruebas */
  tipoAmbiente: "1" | "2";
}

// =====================================================================
// FUNCIÓN PRINCIPAL
// =====================================================================

/**
 * Calcula el CUFE (Código Único de Factura Electrónica) según el Anexo Técnico DIAN.
 *
 * @param datos - Datos requeridos para el cálculo
 * @returns CUFE como string hexadecimal en minúsculas (96 caracteres, SHA-384)
 */
export function calcularCufe(datos: DatosCufe): string {
  // Formatear valores numéricos a 2 decimales con punto decimal
  const fmt = (n: number) => n.toFixed(2);

  // Códigos de impuestos fijos según Anexo Técnico DIAN
  const codImp1 = "01"; // IVA
  const codImp2 = "04"; // ICA
  const codImp3 = "03"; // IC (Impuesto al Consumo)

  // Cadena de concatenación según el orden oficial DIAN
  const cadena = [
    datos.numFac,
    datos.fecFac,
    datos.horFac,
    fmt(datos.valFac),
    codImp1,
    fmt(datos.valImp1),
    codImp2,
    fmt(datos.valImp2),
    codImp3,
    fmt(datos.valImp3),
    fmt(datos.valTot),
    datos.nitOFE,
    datos.numAdq,
    datos.clTec,
    datos.tipoAmbiente,
  ].join("");

  // SHA-384 → hex en minúsculas
  return createHash("sha384").update(cadena, "utf8").digest("hex");
}

// =====================================================================
// UTILIDAD: Generar cadena de verificación (para depuración)
// =====================================================================

/**
 * Devuelve la cadena que se usará como input de SHA-384,
 * útil para depuración y verificación manual contra vectores de prueba.
 */
export function obtenerCadenaCufe(datos: DatosCufe): string {
  const fmt = (n: number) => n.toFixed(2);

  return [
    datos.numFac,
    datos.fecFac,
    datos.horFac,
    fmt(datos.valFac),
    "01",
    fmt(datos.valImp1),
    "04",
    fmt(datos.valImp2),
    "03",
    fmt(datos.valImp3),
    fmt(datos.valTot),
    datos.nitOFE,
    datos.numAdq,
    datos.clTec,
    datos.tipoAmbiente,
  ].join("");
}
