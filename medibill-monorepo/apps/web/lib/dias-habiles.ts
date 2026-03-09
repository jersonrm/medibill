/**
 * Utilidades de Días Hábiles Colombianos — Medibill
 *
 * Calcula días hábiles excluyendo sábados, domingos y festivos
 * colombianos (Ley 51 de 1983 y Ley 2286 de 2023).
 *
 * Usado por:
 *  - Módulo de Respuesta de Glosas (Capa 3)
 *  - Validador Pre-Radicación (Capa 1)
 */

import festivosData from "@/data/festivos-colombia.json";

// =====================================================================
// FESTIVOS COLOMBIANOS — cargados desde JSON (data/festivos-colombia.json)
// =====================================================================

const FESTIVOS_COLOMBIA: Set<string> = new Set(
  Object.values(festivosData).flat()
);

/** Verifica si una fecha es festivo colombiano */
function esFestivo(fecha: Date): boolean {
  return FESTIVOS_COLOMBIA.has(fecha.toISOString().slice(0, 10));
}

/** Verifica si una fecha es día hábil (lun-vie, no festivo) */
export function esDiaHabil(fecha: Date): boolean {
  const dow = fecha.getDay();
  return dow !== 0 && dow !== 6 && !esFestivo(fecha);
}

// =====================================================================
// FUNCIONES PRINCIPALES
// =====================================================================

/**
 * Calcula días hábiles entre dos fechas (incluyendo ambas si son hábiles).
 * Excluye sábados, domingos y festivos colombianos.
 *
 * @param fechaInicio Fecha de inicio (string YYYY-MM-DD)
 * @param fechaFin Fecha de fin (string YYYY-MM-DD)
 * @returns Número de días hábiles entre ambas fechas
 */
export function calcularDiasHabiles(fechaInicio: string, fechaFin: string): number {
  const d1 = new Date(fechaInicio + "T00:00:00");
  const d2 = new Date(fechaFin + "T00:00:00");
  if (d1 > d2) return 0;

  let dias = 0;
  const current = new Date(d1);
  while (current <= d2) {
    if (esDiaHabil(current)) dias++;
    current.setDate(current.getDate() + 1);
  }
  return dias;
}

/**
 * Suma N días hábiles a una fecha y retorna la fecha resultante.
 *
 * @param fechaInicio Fecha base (string YYYY-MM-DD)
 * @param diasHabiles Número de días hábiles a sumar
 * @returns Fecha resultante en formato YYYY-MM-DD
 */
export function sumarDiasHabiles(fechaInicio: string, diasHabiles: number): string {
  const current = new Date(fechaInicio + "T00:00:00");
  let contados = 0;
  while (contados < diasHabiles) {
    current.setDate(current.getDate() + 1);
    if (esDiaHabil(current)) contados++;
  }
  return current.toISOString().split("T")[0]!;
}

/**
 * Determina si una glosa fue formulada fuera del plazo de 20 días hábiles
 * desde la radicación de la factura.
 *
 * Art. 57 Ley 1438/2011: la EPS tiene 20 días hábiles para glosar.
 *
 * @param fechaRadicacion Fecha de radicación de la factura (YYYY-MM-DD)
 * @param fechaGlosa Fecha en que la EPS formuló la glosa (YYYY-MM-DD)
 * @returns true si la glosa fue extemporánea (>20 días hábiles)
 */
export function esGlosaExtemporanea(fechaRadicacion: string, fechaGlosa: string): boolean {
  return calcularDiasHabiles(fechaRadicacion, fechaGlosa) > 20;
}

/**
 * Calcula los días hábiles restantes para responder una glosa.
 * El prestador tiene 15 días hábiles desde la recepción de la glosa.
 * Retorna número negativo si ya venció.
 *
 * @param fechaLimite Fecha límite de respuesta (YYYY-MM-DD)
 * @returns Días hábiles restantes (negativo si venció)
 */
export function diasRestantesParaResponder(fechaLimite: string): number {
  const hoy = new Date().toISOString().split("T")[0]!;
  const limite = new Date(fechaLimite + "T00:00:00");
  const ahora = new Date(hoy + "T00:00:00");

  if (ahora > limite) {
    return -calcularDiasHabiles(fechaLimite, hoy);
  }
  return calcularDiasHabiles(hoy, fechaLimite);
}

/**
 * Calcula el nivel de urgencia basado en los días restantes.
 */
export function calcularUrgencia(diasRestantes: number): "critica" | "urgente" | "normal" | "vencida" {
  if (diasRestantes <= 0) return "vencida";
  if (diasRestantes <= 3) return "critica";
  if (diasRestantes <= 7) return "urgente";
  return "normal";
}
