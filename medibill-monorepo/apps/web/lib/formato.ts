/**
 * Utilidades de formato para Medibill
 */

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea un valor numérico como moneda colombiana (COP) */
export function formatCOP(valor: number): string {
  return formatoMoneda.format(valor);
}

/** Formatea una fecha ISO a formato colombiano (DD/MM/YYYY) */
export function formatFechaCO(fechaISO: string): string {
  const fecha = new Date(fechaISO + "T00:00:00");
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formatea una fecha ISO a formato largo colombiano */
export function formatFechaLargaCO(fechaISO: string): string {
  const fecha = new Date(fechaISO + "T00:00:00");
  return fecha.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Escapa caracteres especiales HTML para prevenir XSS */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
