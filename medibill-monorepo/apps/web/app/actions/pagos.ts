"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { registrarAuditLog } from "@/lib/audit-log";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { RegistrarPagoSchema } from "@/lib/schemas/pagos.schema";
import { safeError } from "@/lib/safe-error";
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
  // Validar input con Zod (monto > 0, campos requeridos)
  const parsed = RegistrarPagoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "crear_factura");

  const supabase = await createClient();

  // 1. Verificar que la factura existe y pertenece a la org
  const { data: factura } = await supabase
    .from("facturas")
    .select("id, valor_total, estado")
    .eq("id", parsed.data.factura_id)
    .eq("organizacion_id", ctx.orgId)
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
    .eq("factura_id", parsed.data.factura_id);

  const totalPagado =
    pagosExistentes?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;
  const saldoPendiente = factura.valor_total - totalPagado;

  // Validar que el monto no exceda el saldo
  if (parsed.data.monto > saldoPendiente) {
    return {
      success: false,
      error: `El monto ($${parsed.data.monto.toLocaleString()}) excede el saldo pendiente ($${saldoPendiente.toLocaleString()})`,
    };
  }

  // 3. Insertar el pago
  const { data: pago, error } = await supabase
    .from("pagos")
    .insert({
      factura_id: parsed.data.factura_id,
      user_id: ctx.userId,
      monto: parsed.data.monto,
      fecha_pago: parsed.data.fecha_pago,
      metodo_pago: parsed.data.metodo_pago,
      referencia: parsed.data.referencia || null,
      notas: parsed.data.notas || null,
    })
    .select()
    .single();

  if (error) {
    devError("Error registrando pago", error);
    return { success: false, error: safeError("registrarPago", error) };
  }

  // 4. Actualizar estado de la factura
  const nuevoTotalPagado = totalPagado + parsed.data.monto;
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
      .eq("organizacion_id", ctx.orgId);
  }

  registrarAuditLog({ accion: "registrar_pago", tabla: "pagos", registroId: pago.id, metadata: { factura_id: parsed.data.factura_id, monto: parsed.data.monto, nuevo_estado: nuevoEstado } });

  return { success: true, data: pago, nuevo_estado: nuevoEstado };
}

/** Lista los pagos registrados para una factura */
export async function listarPagosPorFactura(
  facturaId: string
): Promise<PagoDB[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const { data } = await supabase
    .from("pagos")
    .select("*")
    .eq("factura_id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .order("fecha_pago", { ascending: false });

  return (data as PagoDB[]) || [];
}

/** Obtiene la cartera pendiente con filtros */
export async function obtenerCarteraPendiente(
  filtros?: FiltrosCartera
): Promise<{ items: ItemCartera[]; resumen: ResumenCartera }> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Obtener facturas radicadas/pagada_parcial con sus pagos
  let query = supabase
    .from("facturas")
    .select(
      "id, num_factura, fecha_expedicion, nit_erp, valor_total, estado, metadata, created_at, pacientes(primer_nombre, primer_apellido, numero_documento)"
    )
    .eq("organizacion_id", ctx.orgId)
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
  const pagosPorFactura = await consultarPagosEnLotes(supabase, ctx.orgId, facturaIds);

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
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Facturas radicadas o pagadas parcialmente
  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, valor_total")
    .eq("organizacion_id", ctx.orgId)
    .in("estado", ["radicada", "pagada_parcial"]);

  if (!facturas || facturas.length === 0)
    return { valor_pendiente: 0, facturas_pendientes: 0 };

  const facturaIds = facturas.map((f) => f.id);
  const pagosPorFactura = await consultarPagosEnLotes(supabase, ctx.orgId, facturaIds);

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
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const { data } = await supabase
    .from("facturas")
    .select("nit_erp, metadata")
    .eq("organizacion_id", ctx.orgId)
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

// ==========================================
// ALERTAS DE CARTERA CON CONTEXTO EPS
// ==========================================

export interface AlertaCartera {
  factura_id: string;
  num_factura: string;
  eps_nombre: string;
  nit_erp: string;
  dias_antiguedad: number;
  promedio_comunidad: number;
  semaforo: "verde" | "amarillo" | "rojo";
  mensaje: string;
}

/**
 * Obtiene alertas de cartera con contexto de benchmark EPS.
 * Semáforo: verde (<promedio), amarillo (100-150%), rojo (>150%).
 */
export async function obtenerAlertasCartera(): Promise<AlertaCartera[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Facturas pendientes de pago
  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, num_factura, nit_erp, metadata, created_at")
    .eq("organizacion_id", ctx.orgId)
    .in("estado", ["radicada", "pagada_parcial"])
    .order("created_at", { ascending: true });

  if (!facturas || facturas.length === 0) return [];

  // EPS únicas
  const epsSet = new Set(facturas.map((f) => f.nit_erp));
  const epsCodigos = Array.from(epsSet);

  // Benchmark de días pago por EPS
  const { data: benchmarks } = await supabase
    .from("mv_dias_pago_por_eps" as never)
    .select("*")
    .in("eps_codigo", epsCodigos);

  const promediosPorEps = new Map<string, number>();
  if (benchmarks) {
    for (const b of benchmarks as { eps_codigo: string; promedio_dias: number }[]) {
      promediosPorEps.set(b.eps_codigo, b.promedio_dias);
    }
  }

  const hoy = new Date();
  const alertas: AlertaCartera[] = [];

  for (const f of facturas) {
    const meta = f.metadata as Record<string, unknown> | null;
    const fechaRef = (meta?.fecha_radicacion as string) || f.created_at;
    const dias = Math.ceil(
      (hoy.getTime() - new Date(fechaRef).getTime()) / (1000 * 60 * 60 * 24),
    );
    const promedio = promediosPorEps.get(f.nit_erp);
    const epsNombre = (meta?.eps_nombre as string) || f.nit_erp;

    // Sin benchmark, no generar alerta contextualizada
    if (!promedio) continue;

    let semaforo: AlertaCartera["semaforo"];
    let mensaje: string;

    const ratio = dias / promedio;

    if (ratio <= 1) {
      semaforo = "verde";
      mensaje = `Promedio pago ${epsNombre}: ${promedio} días. Tu factura lleva ${dias} días — dentro del rango esperado.`;
    } else if (ratio <= 1.5) {
      semaforo = "amarillo";
      mensaje = `Promedio pago ${epsNombre}: ${promedio} días. Tu factura lleva ${dias} días — acercándose al límite.`;
    } else {
      semaforo = "rojo";
      mensaje = `Promedio pago ${epsNombre}: ${promedio} días. Tu factura lleva ${dias} días — excede significativamente el promedio.`;
    }

    // Solo incluir amarillo y rojo como alertas
    if (semaforo === "verde") continue;

    alertas.push({
      factura_id: f.id,
      num_factura: f.num_factura,
      eps_nombre: epsNombre,
      nit_erp: f.nit_erp,
      dias_antiguedad: dias,
      promedio_comunidad: promedio,
      semaforo,
      mensaje,
    });
  }

  // Ordenar: rojos primero, luego amarillos, luego por días descendente
  alertas.sort((a, b) => {
    const prioridad = { rojo: 0, amarillo: 1, verde: 2 };
    if (prioridad[a.semaforo] !== prioridad[b.semaforo]) {
      return prioridad[a.semaforo] - prioridad[b.semaforo];
    }
    return b.dias_antiguedad - a.dias_antiguedad;
  });

  return alertas;
}
