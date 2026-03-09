/**
 * Servicio de conciliación: cruza filas normalizadas de la sábana EPS
 * contra las facturas radicadas del prestador en Supabase.
 */

import { createClient } from "@/lib/supabase-server";
import type {
  FilaNormalizada,
  ItemConciliacion,
  ResultadoConciliacion,
  ResumenConciliacion,
  TipoConciliacion,
} from "@/lib/types/sabana";

// =====================================================================
// CONCILIACIÓN PRINCIPAL
// =====================================================================

/**
 * Concilia filas normalizadas de una sábana contra facturas del usuario.
 * Cruza por num_factura (primero exacto, luego fuzzy).
 */
export async function conciliarConFacturas(
  filasNormalizadas: FilaNormalizada[],
  userId: string
): Promise<ResultadoConciliacion> {
  const supabase = await createClient();

  // 1. Obtener todas las facturas radicadas / pagada_parcial / pagada del usuario
  const { data: facturas } = await supabase
    .from("facturas")
    .select(
      "id, num_factura, valor_total, estado, nit_erp, metadata, paciente_id"
    )
    .eq("user_id", userId)
    .in("estado", ["radicada", "pagada_parcial", "pagada"]);

  if (!facturas || facturas.length === 0) {
    return generarResultadoSinFacturas(filasNormalizadas);
  }

  // 2. Obtener pagos existentes para calcular saldos
  const facturaIds = facturas.map((f) => f.id);
  const { data: pagosExistentes } = await supabase
    .from("pagos")
    .select("factura_id, monto")
    .in("factura_id", facturaIds);

  const pagosPorFactura: Record<string, number> = {};
  for (const p of pagosExistentes || []) {
    pagosPorFactura[p.factura_id] =
      (pagosPorFactura[p.factura_id] || 0) + (p.monto || 0);
  }

  // 3. Obtener nombres de pacientes
  const pacienteIds = facturas
    .map((f) => f.paciente_id)
    .filter((id): id is string => !!id);

  let pacienteNombres: Record<string, string> = {};
  if (pacienteIds.length > 0) {
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, primer_nombre, primer_apellido")
      .in("id", pacienteIds);

    if (pacientes) {
      for (const p of pacientes) {
        pacienteNombres[p.id] =
          `${p.primer_nombre || ""} ${p.primer_apellido || ""}`.trim();
      }
    }
  }

  // 4. Construir índice de facturas para búsqueda rápida
  const indice = construirIndiceFacturas(
    facturas,
    pagosPorFactura,
    pacienteNombres
  );

  // 5. Conciliar cada fila
  const items: ItemConciliacion[] = filasNormalizadas.map((fila) =>
    conciliarFila(fila, indice)
  );

  // 6. Calcular resumen
  const resumen = calcularResumen(items);

  return { items, resumen };
}

// =====================================================================
// ÍNDICE DE FACTURAS
// =====================================================================

export interface FacturaIndexada {
  id: string;
  num_factura: string;
  num_factura_normalizado: string;
  valor_total: number;
  estado: string;
  saldo_pendiente: number;
  eps_nombre: string;
  paciente_nombre: string;
}

export function construirIndiceFacturas(
  facturas: Array<{
    id: string;
    num_factura: string;
    valor_total: number;
    estado: string;
    nit_erp: string;
    metadata: unknown;
    paciente_id: string | null;
  }>,
  pagosPorFactura: Record<string, number>,
  pacienteNombres: Record<string, string>
): FacturaIndexada[] {
  return facturas.map((f) => {
    const totalPagado = pagosPorFactura[f.id] || 0;
    const meta = f.metadata as Record<string, unknown> | null;
    return {
      id: f.id,
      num_factura: f.num_factura,
      num_factura_normalizado: normalizarNumFactura(f.num_factura),
      valor_total: f.valor_total,
      estado: f.estado,
      saldo_pendiente: Math.max(0, f.valor_total - totalPagado),
      eps_nombre: (meta?.eps_nombre as string) || f.nit_erp,
      paciente_nombre: f.paciente_id
        ? pacienteNombres[f.paciente_id] || "—"
        : "—",
    };
  });
}

// =====================================================================
// CONCILIAR UNA FILA
// =====================================================================

function conciliarFila(
  fila: FilaNormalizada,
  indice: FacturaIndexada[]
): ItemConciliacion {
  // Intentar match por número de factura
  const factura = buscarFactura(fila.num_factura, indice);

  if (!factura) {
    return {
      fila,
      factura: null,
      tipo: "sin_match_factura",
      seleccionado: false,
      advertencia: `No se encontró factura "${fila.num_factura}" en el sistema`,
    };
  }

  // Determinar tipo de conciliación
  const { tipo, advertencia, seleccionado } = clasificarConciliacion(
    fila,
    factura
  );

  return {
    fila,
    factura: {
      id: factura.id,
      num_factura: factura.num_factura,
      valor_total: factura.valor_total,
      estado: factura.estado,
      saldo_pendiente: factura.saldo_pendiente,
      eps_nombre: factura.eps_nombre,
      paciente_nombre: factura.paciente_nombre,
    },
    tipo,
    seleccionado,
    advertencia,
  };
}

export function clasificarConciliacion(
  fila: FilaNormalizada,
  factura: FacturaIndexada
): { tipo: TipoConciliacion; seleccionado: boolean; advertencia?: string } {
  // Factura ya pagada completamente
  if (factura.estado === "pagada" || factura.saldo_pendiente <= 0) {
    return {
      tipo: "ya_pagada",
      seleccionado: false,
      advertencia: "Esta factura ya está completamente pagada",
    };
  }

  const montoPago = fila.valor_pagado;
  const montoGlosa = fila.valor_glosado ?? 0;

  // El monto excede el saldo pendiente
  if (montoPago > factura.saldo_pendiente) {
    return {
      tipo: "excede_saldo",
      seleccionado: false,
      advertencia: `El pago ($${montoPago.toLocaleString()}) excede el saldo pendiente ($${factura.saldo_pendiente.toLocaleString()})`,
    };
  }

  // Pago total (con o sin glosa)
  if (montoGlosa > 0) {
    return {
      tipo: "con_glosa",
      seleccionado: true,
      advertencia: `Glosa por $${montoGlosa.toLocaleString()}${fila.observacion ? `: ${fila.observacion}` : ""}`,
    };
  }

  // Comparar monto pagado con valor total de la factura
  if (montoPago >= factura.valor_total * 0.99) {
    // Tolerancia del 1% por redondeo
    return { tipo: "pago_total", seleccionado: true };
  }

  return {
    tipo: "pago_parcial",
    seleccionado: true,
    advertencia: `Pago parcial: $${montoPago.toLocaleString()} de $${factura.valor_total.toLocaleString()}`,
  };
}

// =====================================================================
// BÚSQUEDA DE FACTURA POR NÚMERO
// =====================================================================

/**
 * Busca una factura por número: primero exacto, luego fuzzy (sin prefijo).
 */
export function buscarFactura(
  numFacturaSabana: string,
  indice: FacturaIndexada[]
): FacturaIndexada | null {
  if (!numFacturaSabana) return null;

  const normalizado = normalizarNumFactura(numFacturaSabana);

  // 1. Match exacto normalizado
  const exacto = indice.find(
    (f) => f.num_factura_normalizado === normalizado
  );
  if (exacto) return exacto;

  // 2. Match por solo la parte numérica
  const soloNumeros = normalizado.replace(/\D/g, "");
  if (soloNumeros.length >= 3) {
    const fuzzy = indice.find(
      (f) => f.num_factura_normalizado.replace(/\D/g, "") === soloNumeros
    );
    if (fuzzy) return fuzzy;
  }

  // 3. Match por sufijo (la sábana puede tener solo el número sin prefijo)
  if (soloNumeros.length >= 3) {
    const porSufijo = indice.find((f) =>
      f.num_factura_normalizado.endsWith(soloNumeros)
    );
    if (porSufijo) return porSufijo;
  }

  return null;
}

/**
 * Normaliza un número de factura: lowercase, sin espacios, sin guiones extra.
 */
export function normalizarNumFactura(num: string): string {
  return num
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/-+/g, "-");
}

// =====================================================================
// UTILIDADES
// =====================================================================

export function generarResultadoSinFacturas(
  filas: FilaNormalizada[]
): ResultadoConciliacion {
  const items: ItemConciliacion[] = filas.map((fila) => ({
    fila,
    factura: null,
    tipo: "sin_match_factura" as const,
    seleccionado: false,
    advertencia:
      "No hay facturas radicadas en el sistema para conciliar",
  }));

  return {
    items,
    resumen: {
      total_filas: filas.length,
      conciliadas: 0,
      sin_match: filas.length,
      ya_pagadas: 0,
      monto_a_registrar: 0,
      monto_glosado: 0,
    },
  };
}

export function calcularResumen(items: ItemConciliacion[]): ResumenConciliacion {
  let conciliadas = 0;
  let sin_match = 0;
  let ya_pagadas = 0;
  let monto_a_registrar = 0;
  let monto_glosado = 0;

  for (const item of items) {
    if (item.tipo === "sin_match_factura") {
      sin_match++;
    } else if (item.tipo === "ya_pagada") {
      ya_pagadas++;
    } else {
      conciliadas++;
      if (item.seleccionado) {
        monto_a_registrar += item.fila.valor_pagado;
      }
    }
    monto_glosado += item.fila.valor_glosado ?? 0;
  }

  return {
    total_filas: items.length,
    conciliadas,
    sin_match,
    ya_pagadas,
    monto_a_registrar,
    monto_glosado,
  };
}
