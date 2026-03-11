"use server";

import { createClient } from "@/lib/supabase-server";
import { getContextoOrg } from "@/lib/organizacion";

// ==========================================
// BENCHMARKS — Server Actions (Inteligencia Colectiva)
// ==========================================

export interface BenchmarkEPS {
  eps_codigo: string;
  tasa_glosa_comunidad: number;
  tasa_glosa_usuario: number;
  promedio_dias_pago: number;
  mediana_dias_pago: number;
  percentil_90_dias: number;
  dias_pago_usuario: number;
  top_causales: { causal: string; frecuencia: number; porcentaje: number }[];
}

export interface TarifaReferencia {
  eps_codigo: string;
  cups_codigo: string;
  valor_promedio: number;
  valor_min: number;
  valor_max: number;
  total_registros: number;
}

export interface ResumenBenchmark {
  eps_codigo: string;
  eps_nombre: string;
  tasa_glosa_comunidad: number;
  tasa_glosa_usuario: number;
  promedio_dias_pago: number;
  dias_pago_usuario: number;
  causal_principal: string | null;
}

/**
 * Obtiene benchmark de una EPS específica + comparativa vs datos del usuario.
 */
export async function obtenerBenchmarkEPS(
  epsCodigo: string,
): Promise<BenchmarkEPS | null> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Benchmark de comunidad
  const [tasaRes, diasRes, causalesRes] = await Promise.all([
    supabase
      .from("mv_tasa_glosa_por_eps" as never)
      .select("*")
      .eq("eps_codigo", epsCodigo)
      .single(),
    supabase
      .from("mv_dias_pago_por_eps" as never)
      .select("*")
      .eq("eps_codigo", epsCodigo)
      .single(),
    supabase
      .from("mv_causales_frecuentes" as never)
      .select("*")
      .eq("eps_codigo", epsCodigo)
      .order("frecuencia", { ascending: false })
      .limit(5),
  ]);

  // Si no hay datos de comunidad, devolver null
  if (tasaRes.error && diasRes.error) return null;

  const tasa = tasaRes.data as { tasa_glosa_pct: number } | null;
  const dias = diasRes.data as {
    promedio_dias: number;
    mediana_dias: number;
    percentil_90_dias: number;
  } | null;
  const causales = (causalesRes.data || []) as {
    causal: string;
    frecuencia: number;
    porcentaje_del_total: number;
  }[];

  // Datos del usuario para comparar
  const { data: facturasUser } = await supabase
    .from("facturas")
    .select("id, valor_total, estado, metadata, created_at")
    .eq("organizacion_id", ctx.orgId)
    .eq("nit_erp", epsCodigo)
    .neq("estado", "borrador");

  const totalFacturasUser = facturasUser?.length || 0;

  const facturaIds = facturasUser?.map((f) => f.id) || [];
  let glosasUser = 0;
  if (facturaIds.length > 0) {
    const { count } = await supabase
      .from("glosas_recibidas")
      .select("id", { count: "exact", head: true })
      .eq("organizacion_id", ctx.orgId)
      .in("factura_id", facturaIds);
    glosasUser = count || 0;
  }

  const tasaUsuario =
    totalFacturasUser > 0
      ? Math.round((glosasUser / totalFacturasUser) * 100 * 100) / 100
      : 0;

  // Promedio días pago del usuario
  let diasPagoUsuario = 0;
  if (facturaIds.length > 0) {
    const { data: pagosUser } = await supabase
      .from("pagos")
      .select("factura_id, fecha_pago")
      .eq("organizacion_id", ctx.orgId)
      .in("factura_id", facturaIds);

    if (pagosUser && pagosUser.length > 0) {
      const facturaMap = new Map(
        facturasUser!.map((f) => [f.id, f]),
      );
      let sumaDias = 0;
      let count = 0;
      for (const p of pagosUser) {
        const f = facturaMap.get(p.factura_id);
        if (f) {
          const meta = f.metadata as Record<string, unknown> | null;
          const fechaRef = (meta?.fecha_radicacion as string) || f.created_at;
          const diasPago = Math.ceil(
            (new Date(p.fecha_pago).getTime() - new Date(fechaRef).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          sumaDias += diasPago;
          count++;
        }
      }
      diasPagoUsuario = count > 0 ? Math.round(sumaDias / count) : 0;
    }
  }

  return {
    eps_codigo: epsCodigo,
    tasa_glosa_comunidad: tasa?.tasa_glosa_pct ?? 0,
    tasa_glosa_usuario: tasaUsuario,
    promedio_dias_pago: dias?.promedio_dias ?? 0,
    mediana_dias_pago: dias?.mediana_dias ?? 0,
    percentil_90_dias: dias?.percentil_90_dias ?? 0,
    dias_pago_usuario: diasPagoUsuario,
    top_causales: causales.map((c) => ({
      causal: c.causal,
      frecuencia: c.frecuencia,
      porcentaje: c.porcentaje_del_total,
    })),
  };
}

/**
 * Obtiene tarifa de referencia de la comunidad para un CUPS+EPS.
 */
export async function obtenerTarifaReferencia(
  cupsCodigo: string,
  epsCodigo: string,
): Promise<TarifaReferencia | null> {
  await getContextoOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mv_tarifa_real_por_cups" as never)
    .select("*")
    .eq("eps_codigo", epsCodigo)
    .eq("cups_codigo", cupsCodigo)
    .single();

  if (error || !data) return null;

  const row = data as {
    eps_codigo: string;
    cups_codigo: string;
    valor_promedio: number;
    valor_min: number;
    valor_max: number;
    total_registros: number;
  };

  return {
    eps_codigo: row.eps_codigo,
    cups_codigo: row.cups_codigo,
    valor_promedio: row.valor_promedio,
    valor_min: row.valor_min,
    valor_max: row.valor_max,
    total_registros: row.total_registros,
  };
}

/**
 * Obtiene resumen de benchmarks para las EPSs del usuario (dashboard).
 */
export async function obtenerResumenBenchmarks(): Promise<ResumenBenchmark[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // EPS del usuario
  const { data: facturasEps } = await supabase
    .from("facturas")
    .select("nit_erp, metadata")
    .eq("organizacion_id", ctx.orgId)
    .neq("estado", "borrador");

  if (!facturasEps || facturasEps.length === 0) return [];

  // Agrupar por EPS
  const epsMap = new Map<string, { codigo: string; nombre: string; total: number; glosadas: number }>();
  for (const f of facturasEps) {
    const meta = f.metadata as Record<string, unknown> | null;
    const nombre = (meta?.eps_nombre as string) || f.nit_erp;
    if (!epsMap.has(f.nit_erp)) {
      epsMap.set(f.nit_erp, { codigo: f.nit_erp, nombre, total: 0, glosadas: 0 });
    }
    epsMap.get(f.nit_erp)!.total++;
  }

  const epsCodigos = Array.from(epsMap.keys());

  // Consultar benchmarks de comunidad
  const [tasasRes, diasRes, causalesRes] = await Promise.all([
    supabase
      .from("mv_tasa_glosa_por_eps" as never)
      .select("*")
      .in("eps_codigo", epsCodigos),
    supabase
      .from("mv_dias_pago_por_eps" as never)
      .select("*")
      .in("eps_codigo", epsCodigos),
    supabase
      .from("mv_causales_frecuentes" as never)
      .select("*")
      .in("eps_codigo", epsCodigos)
      .order("frecuencia", { ascending: false }),
  ]);

  const tasas = new Map(
    ((tasasRes.data || []) as { eps_codigo: string; tasa_glosa_pct: number }[]).map(
      (t) => [t.eps_codigo, t.tasa_glosa_pct],
    ),
  );
  const diasPago = new Map(
    ((diasRes.data || []) as { eps_codigo: string; promedio_dias: number }[]).map(
      (d) => [d.eps_codigo, d.promedio_dias],
    ),
  );
  const causalPrincipal = new Map<string, string>();
  for (const c of (causalesRes.data || []) as { eps_codigo: string; causal: string }[]) {
    if (!causalPrincipal.has(c.eps_codigo)) {
      causalPrincipal.set(c.eps_codigo, c.causal);
    }
  }

  // Glosas del usuario por EPS
  const facturaIds = facturasEps.map((f) => f.nit_erp);
  const { data: glosasUser } = await supabase
    .from("glosas_recibidas")
    .select("factura_id, facturas!inner(nit_erp)")
    .eq("organizacion_id", ctx.orgId);

  if (glosasUser) {
    for (const g of glosasUser) {
      const nitErp = (g as unknown as { facturas: { nit_erp: string } }).facturas?.nit_erp;
      if (nitErp && epsMap.has(nitErp)) {
        epsMap.get(nitErp)!.glosadas++;
      }
    }
  }

  // Días pago del usuario
  const { data: pagosUser } = await supabase
    .from("pagos")
    .select("fecha_pago, facturas!inner(nit_erp, metadata, created_at)")
    .eq("organizacion_id", ctx.orgId);

  const diasPagoUser = new Map<string, number[]>();
  if (pagosUser) {
    for (const p of pagosUser) {
      const f = (p as unknown as { facturas: { nit_erp: string; metadata: Record<string, unknown>; created_at: string } }).facturas;
      if (f) {
        const fechaRef = (f.metadata?.fecha_radicacion as string) || f.created_at;
        const dias = Math.ceil(
          (new Date(p.fecha_pago).getTime() - new Date(fechaRef).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (!diasPagoUser.has(f.nit_erp)) diasPagoUser.set(f.nit_erp, []);
        diasPagoUser.get(f.nit_erp)!.push(dias);
      }
    }
  }

  const resultados: ResumenBenchmark[] = [];
  for (const [codigo, info] of epsMap) {
    const tasaComunidad = tasas.get(codigo);
    const diasComunidad = diasPago.get(codigo);
    // Solo incluir EPS que tengan benchmark disponible
    if (tasaComunidad === undefined && diasComunidad === undefined) continue;

    const diasUserArr = diasPagoUser.get(codigo);
    const avgDiasUser =
      diasUserArr && diasUserArr.length > 0
        ? Math.round(diasUserArr.reduce((a, b) => a + b, 0) / diasUserArr.length)
        : 0;

    resultados.push({
      eps_codigo: codigo,
      eps_nombre: info.nombre,
      tasa_glosa_comunidad: tasaComunidad ?? 0,
      tasa_glosa_usuario:
        info.total > 0
          ? Math.round((info.glosadas / info.total) * 100 * 100) / 100
          : 0,
      promedio_dias_pago: diasComunidad ?? 0,
      dias_pago_usuario: avgDiasUser,
      causal_principal: causalPrincipal.get(codigo) ?? null,
    });
  }

  return resultados;
}
