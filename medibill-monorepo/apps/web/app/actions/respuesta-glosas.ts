"use server";

/**
 * Server Actions — Módulo de Respuesta de Glosas (Capa 3)
 *
 * CRUD contra tablas `glosas_recibidas` y `respuestas_glosas`:
 *  - obtenerGlosasRecibidas: lista enriquecida con auto-vencimiento
 *  - obtenerGlosaPorId: detalle individual
 *  - registrarRespuestaGlosa: insert con validaciones de negocio
 *  - obtenerHistorialRespuestas: join con glosa original
 *  - obtenerResumenGlosasRecibidas: estadísticas para panel
 *  - sugerirRespuestaIA: híbrido RS04/RS05 auto + Gemini
 *  - subirSoporteGlosa: upload de archivo a Supabase Storage
 */

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { devLog, devError } from "@/lib/logger";
import type {
  CodigoRespuesta,
  GlosaRecibidaEnriquecida,
  RespuestaGlosaNuevaDB,
  RespuestaConGlosa,
  ResumenGlosasRecibidas,
  SugerenciaRespuestaIA,
  SoporteAdjunto,
  FacturaDB,
} from "@/lib/types/glosas";
import { CODIGOS_RESPUESTA } from "@/lib/catalogo-respuestas-glosa";
import {
  diasRestantesParaResponder,
  calcularUrgencia,
  sumarDiasHabiles,
  esGlosaExtemporanea,
} from "@/lib/dias-habiles";
import { sugerirRespuestaGlosa } from "@/lib/gemini-glosas";

// =====================================================================
// OBTENER GLOSAS RECIBIDAS
// =====================================================================

/**
 * Obtiene todas las glosas recibidas, enriquecidas con días restantes y urgencia.
 * Marca automáticamente como 'vencida' las que ya pasaron su fecha límite sin respuesta.
 */
export async function obtenerGlosasRecibidas(filtro?: {
  estado?: string;
  eps_codigo?: string;
}): Promise<GlosaRecibidaEnriquecida[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    // 1. Auto-vencimiento: marcar glosas pendientes cuya fecha límite ya pasó
    const hoy = new Date().toISOString().split("T")[0]!;
    await supabase
      .from("glosas_recibidas")
      .update({ estado: "vencida", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("estado", "pendiente")
      .lt("fecha_limite_respuesta", hoy);

    // 2. Consultar con filtros opcionales
    let query = supabase
      .from("glosas_recibidas")
      .select("*")
      .eq("user_id", user.id)
      .order("fecha_limite_respuesta", { ascending: true });

    if (filtro?.estado) query = query.eq("estado", filtro.estado);
    if (filtro?.eps_codigo) query = query.eq("eps_codigo", filtro.eps_codigo);

    const { data, error } = await query;
    if (error) {
      devLog("[obtenerGlosasRecibidas]", "Error consultando glosas", error);
      return [];
    }

    // 3. Enriquecer con campos calculados
    return (data || []).map((g) => {
      const dias = diasRestantesParaResponder(g.fecha_limite_respuesta);
      return {
        ...g,
        dias_restantes: dias,
        porcentaje_glosado:
          g.valor_factura > 0
            ? Number(((g.valor_glosado / g.valor_factura) * 100).toFixed(1))
            : 0,
        urgencia: calcularUrgencia(dias),
      };
    });
  } catch (err) {
    devError("[obtenerGlosasRecibidas]", "Error inesperado", err);
    return [];
  }
}

// =====================================================================
// OBTENER GLOSA POR ID
// =====================================================================

/**
 * Obtiene una glosa recibida por su ID con datos enriquecidos.
 */
export async function obtenerGlosaPorId(
  glosaId: string
): Promise<GlosaRecibidaEnriquecida | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from("glosas_recibidas")
      .select("*")
      .eq("id", glosaId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) return null;

    const dias = diasRestantesParaResponder(data.fecha_limite_respuesta);
    return {
      ...data,
      dias_restantes: dias,
      porcentaje_glosado:
        data.valor_factura > 0
          ? Number(((data.valor_glosado / data.valor_factura) * 100).toFixed(1))
          : 0,
      urgencia: calcularUrgencia(dias),
    };
  } catch (err) {
    devError("[obtenerGlosaPorId]", "Error inesperado", err);
    return null;
  }
}

// =====================================================================
// REGISTRAR RESPUESTA A GLOSA
// =====================================================================

/**
 * Registra la respuesta del prestador a una glosa recibida.
 * Aplica validaciones de negocio estrictas según el código RS seleccionado.
 *
 * Reglas de negocio:
 * - No se puede responder si la glosa no está en estado 'pendiente'
 * - No se puede responder si la fecha límite ya venció
 * - RS02: valor_aceptado > 0 y < valor_glosado
 * - RS04: solo si la glosa es extemporánea
 * - Justificación mínima 20 caracteres si el código la requiere
 * - RS01/RS02: generan nota crédito DIAN
 */
export async function registrarRespuestaGlosa(respuesta: {
  glosa_id: string;
  codigo_respuesta: CodigoRespuesta;
  justificacion?: string;
  fundamento_legal?: string;
  valor_aceptado?: number;
  soportes?: SoporteAdjunto[];
  origen_respuesta?: "manual" | "automatica" | "ia";
}): Promise<{ success: boolean; error?: string; respuestaId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    // 1. Obtener la glosa
    const glosa = await obtenerGlosaPorId(respuesta.glosa_id);
    if (!glosa) return { success: false, error: "Glosa no encontrada" };

    if (glosa.estado !== "pendiente") {
      return {
        success: false,
        error: `Glosa en estado "${glosa.estado}", solo se pueden responder glosas pendientes`,
      };
    }

    // 2. Validar fecha límite
    if ((glosa.dias_restantes ?? 0) < 0) {
      return {
        success: false,
        error:
          "La fecha límite de respuesta ya venció. Silencio = aceptación tácita (Art. 57 Ley 1438/2011)",
      };
    }

    // 3. Validar reglas por código de respuesta
    const config = CODIGOS_RESPUESTA[respuesta.codigo_respuesta];
    if (!config) {
      return {
        success: false,
        error: `Código de respuesta ${respuesta.codigo_respuesta} no válido`,
      };
    }

    if (
      config.requiereJustificacion &&
      (!respuesta.justificacion || respuesta.justificacion.trim().length < 20)
    ) {
      return {
        success: false,
        error: `${respuesta.codigo_respuesta} requiere justificación técnica (mínimo 20 caracteres)`,
      };
    }

    if (respuesta.codigo_respuesta === "RS02") {
      const va = respuesta.valor_aceptado ?? 0;
      if (va <= 0 || va >= glosa.valor_glosado) {
        return {
          success: false,
          error:
            "RS02 (aceptación parcial): el valor aceptado debe ser mayor a 0 y menor al valor glosado",
        };
      }
    }

    if (respuesta.codigo_respuesta === "RS04" && !glosa.es_extemporanea) {
      return {
        success: false,
        error:
          "RS04 solo aplica cuando la glosa es extemporánea (>20 días hábiles desde radicación)",
      };
    }

    // 4. Calcular valores finales
    let valorAceptado = 0;
    let valorControvertido = glosa.valor_glosado;

    if (respuesta.codigo_respuesta === "RS01") {
      valorAceptado = glosa.valor_glosado;
      valorControvertido = 0;
    } else if (respuesta.codigo_respuesta === "RS02") {
      valorAceptado = respuesta.valor_aceptado ?? 0;
      valorControvertido = glosa.valor_glosado - valorAceptado;
    }
    // RS03, RS04, RS05: valorAceptado = 0, valorControvertido = 100%

    // 5. Insertar respuesta en respuestas_glosas
    const { data, error } = await supabase
      .from("respuestas_glosas")
      .insert({
        user_id: user.id,
        glosa_id: respuesta.glosa_id,
        codigo_respuesta: respuesta.codigo_respuesta,
        justificacion: respuesta.justificacion || null,
        fundamento_legal: respuesta.fundamento_legal || null,
        valor_aceptado: valorAceptado,
        valor_controvertido: valorControvertido,
        valor_nota_credito: config.generaNotaCredito ? valorAceptado : 0,
        soportes: respuesta.soportes || [],
        origen_respuesta: respuesta.origen_respuesta || "manual",
        fecha_respuesta: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single();

    if (error) {
      devLog("[registrarRespuestaGlosa]", "Error insertando respuesta", error);
      return { success: false, error: `Error registrando respuesta: ${error.message}` };
    }

    // 6. Actualizar estado de la glosa a 'respondida'
    await supabase
      .from("glosas_recibidas")
      .update({ estado: "respondida", updated_at: new Date().toISOString() })
      .eq("id", respuesta.glosa_id)
      .eq("user_id", user.id);

    revalidatePath("/glosas");
    return { success: true, respuestaId: data.id };
  } catch (err) {
    devError("[registrarRespuestaGlosa]", "Error inesperado", err);
    return { success: false, error: "Error interno del servidor" };
  }
}

// =====================================================================
// HISTORIAL DE RESPUESTAS
// =====================================================================

/**
 * Obtiene historial de respuestas con datos de la glosa original.
 */
export async function obtenerHistorialRespuestas(): Promise<RespuestaConGlosa[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabase
      .from("respuestas_glosas")
      .select("*, glosa:glosas_recibidas(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      devLog("[obtenerHistorialRespuestas]", "Error consultando historial", error);
      return [];
    }

    return (data || []) as unknown as RespuestaConGlosa[];
  } catch (err) {
    devError("[obtenerHistorialRespuestas]", "Error inesperado", err);
    return [];
  }
}

// =====================================================================
// RESUMEN ESTADÍSTICO
// =====================================================================

/**
 * Calcula resumen estadístico de glosas recibidas para el panel.
 */
export async function obtenerResumenGlosasRecibidas(): Promise<ResumenGlosasRecibidas> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const defaultResumen: ResumenGlosasRecibidas = {
    total_glosas: 0,
    total_glosado: 0,
    pendientes: 0,
    respondidas: 0,
    vencidas: 0,
    en_conciliacion: 0,
    total_aceptado: 0,
    total_controvertido: 0,
    total_nota_credito: 0,
    tasa_recuperacion: 0,
  };
  if (!user) return defaultResumen;

  try {
    const { data: glosas } = await supabase
      .from("glosas_recibidas")
      .select("estado, valor_glosado")
      .eq("user_id", user.id);

    const { data: respuestas } = await supabase
      .from("respuestas_glosas")
      .select("valor_aceptado, valor_controvertido, valor_nota_credito")
      .eq("user_id", user.id);

    const todas = glosas || [];
    const resps = respuestas || [];

    const totalGlosado = todas.reduce((s, g) => s + Number(g.valor_glosado), 0);
    const totalAceptado = resps.reduce((s, r) => s + Number(r.valor_aceptado), 0);
    const totalControvertido = resps.reduce(
      (s, r) => s + Number(r.valor_controvertido),
      0
    );
    const totalNotaCredito = resps.reduce(
      (s, r) => s + Number(r.valor_nota_credito),
      0
    );

    return {
      total_glosas: todas.length,
      total_glosado: totalGlosado,
      pendientes: todas.filter((g) => g.estado === "pendiente").length,
      respondidas: todas.filter((g) => g.estado === "respondida").length,
      vencidas: todas.filter((g) => g.estado === "vencida").length,
      en_conciliacion: todas.filter((g) => g.estado === "en_conciliacion").length,
      total_aceptado: totalAceptado,
      total_controvertido: totalControvertido,
      total_nota_credito: totalNotaCredito,
      tasa_recuperacion:
        totalGlosado > 0
          ? Number(((totalControvertido / totalGlosado) * 100).toFixed(1))
          : 0,
    };
  } catch (err) {
    devError("[obtenerResumenGlosasRecibidas]", "Error inesperado", err);
    return defaultResumen;
  }
}

// =====================================================================
// SUGERENCIA IA (HÍBRIDO)
// =====================================================================

/**
 * Sugiere la respuesta óptima para una glosa usando el modo híbrido:
 * 1. RS04 auto-detectado si es extemporánea
 * 2. RS05 auto-detectado si el código no está en catálogo
 * 3. Gemini AI para RS01/RS02/RS03
 */
export async function sugerirRespuestaParaGlosa(
  glosaId: string
): Promise<{ success: boolean; sugerencia?: SugerenciaRespuestaIA; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    // 1. Obtener la glosa
    const glosa = await obtenerGlosaPorId(glosaId);
    if (!glosa) return { success: false, error: "Glosa no encontrada" };

    // 2. Cargar catálogo de códigos válidos
    const { data: catalogo } = await supabase
      .from("catalogo_causales_glosa")
      .select("codigo");

    const codigosCatalogo = new Set<string>(
      (catalogo || []).map((c: { codigo: string }) => c.codigo)
    );

    // 3. Llamar al motor híbrido
    const sugerencia = await sugerirRespuestaGlosa(glosa, codigosCatalogo);

    return { success: true, sugerencia };
  } catch (err) {
    devError("[sugerirRespuestaParaGlosa]", "Error inesperado", err);
    return { success: false, error: "Error generando sugerencia" };
  }
}

// =====================================================================
// REGISTRAR GLOSA RECIBIDA (Vinculada a factura)
// =====================================================================

/**
 * Registra una glosa recibida desde la EPS, vinculándola a una factura
 * existente del usuario. Calcula automáticamente:
 * - fecha_limite_respuesta (15 días hábiles desde fecha de glosa)
 * - es_extemporanea (>20 días hábiles desde radicación)
 * - Actualiza el estado de la factura a 'glosada'
 * - También inserta en la tabla `glosas` para sincronizar el Dashboard
 */
export async function registrarGlosaRecibida(datos: {
  factura_id: string;
  codigo_glosa: string;
  concepto_general: string;
  descripcion_glosa: string;
  valor_glosado: number;
  paciente_nombre: string;
  paciente_documento?: string;
  servicio_descripcion?: string;
  fecha_glosa: string;
  numero_registro_glosa?: string;
}): Promise<{ success: boolean; error?: string; glosaId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    // 1. Obtener la factura y verificar propiedad
    const { data: factura, error: errorFactura } = await supabase
      .from("facturas")
      .select("*")
      .eq("id", datos.factura_id)
      .eq("user_id", user.id)
      .single();

    if (errorFactura || !factura) {
      return {
        success: false,
        error: "Factura no encontrada o no le pertenece",
      };
    }

    // 2. Validar que la factura esté en un estado válido para recibir glosas
    const estadosValidos = ["radicada", "glosada", "respondida"];
    if (!estadosValidos.includes(factura.estado)) {
      return {
        success: false,
        error: `La factura está en estado "${factura.estado}". Solo se pueden registrar glosas para facturas radicadas, glosadas o respondidas.`,
      };
    }

    // 3. Validar que el valor glosado no exceda el valor de la factura
    if (datos.valor_glosado > Number(factura.valor_total)) {
      return {
        success: false,
        error: `El valor glosado ($${datos.valor_glosado.toLocaleString("es-CO")}) no puede exceder el valor de la factura ($${Number(factura.valor_total).toLocaleString("es-CO")})`,
      };
    }

    // 4. Calcular fecha límite de respuesta (15 días hábiles)
    const fechaLimite = sumarDiasHabiles(datos.fecha_glosa, 15);

    // 5. Detectar si es extemporánea (>20 días hábiles desde radicación)
    const esExtemporanea = factura.fecha_radicacion
      ? esGlosaExtemporanea(factura.fecha_radicacion, datos.fecha_glosa)
      : false;

    // 6. Buscar el nombre de la EPS desde acuerdos_voluntades
    let epsNombre = factura.nit_erp;
    try {
      const { data: acuerdo } = await supabase
        .from("acuerdos_voluntades")
        .select("nombre_eps")
        .eq("eps_codigo", factura.nit_erp)
        .limit(1)
        .single();
      if (acuerdo?.nombre_eps) epsNombre = acuerdo.nombre_eps;
    } catch (e) {
      devError("[registrarGlosaRecibida]", "Error buscando nombre EPS (usando NIT como fallback)", e);
    }

    // 7. Insertar en glosas_recibidas
    const { data: glosaInsertada, error: errorInsert } = await supabase
      .from("glosas_recibidas")
      .insert({
        user_id: user.id,
        factura_id: factura.id,
        num_factura: factura.num_factura,
        eps_codigo: factura.nit_erp,
        eps_nombre: epsNombre,
        codigo_glosa: datos.codigo_glosa,
        concepto_general: datos.concepto_general,
        descripcion_glosa: datos.descripcion_glosa,
        valor_glosado: datos.valor_glosado,
        valor_factura: Number(factura.valor_total),
        paciente_nombre: datos.paciente_nombre,
        paciente_documento: datos.paciente_documento || null,
        servicio_descripcion: datos.servicio_descripcion || null,
        fecha_radicacion_factura: factura.fecha_radicacion || factura.fecha_expedicion,
        fecha_glosa: datos.fecha_glosa,
        fecha_limite_respuesta: fechaLimite,
        estado: "pendiente",
        es_extemporanea: esExtemporanea,
        numero_registro_glosa: datos.numero_registro_glosa || null,
        numero_radicacion_factura: factura.num_factura,
      })
      .select("id")
      .single();

    if (errorInsert) {
      devLog("[registrarGlosaRecibida]", "Error insertando glosa", errorInsert);
      return {
        success: false,
        error: `Error registrando glosa: ${errorInsert.message}`,
      };
    }

    // 8. Insertar también en tabla `glosas` para sincronizar Dashboard
    try {
      await supabase.from("glosas").insert({
        factura_id: factura.id,
        codigo_causal: datos.codigo_glosa,
        tipo: "glosa",
        descripcion_erp: datos.descripcion_glosa,
        valor_glosado: datos.valor_glosado,
        fecha_formulacion: datos.fecha_glosa,
        fecha_limite_resp: fechaLimite,
        estado: "pendiente",
        capa_medibill: 3,
        prevenible: false,
      });
    } catch (e) {
      devError(
        "[registrarGlosaRecibida]",
        "No se pudo sincronizar con tabla glosas (no crítico)",
        e
      );
    }

    // 9. Actualizar factura: estado → glosada, actualizar valor_glosado
    const nuevoValorGlosado =
      Number(factura.valor_glosado || 0) + datos.valor_glosado;
    await supabase
      .from("facturas")
      .update({
        estado: "glosada",
        valor_glosado: nuevoValorGlosado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", factura.id);

    revalidatePath("/validar-factura");
    revalidatePath("/glosas");

    return { success: true, glosaId: glosaInsertada.id };
  } catch (err) {
    devError("[registrarGlosaRecibida]", "Error inesperado", err);
    return { success: false, error: "Error interno del servidor" };
  }
}

// =====================================================================
// OBTENER FACTURA POR ID (Para contexto en Responder Glosas)
// =====================================================================

/**
 * Obtiene los datos de una factura vinculada a una glosa recibida.
 * Usado para mostrar contexto de la factura en el formulario de respuesta.
 */
export async function obtenerFacturaDeGlosa(
  facturaId: string
): Promise<Pick<
  FacturaDB,
  | "id"
  | "num_factura"
  | "nit_erp"
  | "valor_total"
  | "valor_glosado"
  | "estado"
  | "fecha_expedicion"
  | "fecha_radicacion"
> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from("facturas")
      .select(
        "id, num_factura, nit_erp, valor_total, valor_glosado, estado, fecha_expedicion, fecha_radicacion"
      )
      .eq("id", facturaId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) return null;
    return data;
  } catch (e) {
    devError("[obtenerFacturaPorIdParaGlosa]", "Error inesperado", e);
    return null;
  }
}

/**
 * Lista facturas del usuario en estados que pueden recibir glosas
 * (radicada, glosada, respondida). Usado en el formulario de registro
 * de glosas recibidas.
 */
export async function obtenerFacturasParaGlosas(): Promise<
  Array<{
    id: string;
    num_factura: string;
    nit_erp: string;
    valor_total: number;
    estado: string;
    fecha_radicacion: string | null;
  }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabase
      .from("facturas")
      .select("id, num_factura, nit_erp, valor_total, estado, fecha_radicacion")
      .eq("user_id", user.id)
      .in("estado", ["radicada", "glosada", "respondida"])
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((f) => ({ ...f, valor_total: Number(f.valor_total) }));
  } catch (e) {
    devError("[obtenerFacturasParaGlosas]", "Error inesperado", e);
    return [];
  }
}

// =====================================================================
// SUBIR SOPORTE A SUPABASE STORAGE
// =====================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/**
 * Sube un archivo soporte de glosa a Supabase Storage bucket `soportes-glosas`.
 * Path: {user_id}/{glosa_id}/{filename}
 * Retorna la URL pública o un error.
 */
export async function subirSoporteGlosa(
  formData: FormData
): Promise<{ success: boolean; url?: string; nombre?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const file = formData.get("file") as File | null;
  const glosaId = formData.get("glosa_id") as string | null;

  if (!file) return { success: false, error: "No se recibió archivo" };
  if (!glosaId) return { success: false, error: "Falta glosa_id" };

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: `El archivo excede el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: `Tipo de archivo no permitido: ${file.type}. Aceptados: PDF, JPG, PNG` };
  }

  // Sanitize filename
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${glosaId}/${Date.now()}_${sanitized}`;

  const { error } = await supabase.storage
    .from("soportes-glosas")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    devLog("[subirSoporteGlosa]", "Error subiendo archivo", error);
    return { success: false, error: `Error subiendo archivo: ${error.message}` };
  }

  const { data: urlData } = supabase.storage
    .from("soportes-glosas")
    .getPublicUrl(path);

  return { success: true, url: urlData.publicUrl, nombre: file.name };
}
