"use server";

import { createClient } from "@/lib/supabase-server";
import { obtenerKPICartera } from "@/app/actions/pagos";
import { getContextoOrg } from "@/lib/organizacion";
import type { KPIDashboard, FacturacionMensual, DistribucionEPS, ItemAtencion } from "@/lib/types/dashboard";

// ==========================================
// DASHBOARD — Server Actions
// ==========================================

/** Obtiene los KPIs principales del dashboard */
export async function obtenerKPIsDashboard(): Promise<KPIDashboard> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();
  const emptyKPI: KPIDashboard = { facturas_mes: 0, valor_facturado_mes: 0, pendientes_descarga: 0, glosas_activas: 0, valor_glosado_activo: 0, tasa_recuperacion: 0, cartera_pendiente: 0, facturas_en_cartera: 0 };

  const inicioMes = new Date();
  inicioMes.setDate(1);
  const inicioMesStr = inicioMes.toISOString().split("T")[0];

  // Facturas del mes
  const { data: facturasMes } = await supabase
    .from("facturas")
    .select("valor_total")
    .eq("organizacion_id", ctx.orgId)
    .gte("fecha_expedicion", inicioMesStr)
    .neq("estado", "anulada");

  const facturas_mes = facturasMes?.length || 0;
  const valor_facturado_mes = facturasMes?.reduce((s, f) => s + (f.valor_total || 0), 0) || 0;

  // Pendientes descarga (aprobadas no descargadas)
  const { count: pendientes } = await supabase
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .eq("organizacion_id", ctx.orgId)
    .eq("estado", "aprobada");

  // Glosas activas
  const { data: glosasActivas } = await supabase
    .from("glosas_recibidas")
    .select("valor_glosado")
    .eq("organizacion_id", ctx.orgId)
    .in("estado", ["pendiente", "en_revision"]);

  const glosas_activas = glosasActivas?.length || 0;
  const valor_glosado_activo = glosasActivas?.reduce((s, g) => s + (g.valor_glosado || 0), 0) || 0;

  // Tasa de recuperación
  const { data: respuestas } = await supabase
    .from("respuestas_glosas")
    .select("estado")
    .eq("organizacion_id", ctx.orgId);

  const totalResp = respuestas?.length || 0;
  const recuperadas = respuestas?.filter((r) => r.estado === "aceptada" || r.estado === "resuelta_a_favor").length || 0;
  const tasa_recuperacion = totalResp > 0 ? Math.round((recuperadas / totalResp) * 100) : 0;

  // Cartera pendiente
  const cartera = await obtenerKPICartera();

  return {
    facturas_mes,
    valor_facturado_mes,
    pendientes_descarga: pendientes || 0,
    glosas_activas,
    valor_glosado_activo,
    tasa_recuperacion,
    cartera_pendiente: cartera.valor_pendiente,
    facturas_en_cartera: cartera.facturas_pendientes,
  };
}

/** Obtiene facturación mensual para gráfico de barras */
export async function obtenerFacturacionMensual(meses = 6): Promise<FacturacionMensual[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses + 1);
  desde.setDate(1);
  const desdeStr = desde.toISOString().split("T")[0];

  const { data } = await supabase
    .from("facturas")
    .select("fecha_expedicion, valor_total")
    .eq("organizacion_id", ctx.orgId)
    .gte("fecha_expedicion", desdeStr)
    .neq("estado", "anulada")
    .order("fecha_expedicion");

  if (!data) return [];

  const mesesLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const agrupado: Record<string, { cantidad: number; valor_total: number }> = {};

  for (const f of data) {
    const fecha = new Date(f.fecha_expedicion + "T00:00:00");
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    if (!agrupado[key]) agrupado[key] = { cantidad: 0, valor_total: 0 };
    agrupado[key].cantidad++;
    agrupado[key].valor_total += f.valor_total || 0;
  }

  return Object.entries(agrupado)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, vals]) => ({
      mes,
      mes_label: mesesLabels[parseInt(mes.split("-")[1] ?? "1") - 1] || mes,
      cantidad: vals.cantidad,
      valor_total: vals.valor_total,
    }));
}

/** Obtiene distribución de facturación por EPS */
export async function obtenerDistribucionEPS(): Promise<DistribucionEPS[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const inicioMes = new Date();
  inicioMes.setDate(1);

  const { data } = await supabase
    .from("facturas")
    .select("nit_erp, valor_total, metadata")
    .eq("organizacion_id", ctx.orgId)
    .gte("fecha_expedicion", inicioMes.toISOString().split("T")[0])
    .neq("estado", "anulada");

  if (!data) return [];

  const agrupado: Record<string, { eps_nombre: string; valor_total: number; cantidad: number }> = {};

  for (const f of data) {
    const nit = f.nit_erp || "SIN_EPS";
    if (!agrupado[nit]) {
      const meta = f.metadata as Record<string, string> | null;
      agrupado[nit] = { eps_nombre: meta?.eps_nombre || nit, valor_total: 0, cantidad: 0 };
    }
    agrupado[nit].valor_total += f.valor_total || 0;
    agrupado[nit].cantidad++;
  }

  return Object.entries(agrupado).map(([nit, vals]) => ({
    nit_erp: nit,
    ...vals,
  }));
}

/** Obtiene items que requieren atención */
export async function obtenerItemsAtencion(): Promise<ItemAtencion[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const items: ItemAtencion[] = [];
  const hoy = new Date();

  // Glosas por vencer (≤5 días)
  const { data: glosas } = await supabase
    .from("glosas_recibidas")
    .select("id, numero_glosa, fecha_limite_respuesta, valor_glosado")
    .eq("organizacion_id", ctx.orgId)
    .in("estado", ["pendiente", "en_revision"])
    .not("fecha_limite_respuesta", "is", null);

  for (const g of glosas || []) {
    const limite = new Date(g.fecha_limite_respuesta);
    const dias = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 5) {
      items.push({
        id: g.id,
        tipo: "glosa_por_vencer",
        titulo: `Glosa ${g.numero_glosa}`,
        descripcion: `Vence en ${dias} día${dias !== 1 ? "s" : ""} — $${g.valor_glosado?.toLocaleString() || 0}`,
        fecha_limite: g.fecha_limite_respuesta,
        dias_restantes: dias,
        url: `/glosas`,
        urgencia: dias <= 2 ? "alta" : dias <= 4 ? "media" : "baja",
      });
    }
  }

  // Facturas borradores antiguas (>3 días)
  const hace3dias = new Date();
  hace3dias.setDate(hace3dias.getDate() - 3);

  const { data: borradores } = await supabase
    .from("facturas")
    .select("id, num_factura, created_at, valor_total")
    .eq("organizacion_id", ctx.orgId)
    .eq("estado", "borrador")
    .lte("created_at", hace3dias.toISOString());

  for (const b of borradores || []) {
    const creado = new Date(b.created_at);
    const dias = Math.ceil((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
    items.push({
      id: b.id,
      tipo: "factura_borrador_antigua",
      titulo: `Factura ${b.num_factura}`,
      descripcion: `Borrador hace ${dias} días — $${b.valor_total?.toLocaleString() || 0}`,
      fecha_limite: null,
      dias_restantes: null,
      url: `/facturas/${b.id}`,
      urgencia: dias > 7 ? "alta" : "media",
    });
  }

  // Cartera vencida (>60 días sin pago)
  const hace60dias = new Date();
  hace60dias.setDate(hace60dias.getDate() - 60);

  const { data: facturasVencidas } = await supabase
    .from("facturas")
    .select("id, num_factura, valor_total, created_at, metadata")
    .eq("organizacion_id", ctx.orgId)
    .in("estado", ["radicada", "pagada_parcial"])
    .lte("created_at", hace60dias.toISOString());

  for (const f of facturasVencidas || []) {
    const meta = f.metadata as Record<string, string> | null;
    const fechaRef = meta?.fecha_radicacion || f.created_at;
    const dias = Math.ceil((hoy.getTime() - new Date(fechaRef).getTime()) / (1000 * 60 * 60 * 24));
    if (dias > 60) {
      items.push({
        id: f.id,
        tipo: "cartera_vencida",
        titulo: `Factura ${f.num_factura}`,
        descripcion: `${dias} días sin pago — $${f.valor_total?.toLocaleString() || 0}`,
        fecha_limite: null,
        dias_restantes: null,
        url: `/pagos`,
        urgencia: dias > 90 ? "alta" : "media",
      });
    }
  }

  // Acuerdos por vencer (<30 días)
  const en30dias = new Date();
  en30dias.setDate(hoy.getDate() + 30);

  const { data: acuerdos } = await supabase
    .from("acuerdos_voluntades")
    .select("id, nombre_eps, fecha_fin")
    .eq("prestador_id", ctx.orgId)
    .eq("activo", true)
    .lte("fecha_fin", en30dias.toISOString().split("T")[0]);

  for (const a of acuerdos || []) {
    const vence = new Date(a.fecha_fin + "T23:59:59");
    const dias = Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 30) {
      items.push({
        id: a.id,
        tipo: "acuerdo_por_vencer",
        titulo: `Acuerdo ${a.nombre_eps}`,
        descripcion: dias <= 0 ? `Acuerdo vencido` : `Vence en ${dias} día${dias !== 1 ? "s" : ""}`,
        fecha_limite: a.fecha_fin,
        dias_restantes: dias,
        url: `/configuracion/acuerdos`,
        urgencia: dias <= 0 ? "alta" : dias <= 7 ? "alta" : "media",
      });
    }
  }

  // Numeración agotándose (<50 consecutivos restantes)
  const { data: resolucion } = await supabase
    .from("resoluciones_facturacion")
    .select("id, prefijo, rango_hasta, consecutivo_actual, rango_inicio")
    .eq("organizacion_id", ctx.orgId)
    .eq("activa", true)
    .single();

  if (resolucion) {
    const actual = resolucion.consecutivo_actual ?? (resolucion.rango_inicio || 1);
    const restantes = (resolucion.rango_hasta || 0) - actual;
    if (restantes < 50) {
      items.push({
        id: resolucion.id,
        tipo: "numeracion_agotandose",
        titulo: `Resolución ${resolucion.prefijo || "(sin prefijo)"}`,
        descripcion: restantes <= 0 ? "Rango agotado" : `Solo ${restantes} número${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}`,
        fecha_limite: null,
        dias_restantes: null,
        url: `/configuracion/perfil`,
        urgencia: restantes <= 10 ? "alta" : "media",
      });
    }
  }

  return items.sort((a, b) => (a.urgencia === "alta" ? -1 : 1) - (b.urgencia === "alta" ? -1 : 1));
}

/** Contadores ligeros para badges del sidebar */
export async function obtenerBadgesSidebar(): Promise<{ glosasUrgentes: number; facturasBorrador: number; carteraVencida: number }> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const hoy = new Date();
  const en5dias = new Date();
  en5dias.setDate(hoy.getDate() + 5);

  const hace60dias = new Date();
  hace60dias.setDate(hoy.getDate() - 60);

  const [{ count: glosasUrgentes }, { count: facturasBorrador }, { count: carteraVencida }] = await Promise.all([
    supabase
      .from("glosas_recibidas")
      .select("id", { count: "exact", head: true })
      .eq("organizacion_id", ctx.orgId)
      .in("estado", ["pendiente", "en_revision"])
      .lte("fecha_limite_respuesta", en5dias.toISOString().split("T")[0]),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organizacion_id", ctx.orgId)
      .eq("estado", "borrador"),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organizacion_id", ctx.orgId)
      .in("estado", ["radicada", "pagada_parcial"])
      .lte("created_at", hace60dias.toISOString()),
  ]);

  return { glosasUrgentes: glosasUrgentes || 0, facturasBorrador: facturasBorrador || 0, carteraVencida: carteraVencida || 0 };
}
