"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import type {
  RegistrarPagoInput,
  PagoDB,
  ItemCartera,
  FiltrosCartera,
  ResumenCartera,
} from "@/lib/types/pago";

// ==========================================
// PAGOS — Server Actions
// ==========================================

const CHUNK_SIZE = 50;

/**
 * Consulta pagos en lotes para evitar exceder límites de URL con .in().
 * Divide facturaIds en chunks de CHUNK_SIZE y ejecuta queries en paralelo.
 * TODO: Considerar crear RPC `calcular_saldos_cartera(p_user_id)` con
 * LEFT JOIN pagos ON factura_id GROUP BY para resolverlo en 1 sola query.
 */
async function consultarPagosEnLotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  facturaIds: string[]
): Promise<Record<string, number>> {
  const pagosPorFactura: Record<string, number> = {};
  if (facturaIds.length === 0) return pagosPorFactura;

  const chunks: string[][] = [];
  for (let i = 0; i < facturaIds.length; i += CHUNK_SIZE) {
    chunks.push(facturaIds.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("pagos")
        .select("factura_id, monto")
        .eq("user_id", userId)
        .in("factura_id", chunk)
    )
  );

  for (const { data: pagos } of results) {
    for (const p of pagos || []) {
      pagosPorFactura[p.factura_id] =
        (pagosPorFactura[p.factura_id] || 0) + (p.monto || 0);
    }
  }

  return pagosPorFactura;
}

/** Registra un pago para una factura y actualiza el estado si corresponde */
export async function registrarPago(input: RegistrarPagoInput): Promise<{
  success: boolean;
  error?: string;
  data?: PagoDB;
  nuevo_estado?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Verificar que la factura existe y pertenece al usuario
  const { data: factura } = await supabase
    .from("facturas")
    .select("id, valor_total, estado")
    .eq("id", input.factura_id)
    .eq("user_id", user.id)
    .single();

  if (!factura) return { success: false, error: "Factura no encontrada" };

  // Solo se pueden registrar pagos en facturas radicadas, pagada_parcial
  if (!["radicada", "pagada_parcial"].includes(factura.estado)) {
    return {
      success: false,
      error: `No se puede registrar un pago en una factura con estado "${factura.estado}". La factura debe estar radicada.`,
    };
  }

  // 2. Obtener total ya pagado
  const { data: pagosExistentes } = await supabase
    .from("pagos")
    .select("monto")
    .eq("factura_id", input.factura_id);

  const totalPagado =
    pagosExistentes?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;
  const saldoPendiente = factura.valor_total - totalPagado;

  // Validar que el monto no exceda el saldo
  if (input.monto > saldoPendiente) {
    return {
      success: false,
      error: `El monto ($${input.monto.toLocaleString()}) excede el saldo pendiente ($${saldoPendiente.toLocaleString()})`,
    };
  }

  // 3. Insertar el pago
  const { data: pago, error } = await supabase
    .from("pagos")
    .insert({
      factura_id: input.factura_id,
      user_id: user.id,
      monto: input.monto,
      fecha_pago: input.fecha_pago,
      metodo_pago: input.metodo_pago,
      referencia: input.referencia || null,
      notas: input.notas || null,
    })
    .select()
    .single();

  if (error) {
    devError("Error registrando pago", error);
    return { success: false, error: error.message };
  }

  // 4. Actualizar estado de la factura
  const nuevoTotalPagado = totalPagado + input.monto;
  let nuevoEstado = factura.estado;

  if (nuevoTotalPagado >= factura.valor_total) {
    nuevoEstado = "pagada";
  } else if (nuevoTotalPagado > 0) {
    nuevoEstado = "pagada_parcial";
  }

  if (nuevoEstado !== factura.estado) {
    await supabase
      .from("facturas")
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq("id", input.factura_id)
      .eq("user_id", user.id);
  }

  return { success: true, data: pago, nuevo_estado: nuevoEstado };
}

/** Lista los pagos registrados para una factura */
export async function listarPagosPorFactura(
  facturaId: string
): Promise<PagoDB[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("pagos")
    .select("*")
    .eq("factura_id", facturaId)
    .eq("user_id", user.id)
    .order("fecha_pago", { ascending: false });

  return (data as PagoDB[]) || [];
}

/** Obtiene la cartera pendiente con filtros */
export async function obtenerCarteraPendiente(
  filtros?: FiltrosCartera
): Promise<{ items: ItemCartera[]; resumen: ResumenCartera }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      items: [],
      resumen: { total_pendiente: 0, total_facturas: 0, promedio_dias: 0 },
    };

  // Obtener facturas radicadas/pagada_parcial con sus pagos
  let query = supabase
    .from("facturas")
    .select(
      "id, num_factura, fecha_expedicion, nit_erp, valor_total, estado, metadata, created_at, pacientes(primer_nombre, primer_apellido, numero_documento)"
    )
    .eq("user_id", user.id)
    .in("estado", ["radicada", "pagada_parcial"])
    .order("created_at", { ascending: true });

  if (filtros?.desde) query = query.gte("fecha_expedicion", filtros.desde);
  if (filtros?.hasta) query = query.lte("fecha_expedicion", filtros.hasta);
  if (filtros?.eps) query = query.eq("nit_erp", filtros.eps);

  const { data: facturas, error } = await query;

  if (error) {
    devError("Error obteniendo cartera", error);
    return {
      items: [],
      resumen: { total_pendiente: 0, total_facturas: 0, promedio_dias: 0 },
    };
  }

  if (!facturas || facturas.length === 0)
    return {
      items: [],
      resumen: { total_pendiente: 0, total_facturas: 0, promedio_dias: 0 },
    };

  // Obtener todos los pagos del usuario (con chunking si hay >50 facturas)
  const facturaIds = facturas.map((f) => f.id);
  const pagosPorFactura = await consultarPagosEnLotes(supabase, user.id, facturaIds);

  const hoy = new Date();
  const items: ItemCartera[] = facturas.map((f) => {
    const totalPagado = pagosPorFactura[f.id] || 0;
    const saldoPendiente = f.valor_total - totalPagado;
    const meta = f.metadata as Record<string, unknown> | null;
    const pacienteRaw = f.pacientes as unknown;
    const paciente = Array.isArray(pacienteRaw) ? pacienteRaw[0] as {
      primer_nombre: string;
      primer_apellido: string;
      numero_documento: string;
    } | undefined : pacienteRaw as {
      primer_nombre: string;
      primer_apellido: string;
      numero_documento: string;
    } | null;
    const fechaRef = (meta?.fecha_radicacion as string) || f.created_at;
    const dias = Math.ceil(
      (hoy.getTime() - new Date(fechaRef).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      factura_id: f.id,
      num_factura: f.num_factura,
      fecha_expedicion: f.fecha_expedicion,
      fecha_radicacion: (meta?.fecha_radicacion as string) || null,
      nit_erp: f.nit_erp,
      eps_nombre: (meta?.eps_nombre as string) || f.nit_erp,
      valor_total: f.valor_total,
      total_pagado: totalPagado,
      saldo_pendiente: saldoPendiente,
      estado: f.estado,
      dias_antiguedad: dias,
      paciente_nombre: paciente
        ? `${paciente.primer_nombre} ${paciente.primer_apellido}`
        : "—",
    };
  });

  // Aplicar filtros locales
  let filteredItems = items;

  if (filtros?.estado === "pendiente") {
    filteredItems = filteredItems.filter((i) => i.total_pagado === 0);
  } else if (filtros?.estado === "parcial") {
    filteredItems = filteredItems.filter((i) => i.total_pagado > 0);
  }

  if (filtros?.antiguedad_min != null) {
    filteredItems = filteredItems.filter(
      (i) => i.dias_antiguedad >= filtros.antiguedad_min!
    );
  }
  if (filtros?.antiguedad_max != null) {
    filteredItems = filteredItems.filter(
      (i) => i.dias_antiguedad <= filtros.antiguedad_max!
    );
  }

  // Resumen
  const total_pendiente = filteredItems.reduce(
    (s, i) => s + i.saldo_pendiente,
    0
  );
  const total_facturas = filteredItems.length;
  const promedio_dias =
    total_facturas > 0
      ? Math.round(
          filteredItems.reduce((s, i) => s + i.dias_antiguedad, 0) /
            total_facturas
        )
      : 0;

  return {
    items: filteredItems,
    resumen: { total_pendiente, total_facturas, promedio_dias },
  };
}

/** Obtiene el valor total pendiente de cobro para KPI del dashboard */
export async function obtenerKPICartera(): Promise<{
  valor_pendiente: number;
  facturas_pendientes: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { valor_pendiente: 0, facturas_pendientes: 0 };

  // Facturas radicadas o pagadas parcialmente
  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, valor_total")
    .eq("user_id", user.id)
    .in("estado", ["radicada", "pagada_parcial"]);

  if (!facturas || facturas.length === 0)
    return { valor_pendiente: 0, facturas_pendientes: 0 };

  const facturaIds = facturas.map((f) => f.id);
  const pagosPorFactura = await consultarPagosEnLotes(supabase, user.id, facturaIds);

  let totalPendiente = 0;
  for (const f of facturas) {
    totalPendiente += f.valor_total - (pagosPorFactura[f.id] || 0);
  }

  return {
    valor_pendiente: totalPendiente,
    facturas_pendientes: facturas.length,
  };
}

/** Lista las EPS únicas del usuario (para filtro de cartera) */
export async function listarEPSUsuario(): Promise<
  { nit_erp: string; eps_nombre: string }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("facturas")
    .select("nit_erp, metadata")
    .eq("user_id", user.id)
    .in("estado", ["radicada", "pagada_parcial", "pagada"]);

  if (!data) return [];

  const epsMap: Record<string, string> = {};
  for (const f of data) {
    const meta = f.metadata as Record<string, unknown> | null;
    if (!epsMap[f.nit_erp]) {
      epsMap[f.nit_erp] = (meta?.eps_nombre as string) || f.nit_erp;
    }
  }

  return Object.entries(epsMap).map(([nit_erp, eps_nombre]) => ({
    nit_erp,
    eps_nombre,
  }));
}
