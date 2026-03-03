"use server";

import { createClient } from "@/lib/supabase-server";
import { validarFactura } from "@/lib/validador-glosas";
import { devLog } from "@/lib/logger";
import type { ResultadoValidacion, FacturaResumen, ValidacionPreRadicacionDB } from "@/lib/types/glosas";

// ==========================================
// DASHBOARD DE GLOSAS — Server Actions
// ==========================================

/** Resumen de facturas agrupadas por estado */
export async function obtenerFacturasPorEstado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('facturas')
    .select('estado, valor_total, valor_glosado')
    .eq('user_id', user.id);

  if (error || !data) return {};

  const resumen: Record<string, { cantidad: number; valor: number }> = {};
  for (const f of data) {
    if (!resumen[f.estado]) resumen[f.estado] = { cantidad: 0, valor: 0 };
    const entry = resumen[f.estado]!;
    entry.cantidad++;
    entry.valor += Number(f.valor_total);
  }
  return resumen;
}

/** KPIs principales del dashboard de glosas */
export async function obtenerKPIsGlosas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Total facturas y valores
  const { data: facturas } = await supabase
    .from('facturas')
    .select('id, estado, valor_total, valor_glosado')
    .eq('user_id', user.id);

  if (!facturas) return null;

  const totalFacturado = facturas.reduce((s, f) => s + Number(f.valor_total), 0);
  const totalGlosado = facturas.reduce((s, f) => s + Number(f.valor_glosado), 0);
  const radicadas = facturas.filter(f => f.estado !== 'borrador').length;
  const glosadas = facturas.filter(f => f.estado === 'glosada').length;
  const tasaGlosas = radicadas > 0 ? (glosadas / radicadas) * 100 : 0;

  return {
    totalFacturas: facturas.length,
    totalFacturado,
    totalGlosado,
    radicadas,
    glosadas,
    tasaGlosas: Math.round(tasaGlosas * 100) / 100,
  };
}

/** Top 5 causales de glosa más frecuentes */
export async function obtenerTopCausalesGlosa() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Obtener glosas del usuario (via facturas)
  const { data: glosas } = await supabase
    .from('glosas')
    .select(`
      codigo_causal,
      valor_glosado,
      factura_id,
      facturas!inner(user_id)
    `)
    .eq('facturas.user_id', user.id);

  if (!glosas || glosas.length === 0) return [];

  // Agrupar por causal
  const agrupado: Record<string, { cantidad: number; valor: number }> = {};
  for (const g of glosas) {
    if (!agrupado[g.codigo_causal]) agrupado[g.codigo_causal] = { cantidad: 0, valor: 0 };
    const entry = agrupado[g.codigo_causal]!;
    entry.cantidad++;
    entry.valor += Number(g.valor_glosado);
  }

  // Ordenar y tomar top 5
  const top5Codigos = Object.entries(agrupado)
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .slice(0, 5)
    .map(([codigo, stats]) => ({ codigo, ...stats }));

  // Enriquecer con descripciones del catálogo
  const codigos = top5Codigos.map(t => t.codigo);
  const { data: catalogo } = await supabase
    .from('catalogo_causales_glosa')
    .select('codigo, descripcion, concepto')
    .in('codigo', codigos);

  const catalogoMap = new Map((catalogo || []).map(c => [c.codigo, c]));

  return top5Codigos.map(t => ({
    codigo: t.codigo,
    descripcion: catalogoMap.get(t.codigo)?.descripcion || t.codigo,
    concepto: catalogoMap.get(t.codigo)?.concepto || '',
    cantidad: t.cantidad,
    valor: t.valor,
  }));
}

/** Glosas pendientes de respuesta con días restantes */
export async function obtenerGlosasPendientes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('glosas')
    .select(`
      id,
      codigo_causal,
      valor_glosado,
      fecha_formulacion,
      fecha_limite_resp,
      estado,
      tipo,
      descripcion_erp,
      factura_id,
      facturas!inner(num_factura, user_id)
    `)
    .eq('facturas.user_id', user.id)
    .in('estado', ['pendiente', 'en_revision']);

  if (!data) return [];

  const hoy = new Date();
  return data.map((g: Record<string, unknown>) => {
    const limite = g.fecha_limite_resp ? new Date(g.fecha_limite_resp as string) : null;
    let diasRestantes: number | null = null;
    let vencida = false;

    if (limite) {
      // Calcular días hábiles restantes (simple aproximación)
      let dias = 0;
      const d = new Date(hoy);
      while (d < limite) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) dias++;
      }
      if (hoy > limite) {
        dias = -dias;
        vencida = true;
      }
      diasRestantes = dias;
    }

    const facturas = g.facturas as Record<string, unknown>;
    return {
      id: g.id,
      codigo_causal: g.codigo_causal,
      valor_glosado: Number(g.valor_glosado),
      fecha_formulacion: g.fecha_formulacion,
      fecha_limite_resp: g.fecha_limite_resp,
      estado: g.estado,
      tipo: g.tipo,
      descripcion_erp: g.descripcion_erp,
      num_factura: facturas?.num_factura || '',
      diasRestantes,
      vencida,
    };
  }).sort((a: { diasRestantes: number | null }, b: { diasRestantes: number | null }) =>
    (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999)
  );
}

/** Tendencia de glosas por mes (últimos 6 meses) */
export async function obtenerTendenciaGlosas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const hace6Meses = new Date();
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  const { data: glosas } = await supabase
    .from('glosas')
    .select(`
      fecha_formulacion,
      valor_glosado,
      facturas!inner(user_id)
    `)
    .eq('facturas.user_id', user.id)
    .gte('fecha_formulacion', hace6Meses.toISOString());

  if (!glosas) return [];

  // Agrupar por mes
  const meses: Record<string, { cantidad: number; valor: number }> = {};
  for (const g of glosas) {
    const fecha = new Date(g.fecha_formulacion as string);
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!meses[key]) meses[key] = { cantidad: 0, valor: 0 };
    meses[key].cantidad++;
    meses[key].valor += Number(g.valor_glosado);
  }

  // Generar array de 6 meses (incluir meses sin datos)
  const resultado = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const nombreMes = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
    resultado.push({
      mes: nombreMes,
      cantidad: meses[key]?.cantidad || 0,
      valor: meses[key]?.valor || 0,
    });
  }

  return resultado;
}

/** Facturas próximas a vencer plazo de radicación (22 días hábiles) */
export async function obtenerAlertasRadicacion() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('facturas')
    .select('id, num_factura, fecha_expedicion, fecha_limite_rad, valor_total, estado')
    .eq('user_id', user.id)
    .in('estado', ['borrador'])
    .not('fecha_limite_rad', 'is', null);

  if (!data) return [];

  const hoy = new Date();
  return data
    .map(f => {
      const limite = new Date(f.fecha_limite_rad!);
      const diffMs = limite.getTime() - hoy.getTime();
      const diasCalendario = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        id: f.id,
        num_factura: f.num_factura,
        fecha_expedicion: f.fecha_expedicion,
        fecha_limite_rad: f.fecha_limite_rad,
        valor_total: Number(f.valor_total),
        diasRestantes: diasCalendario,
        vencida: diasCalendario < 0,
        urgente: diasCalendario >= 0 && diasCalendario <= 5,
      };
    })
    .filter(f => f.diasRestantes <= 10) // Solo alertas relevantes
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** Detectar glosas extemporáneas o ilegales */
export async function obtenerGlosasIlegales() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: glosas } = await supabase
    .from('glosas')
    .select(`
      id,
      codigo_causal,
      valor_glosado,
      fecha_formulacion,
      fecha_servicio,
      tipo,
      estado,
      descripcion_erp,
      factura_id,
      facturas!inner(num_factura, fecha_radicacion, user_id)
    `)
    .eq('facturas.user_id', user.id);

  if (!glosas) return [];

  const alertas: Array<{
    glosa_id: string;
    num_factura: string;
    codigo_causal: string;
    valor_glosado: number;
    tipo_irregularidad: string;
    detalle: string;
  }> = [];

  for (const g of glosas) {
    const facturas = g.facturas as unknown as Record<string, unknown>;
    const fechaRadicacion = facturas?.fecha_radicacion
      ? new Date(facturas.fecha_radicacion as string)
      : null;
    const fechaFormulacion = new Date(g.fecha_formulacion as string);

    // Glosa extemporánea: formulada más de 20 días hábiles después de radicación
    if (fechaRadicacion) {
      let diasHabiles = 0;
      const d = new Date(fechaRadicacion);
      while (d < fechaFormulacion) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) diasHabiles++;
      }
      if (diasHabiles > 20) {
        alertas.push({
          glosa_id: g.id as string,
          num_factura: (facturas?.num_factura as string) || '',
          codigo_causal: g.codigo_causal as string,
          valor_glosado: Number(g.valor_glosado),
          tipo_irregularidad: 'Extemporánea',
          detalle: `Glosa formulada ${diasHabiles} días hábiles después de radicación (máximo legal: 20 días). Aplica silencio administrativo positivo.`,
        });
      }
    }

    // Devolución extemporánea: más de 5 días hábiles
    if (g.tipo === 'devolucion' && fechaRadicacion) {
      let diasHabiles = 0;
      const d = new Date(fechaRadicacion);
      while (d < fechaFormulacion) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) diasHabiles++;
      }
      if (diasHabiles > 5) {
        alertas.push({
          glosa_id: g.id as string,
          num_factura: (facturas?.num_factura as string) || '',
          codigo_causal: g.codigo_causal as string,
          valor_glosado: Number(g.valor_glosado),
          tipo_irregularidad: 'Devolución extemporánea',
          detalle: `Devolución formulada ${diasHabiles} días hábiles después de radicación (máximo legal: 5 días). Se debe rechazar.`,
        });
      }
    }
  }

  return alertas;
}

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Obtener factura con verificación de propiedad
    const { data: factura, error: errorFactura } = await supabase
      .from('facturas')
      .select('*')
      .eq('id', facturaId)
      .eq('user_id', user.id)
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
        .eq('prestador_id', user.id)
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
    } catch {
      devLog('[validarFacturaPorId]', 'Tabla acuerdos_voluntades no disponible');
    }

    // 4. Obtener reglas de coherencia (graceful si tabla no existe)
    let reglasCoherencia;
    try {
      const { data: reglas } = await supabase
        .from('reglas_coherencia')
        .select('*')
        .eq('activo', true);
      reglasCoherencia = reglas ?? undefined;
    } catch {
      devLog('[validarFacturaPorId]', 'Tabla reglas_coherencia no disponible');
    }

    // 5. Obtener facturas existentes para detección de duplicados
    const { data: facturasExistentes } = await supabase
      .from('facturas')
      .select('num_factura, estado')
      .eq('user_id', user.id)
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
          user_id: user.id,
          resultado_json: resultado,
          errores: resultado.errores,
          advertencias: resultado.advertencias,
          puntaje_riesgo: resultado.puntaje_riesgo_glosa,
          puede_radicar: resultado.puede_radicar,
          created_at: new Date().toISOString(),
        });
    } catch {
      devLog('[validarFacturaPorId]', 'Tabla validaciones_factura no disponible — resultado no persistido');
    }

    return resultado;
  } catch (error) {
    devLog('[validarFacturaPorId]', 'Error inesperado:', error);
    return null;
  }
}

/**
 * Obtiene facturas pendientes de validación del usuario autenticado.
 * Retorna facturas en estado borrador o radicada, ordenadas por fecha.
 */
export async function obtenerFacturasPendientesValidacion(): Promise<FacturaResumen[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: facturas, error } = await supabase
      .from('facturas')
      .select('id, num_factura, fecha_expedicion, nit_erp, valor_total, estado')
      .eq('user_id', user.id)
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
    } catch {
      devLog('[obtenerFacturasPendientesValidacion]', 'Tabla validaciones_factura no disponible');
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
    devLog('[obtenerFacturasPendientesValidacion]', 'Error inesperado:', error);
    return [];
  }
}

/**
 * Obtiene historial de validaciones ejecutadas para una factura.
 * Retorna array de hallazgos ordenados por fecha descendente.
 */
export async function obtenerHistorialValidaciones(facturaId: string): Promise<ValidacionPreRadicacionDB[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Verificar que la factura pertenece al usuario
    const { data: factura } = await supabase
      .from('facturas')
      .select('id')
      .eq('id', facturaId)
      .eq('user_id', user.id)
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
    } catch {
      devLog('[obtenerHistorialValidaciones]', 'Tabla validaciones_factura no disponible');
      return [];
    }
  } catch (error) {
    devLog('[obtenerHistorialValidaciones]', 'Error inesperado:', error);
    return [];
  }
}
