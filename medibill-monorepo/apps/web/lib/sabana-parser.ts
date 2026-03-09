/**
 * Parser de archivos de sábana EPS (Excel/CSV)
 * Usa SheetJS (xlsx) para leer archivos y normalizar datos.
 */

import * as XLSX from "xlsx";
import type { FilaSabana, ResultadoParseo } from "@/lib/types/sabana";

const MAX_FILAS = 500;

/**
 * Parsea un archivo de sábana EPS (Excel o CSV) y devuelve headers + filas normalizadas.
 */
export function parsearArchivoSabana(
  buffer: ArrayBuffer,
  nombreArchivo: string
): ResultadoParseo {
  const extension = nombreArchivo.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
    throw new Error(
      "Formato no soportado. Use archivos .xlsx, .xls o .csv"
    );
  }

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  // Elegir la hoja con más datos (o la primera si solo hay una)
  const nombreHoja = elegirHoja(workbook);
  const sheet = workbook.Sheets[nombreHoja]!;

  // Convertir a JSON (array de objetos)
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  if (rawData.length === 0) {
    throw new Error("El archivo está vacío o no contiene datos");
  }

  // Extraer headers
  const headers = Object.keys(rawData[0]!).filter(
    (h) => h && h.trim() !== ""
  );

  if (headers.length === 0) {
    throw new Error("No se encontraron columnas válidas en el archivo");
  }

  const totalOriginal = rawData.length;

  // Limpiar y normalizar filas
  const filas: FilaSabana[] = rawData
    .slice(0, MAX_FILAS)
    .map((row) => normalizarFila(row, headers))
    .filter((fila) => !esFilaVacia(fila, headers))
    .filter((fila) => !esFilaSubtotal(fila, headers));

  if (filas.length === 0) {
    throw new Error("No se encontraron filas con datos válidos");
  }

  return {
    headers,
    filas,
    hoja: nombreHoja,
    total_filas_original: totalOriginal,
  };
}

/**
 * Elige la hoja con más filas de datos.
 */
function elegirHoja(workbook: XLSX.WorkBook): string {
  if (workbook.SheetNames.length === 1) {
    return workbook.SheetNames[0]!;
  }

  let mejorHoja = workbook.SheetNames[0]!;
  let maxFilas = 0;

  for (const nombre of workbook.SheetNames) {
    const sheet = workbook.Sheets[nombre]!;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const filas = range.e.r - range.s.r;
    if (filas > maxFilas) {
      maxFilas = filas;
      mejorHoja = nombre;
    }
  }

  return mejorHoja;
}

/**
 * Normaliza una fila: trim strings, limpiar valores numéricos.
 */
function normalizarFila(
  row: Record<string, unknown>,
  headers: string[]
): FilaSabana {
  const fila: FilaSabana = {};

  for (const header of headers) {
    const valor = row[header];

    if (valor === null || valor === undefined) {
      fila[header] = null;
      continue;
    }

    if (typeof valor === "number") {
      fila[header] = valor;
      continue;
    }

    if (valor instanceof Date) {
      fila[header] = valor.toISOString().split("T")[0]!;
      continue;
    }

    const str = String(valor).trim();
    if (str === "" || str === "-" || str === "N/A") {
      fila[header] = null;
      continue;
    }

    // Intentar parsear como número si parece numérico (ej: "$1.234.567" → 1234567)
    const numLimpio = limpiarNumero(str);
    if (numLimpio !== null) {
      fila[header] = numLimpio;
      continue;
    }

    fila[header] = str;
  }

  return fila;
}

/**
 * Intenta limpiar un string que parece número colombiano.
 * Formato colombiano: $1.234.567,89 o 1.234.567
 * Retorna null si no es un número válido.
 */
function limpiarNumero(str: string): number | null {
  // Solo intentar si parece un número (contiene dígitos y separadores)
  if (!/^[\s$\d.,()-]+$/.test(str)) return null;

  // Remover símbolo de moneda, espacios, paréntesis (negativos)
  let limpio = str.replace(/[$\s]/g, "");
  const esNegativo = limpio.includes("(") && limpio.includes(")");
  limpio = limpio.replace(/[()]/g, "");

  if (limpio === "") return null;

  // Detectar formato: si tiene punto Y coma, determinar cuál es separador de miles
  const tienePunto = limpio.includes(".");
  const tieneComa = limpio.includes(",");

  let numero: number;

  if (tienePunto && tieneComa) {
    // Formato colombiano: 1.234.567,89 → punto=miles, coma=decimal
    const ultimaComa = limpio.lastIndexOf(",");
    const ultimoPunto = limpio.lastIndexOf(".");
    if (ultimaComa > ultimoPunto) {
      // 1.234,56 → coma es decimal
      limpio = limpio.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 → punto es decimal (formato US)
      limpio = limpio.replace(/,/g, "");
    }
    numero = parseFloat(limpio);
  } else if (tieneComa) {
    // Solo coma: podría ser 1,234 (miles) o 1234,56 (decimal colombiano)
    const partesComa = limpio.split(",");
    if (partesComa.length === 2 && partesComa[1]!.length <= 2) {
      // Probablemente decimal: 1234,56
      limpio = limpio.replace(",", ".");
    } else {
      // Probablemente miles: 1,234,567
      limpio = limpio.replace(/,/g, "");
    }
    numero = parseFloat(limpio);
  } else if (tienePunto) {
    // Solo punto: 1.234.567 (miles colombiano) o 1234.56 (decimal)
    const partesPunto = limpio.split(".");
    if (partesPunto.length > 2) {
      // Múltiples puntos = separador de miles: 1.234.567
      limpio = limpio.replace(/\./g, "");
      numero = parseFloat(limpio);
    } else if (partesPunto.length === 2 && partesPunto[1]!.length <= 2) {
      // Un punto con max 2 decimales: 1234.56
      numero = parseFloat(limpio);
    } else {
      // Un punto con 3+ chars después: 1.234 = miles
      limpio = limpio.replace(/\./g, "");
      numero = parseFloat(limpio);
    }
  } else {
    numero = parseFloat(limpio);
  }

  if (isNaN(numero)) return null;

  return esNegativo ? -numero : numero;
}

/**
 * Determina si una fila está completamente vacía.
 */
function esFilaVacia(fila: FilaSabana, headers: string[]): boolean {
  return headers.every((h) => fila[h] === null || fila[h] === "");
}

/**
 * Heurística para detectar filas de subtotales.
 * Si una fila tiene muy pocas columnas con datos (1-2) y una de ellas
 * contiene palabras como "TOTAL", "SUBTOTAL", probablemente es un subtotal.
 */
function esFilaSubtotal(fila: FilaSabana, headers: string[]): boolean {
  const valoresNoNull = headers.filter(
    (h) => fila[h] !== null && fila[h] !== ""
  );

  // Si la fila tiene pocos valores y contiene la palabra "total"
  if (valoresNoNull.length <= 3) {
    const textoFila = valoresNoNull
      .map((h) => String(fila[h] ?? ""))
      .join(" ")
      .toLowerCase();
    if (/\b(total|subtotal|gran total|suma)\b/.test(textoFila)) {
      return true;
    }
  }

  return false;
}
