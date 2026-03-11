"use server";

import { createClient } from "@/lib/supabase-server";
import { validarFactura } from "@/lib/validador-glosas";
import { tieneFeature } from "@/lib/suscripcion";
import { devLog, devError } from "@/lib/logger";
import { getContextoOrg } from "@/lib/organizacion";
import type { ResultadoValidacion, FacturaResumen, ValidacionPreRadicacionDB } from "@/lib/types/glosas";

// ==========================================
// MIS PENDIENTES — Vista unificada
// ==========================================

export interface PendienteItem {
  id: string;
  tipo: 'factura_borrador' | 'glosa_pendiente' | 'alerta_radicacion' | 'glosa_irregular';
  titulo: string;
  subtitulo: string;
  valor: number;
  urgencia: 'normal' | 'urgente' | 'vencida';
  diasRestantes: number | null;
  accion: { label: string; href: string };
  meta?: Record<string, unknown>;
}

export interface ResumenPendientes {
  kpis: {
    totalFacturado: number;
    totalGlosado: number;
    tasaGlosas: number;
    pendientesTotal: number;
    facturasBorrador: number;
    glosasRecibidasPendientes: number;
    glosasRecibidasVencidas: number;
  };
  pendientes: PendienteItem[];
}

/** Vista unificada "Mis Pendientes" — una sola llamada al server
 *  TODO: Considerar crear vista SQL `v_pendientes_usuario` en Supabase para mover
 *  la lógica de KPIs y urgencia al DB y reducir las 3 queries a 1.
 */
export async function obtenerMisPendientes(
  opciones?: { limite?: number; mesesAtras?: number }
): Promise<ResumenPendientes> {
  const limite = opciones?.limite ?? 100;
  const mesesAtras = opciones?.mesesAtras ?? 12;

  const supabase = await createClient();
  const ctx = await getContextoOrg();
  const emptyResult: ResumenPendientes = { kpis: { totalFacturado: 0, totalGlosado: 0, tasaGlosas: 0, pendientesTotal: 0, facturasBorrador: 0, glosasRecibidasPendientes: 0, glosasRecibidasVencidas: 0 }, pendientes: [] };

  // Feature gate: requiere ia_sugerencias_glosas
  if (!await tieneFeature(ctx.orgId, "ia_sugerencias_glosas")) {
    return emptyResult;
  }

  const pendientes: PendienteItem[] = [];
  const hoy = new Date();
  const fechaLimite = new Date(hoy);
  fechaLimite.setMonth(fechaLimite.getMonth() - mesesAtras);
  const fechaLimiteISO = fechaLimite.toISOString().slice(0, 10);

  // ── 1. Facturas (últimos N meses, máx 100) ──
  const { data: facturas } = await supabase
    .from('facturas')
    .select('id, num_factura, fecha_expedicion, fecha_limite_rad, valor_total, valor_glosado, estado')
    .eq('organizacion_id', ctx.orgId)
    .gte('fecha_expedicion', fechaLimiteISO)
    .limit(100);

  const allFacturas = facturas || [];
  const totalFacturado = allFacturas.reduce((s, f) => s + Number(f.valor_total), 0);
  const totalGlosado = allFacturas.reduce((s, f) => s + Number(f.valor_glosado || 0), 0);
  const radicadas = allFacturas.filter(f => f.estado !== 'borrador').length;
  const glosadas = allFacturas.filter(f => f.estado === 'glosada').length;
  const tasaGlosas = radicadas > 0 ? Math.round((glosadas / radicadas) * 10000) / 100 : 0;

  // Facturas borrador → pendientes de validar/radicar
  const borrador = allFacturas.filter(f => f.estado === 'borrador');
  for (const f of borrador) {
    let urgencia: 'normal' | 'urgente' | 'vencida' = 'normal';
    let diasRestantes: number | null = null;
    if (f.fecha_limite_rad) {
      const limite = new Date(f.fecha_limite_rad);
      const diffMs = limite.getTime() - hoy.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) urgencia = 'vencida';
      else if (diasRestantes <= 5) urgencia = 'urgente';
    }
    pendientes.push({
      id: f.id,
      tipo: 'factura_borrador',
      titulo: `Factura ${f.num_factura || 'sin número'}`,
      subtitulo: urgencia === 'vencida'
        ? `Venció hace ${Math.abs(diasRestantes!)}d — Validar y radicar`
        : diasRestantes !== null
          ? `${diasRestantes}d para radicar`
          : 'Sin fecha límite — Validar y radicar',
      valor: Number(f.valor_total),
      urgencia,
      diasRestantes,
      accion: { label: 'Validar', href: '/validar-factura' },
    });
  }

  // Alertas de radicación: facturas borrador con deadline cercano (ya capturadas arriba)

  // ── 2. Glosas pendientes (tabla glosas — últimos N meses, máx 100) ──
  const { data: glosasData } = await supabase
    .from('glosas')
    .select(`
      id, codigo_causal, valor_glosado, fecha_formulacion,
      fecha_limite_resp, estado, tipo, descripcion_erp, factura_id,
      facturas!inner(num_factura, fecha_radicacion, organizacion_id)
    `)
    .eq('facturas.organizacion_id', ctx.orgId)
    .gte('fecha_formulacion', fechaLimiteISO)
    .limit(100);

  const allGlosas = glosasData || [];

  // Pendientes de respuesta
  const glosaPendientes = allGlosas.filter(g => g.estado === 'pendiente' || g.estado === 'en_revision');
  for (const g of glosaPendientes) {
    const facturaInfo = g.facturas as unknown as Record<string, unknown>;
    let urgencia: 'normal' | 'urgente' | 'vencida' = 'normal';
    let diasRestantes: number | null = null;
    if (g.fecha_limite_resp) {
      const limite = new Date(g.fecha_limite_resp as string);
      const diffMs = limite.getTime() - hoy.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) urgencia = 'vencida';
      else if (diasRestantes <= 3) urgencia = 'urgente';
    }
    pendientes.push({
      id: g.id as string,
      tipo: 'glosa_pendiente',
      titulo: `Glosa ${g.codigo_causal} — Fact. ${facturaInfo?.num_factura || ''}`,
      subtitulo: g.descripcion_erp
        ? String(g.descripcion_erp).slice(0, 80)
        : (g.tipo === 'devolucion' ? 'Devolución' : 'Glosa') + ' pendiente de respuesta',
      valor: Number(g.valor_glosado),
      urgencia,
      diasRestantes,
      accion: { label: 'Responder', href: '/glosas' },
      meta: { tipo: g.tipo, codigo_causal: g.codigo_causal },
    });
  }

  // Irregularidades
  for (const g of allGlosas) {
    const facturaInfo = g.facturas as unknown as Record<string, unknown>;
    const fechaRadicacion = facturaInfo?.fecha_radicacion
      ? new Date(facturaInfo.fecha_radicacion as string)
      : null;
    const fechaFormulacion = new Date(g.fecha_formulacion as string);

    if (fechaRadicacion) {
      let diasHabiles = 0;
      const d = new Date(fechaRadicacion);
      while (d < fechaFormulacion) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) diasHabiles++;
      }
      const esExtemporanea = g.tipo === 'devolucion' ? diasHabiles > 5 : diasHabiles > 20;
      if (esExtemporanea) {
        const tipoIrreg = g.tipo === 'devolucion' ? 'Devolución extemporánea' : 'Glosa extemporánea';
        const maxDias = g.tipo === 'devolucion' ? 5 : 20;
        pendientes.push({
          id: `irreg-${g.id}`,
          tipo: 'glosa_irregular',
          titulo: `${tipoIrreg} — Fact. ${facturaInfo?.num_factura || ''}`,
          subtitulo: `${diasHabiles} días hábiles (máx. legal: ${maxDias}). Aplica silencio positivo.`,
          valor: Number(g.valor_glosado),
          urgencia: 'urgente',
          diasRestantes: null,
          accion: { label: 'Ver detalle', href: '/glosas' },
          meta: { codigo_causal: g.codigo_causal, diasHabiles },
        });
      }
    }
  }

  // ── 3. Glosas recibidas pendientes (Capa 3 — filtrada por usuario, máx 100) ──
  let glosasRecibidasPendientes = 0;
  let glosasRecibidasVencidas = 0;
  try {
    const { data: glosasRecibidas } = await supabase
      .from('glosas_recibidas')
      .select('id, estado, valor_glosado, codigo_glosa, fecha_notificacion, factura_id')
      .eq('organizacion_id', ctx.orgId)
      .limit(100);

    if (glosasRecibidas) {
      glosasRecibidasPendientes = glosasRecibidas.filter(g => g.estado === 'pendiente').length;
      glosasRecibidasVencidas = glosasRecibidas.filter(g => g.estado === 'vencida').length;
    }
  } catch (e) {
    devError("[obtenerInventarioGlosas]", "Error consultando glosas_recibidas", e);
  }

  // ── Ordenar: vencidas primero, luego urgentes, luego normales ──
  const prioridad = { vencida: 0, urgente: 1, normal: 2 };
  pendientes.sort((a, b) => {
    const pa = prioridad[a.urgencia];
    const pb = prioridad[b.urgencia];
    if (pa !== pb) return pa - pb;
    return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
  });

  // Aplicar límite al listado de pendientes
  const pendientesLimitados = pendientes.slice(0, limite);

  return {
    kpis: {
      totalFacturado,
      totalGlosado,
      tasaGlosas,
      pendientesTotal: pendientes.length,
      facturasBorrador: borrador.length,
      glosasRecibidasPendientes,
      glosasRecibidasVencidas,
    },
    pendientes: pendientesLimitados,
  };
}

// Legacy functions removed — all functionality merged into obtenerMisPendientes()

// ==========================================
// VALIDACIÓN PRE-RADICACIÓN — Server Actions
// ==========================================

/**
 * Carga datos de factura y ejecuta validación completa anti-glosas.
 * Obtiene acuerdo de voluntades, tarifas, reglas de coherencia,
 * y facturas existentes para detección de duplicados.
 */
export async function validarFacturaPorId(facturaId: string): Promise<ResultadoValidacion | null> {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    // 1. Obtener factura con verificación de propiedad
    const { data: factura, error: errorFactura } = await supabase
      .from('facturas')
      .select('*')
      .eq('id', facturaId)
      .eq('organizacion_id', ctx.orgId)
      .single();

    if (errorFactura || !factura) {
      devLog('[validarFacturaPorId]', 'Factura no encontrada o no autorizada:', facturaId);
      return null;
    }

    // 2. Buscar acuerdo de voluntades vigente para prestador + EPS
    let acuerdoData: {
      id: string;
      eps_codigo: string;
      nombre_eps: string | null;
      fecha_inicio: string;
      fecha_fin: string;
      requiere_autorizacion: boolean;
      tarifas: { cups_codigo: string; valor_pactado: number }[];
    } | undefined;

    try {
      const { data: acuerdo } = await supabase
        .from('acuerdos_voluntades')
        .select('id, eps_codigo, nombre_eps, fecha_inicio, fecha_fin, requiere_autorizacion')
        .eq('prestador_id', ctx.orgId)
        .eq('eps_codigo', factura.nit_erp)
        .eq('activo', true)
        .order('fecha_fin', { ascending: false })
        .limit(1)
        .single();

      if (acuerdo) {
        // 3. Obtener tarifas del acuerdo
        const { data: tarifas } = await supabase
          .from('acuerdo_tarifas')
          .select('cups_codigo, valor_pactado')
          .eq('acuerdo_id', acuerdo.id);

        acuerdoData = {
          ...acuerdo,
          tarifas: tarifas ?? [],
        };
      }
    } catch (e) {
      devError('[validarFacturaPorId]', 'Tabla acuerdos_voluntades no disponible', e);
    }

    // 4. Obtener reglas de coherencia (graceful si tabla no existe)
    let reglasCoherencia;
    try {
      const { data: reglas } = await supabase
        .from('reglas_coherencia')
        .select('*')
        .eq('activo', true);
      reglasCoherencia = reglas ?? undefined;
    } catch (e) {
      devError('[validarFacturaPorId]', 'Tabla reglas_coherencia no disponible', e);
    }

    // 5. Obtener facturas existentes para detección de duplicados
    const { data: facturasExistentes } = await supabase
      .from('facturas')
      .select('num_factura, estado')
      .eq('organizacion_id', ctx.orgId)
      .neq('id', facturaId);

    // 6. Ejecutar validación
    const resultado = validarFactura({
      factura,
      acuerdo: acuerdoData,
      reglasCoherencia,
      facturasExistentes: facturasExistentes ?? undefined,
    });

    devLog('[validarFacturaPorId]', `Validación completada — ${resultado.errores} errores, ${resultado.advertencias} advertencias, riesgo: ${resultado.puntaje_riesgo_glosa}`);

    // 7. Guardar resultado (graceful si tabla no existe)
    try {
      await supabase
        .from('validaciones_factura')
        .insert({
          factura_id: facturaId,
          user_id: ctx.userId,
          resultado_json: resultado,
          errores: resultado.errores,
          advertencias: resultado.advertencias,
          puntaje_riesgo: resultado.puntaje_riesgo_glosa,
          puede_radicar: resultado.puede_radicar,
          created_at: new Date().toISOString(),
        });
    } catch (e) {
      devError('[validarFacturaPorId]', 'Tabla validaciones_factura no disponible — resultado no persistido', e);
    }

    return resultado;
  } catch (error) {
    devError('[validarFacturaPorId]', 'Error inesperado:', error);
    return null;
  }
}

/**
 * Obtiene facturas pendientes de validación del usuario autenticado.
 * Retorna facturas en estado borrador o radicada, ordenadas por fecha.
 */
export async function obtenerFacturasPendientesValidacion(): Promise<FacturaResumen[]> {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    const { data: facturas, error } = await supabase
      .from('facturas')
      .select('id, num_factura, fecha_expedicion, nit_erp, valor_total, estado')
      .eq('organizacion_id', ctx.orgId)
      .in('estado', ['borrador', 'radicada', 'devuelta'])
      .order('created_at', { ascending: false });

    if (error || !facturas) {
      devLog('[obtenerFacturasPendientesValidacion]', 'Error o sin facturas:', error?.message);
      return [];
    }

    // Intentar enriquecer con última validación
    let validacionesMap = new Map<string, string>();
    try {
      const facturaIds = facturas.map(f => f.id);
      if (facturaIds.length > 0) {
        const { data: validaciones } = await supabase
          .from('validaciones_factura')
          .select('factura_id, created_at')
          .in('factura_id', facturaIds)
          .order('created_at', { ascending: false });

        if (validaciones) {
          for (const v of validaciones) {
            if (!validacionesMap.has(v.factura_id)) {
              validacionesMap.set(v.factura_id, v.created_at);
            }
          }
        }
      }
    } catch (e) {
      devError('[obtenerFacturasPendientesValidacion]', 'Tabla validaciones_factura no disponible', e);
      validacionesMap = new Map();
    }

    return facturas.map(f => ({
      id: f.id,
      num_factura: f.num_factura,
      fecha_expedicion: f.fecha_expedicion,
      nit_erp: f.nit_erp,
      valor_total: Number(f.valor_total),
      estado: f.estado,
      ultima_validacion: validacionesMap.get(f.id),
    }));
  } catch (error) {
    devError('[obtenerFacturasPendientesValidacion]', 'Error inesperado:', error);
    return [];
  }
}

/**
 * Obtiene historial de validaciones ejecutadas para una factura.
 * Retorna array de hallazgos ordenados por fecha descendente.
 */
export async function obtenerHistorialValidaciones(facturaId: string): Promise<ValidacionPreRadicacionDB[]> {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    // Verificar que la factura pertenece a la organización
    const { data: factura } = await supabase
      .from('facturas')
      .select('id')
      .eq('id', facturaId)
      .eq('organizacion_id', ctx.orgId)
      .single();

    if (!factura) return [];

    // Intentar obtener validaciones
    try {
      const { data: validaciones } = await supabase
        .from('validaciones_factura')
        .select('*')
        .eq('factura_id', facturaId)
        .order('created_at', { ascending: false });

      if (!validaciones) return [];

      // Mapear a ValidacionPreRadicacionDB
      return validaciones.map((v: Record<string, unknown>) => ({
        id: v.id as string,
        factura_id: v.factura_id as string,
        codigo_causal: (v.resultado_json as Record<string, unknown>)?.glosas_potenciales_prevenidas
          ? ((v.resultado_json as Record<string, unknown>).glosas_potenciales_prevenidas as string[]).join(', ')
          : '',
        severidad: ((v.errores as number) > 0 ? 'error' : 'advertencia') as 'error' | 'advertencia' | 'info',
        mensaje: `Validación: ${v.errores} errores, ${v.advertencias} advertencias. Riesgo: ${v.puntaje_riesgo}%`,
        campo_afectado: null,
        valor_encontrado: null,
        valor_esperado: null,
        resuelta: (v.puede_radicar as boolean) ?? false,
        resuelta_en: null,
        resuelta_por: null,
        created_at: v.created_at as string,
      }));
    } catch (e) {
      devError('[obtenerHistorialValidaciones]', 'Tabla validaciones_factura no disponible', e);
      return [];
    }
  } catch (error) {
    devError('[obtenerHistorialValidaciones]', 'Error inesperado:', error);
    return [];
  }
}
