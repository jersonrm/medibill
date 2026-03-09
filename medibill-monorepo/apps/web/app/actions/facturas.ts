"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { registrarAuditLog } from "@/lib/audit-log";
import { anonimizarTextoMedico } from "@/lib/validacion-medica";
import { getContextoOrg, getOrgIdActual } from "@/lib/organizacion";
import { verificarLimite, incrementarUso } from "@/lib/suscripcion";
import type { CrearFacturaInput, EstadoFacturaMVP } from "@/lib/types/factura";

// ==========================================
// FACTURAS — Server Actions
// ==========================================

/** Obtiene el siguiente número de factura basado en la resolución activa */
export async function obtenerSiguienteNumeroFactura(): Promise<{ numero: string; resolucion_id: string | null; numerosRestantes?: number; alertaAgotamiento?: boolean; error?: string }> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const { data: resolucion } = await supabase
    .from("resoluciones_facturacion")
    .select("*")
    .eq("organizacion_id", ctx.orgId)
    .eq("activa", true)
    .single();

  if (!resolucion) {
    return { numero: "", resolucion_id: null, error: "No hay resolución de facturación activa. Configúrala en Configuración." };
  }

  const siguiente = resolucion.consecutivo_actual != null
    ? resolucion.consecutivo_actual + 1
    : (resolucion.rango_inicio || 1);
  const prefijo = resolucion.prefijo || "";
  const numerosRestantes = (resolucion.rango_hasta || 0) - (resolucion.consecutivo_actual ?? (resolucion.rango_inicio || 1));
  return {
    numero: `${prefijo}${siguiente}`,
    resolucion_id: resolucion.id,
    numerosRestantes,
    alertaAgotamiento: numerosRestantes < 50,
  };
}

/** Crea una factura en estado borrador, upserta el paciente, y crea auditoría */
export async function crearFacturaBorrador(input: CrearFacturaInput) {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // 1. Generar número temporal (el consecutivo real se asigna al aprobar)
  const numero = `BORR-${Date.now().toString(36).toUpperCase()}`;
  // Obtener resolución activa solo para asociar, sin consumir consecutivo
  const { data: resolucion } = await supabase
    .from("resoluciones_facturacion")
    .select("id")
    .eq("organizacion_id", ctx.orgId)
    .eq("activa", true)
    .single();
  const resolucion_id = resolucion?.id || null;

  // 2. Obtener perfil para snapshot
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("user_id", ctx.userId)
    .single();

  // 3. Upsert paciente
  const dp = input.datos_paciente;
  const { data: paciente } = await supabase
    .from("pacientes")
    .upsert(
      {
        user_id: ctx.userId,
        organizacion_id: ctx.orgId,
        tipo_documento: dp.tipo_documento,
        numero_documento: dp.numero_documento,
        primer_nombre: dp.primer_nombre,
        primer_apellido: dp.primer_apellido,
        segundo_nombre: dp.segundo_nombre || null,
        segundo_apellido: dp.segundo_apellido || null,
        fecha_nacimiento: dp.fecha_nacimiento || null,
        sexo: dp.sexo || null,
        tipo_usuario: dp.tipo_usuario || null,
        eps_codigo: dp.eps_codigo || null,
        eps_nombre: dp.eps_nombre || null,
        municipio_residencia_codigo: dp.municipio_residencia_codigo || null,
        zona_territorial: dp.zona_territorial || null,
        telefono: dp.telefono || null,
        email: dp.email || null,
        direccion: dp.direccion || null,
      },
      { onConflict: "user_id,tipo_documento,numero_documento" }
    )
    .select("id")
    .single();

  // 4. Insertar factura
  const { data: factura, error } = await supabase
    .from("facturas")
    .insert({
      user_id: ctx.userId,
      organizacion_id: ctx.orgId,
      num_factura: numero,
      nit_prestador: perfil?.numero_documento || "",
      nit_erp: input.nit_erp,
      fecha_expedicion: new Date().toISOString().split("T")[0],
      valor_total: input.valor_total,
      subtotal: input.subtotal,
      descuentos: input.descuentos,
      copago: input.copago,
      cuota_moderadora: input.cuota_moderadora,
      estado: "borrador",
      paciente_id: paciente?.id || null,
      resolucion_id,
      diagnosticos: input.diagnosticos,
      procedimientos: input.procedimientos,
      perfil_prestador_snapshot: perfil || null,
      metadata: {
        eps_nombre: input.eps_nombre,
        atencion: input.atencion,
        nota_clinica_original: input.nota_clinica_original
          ? anonimizarTextoMedico(
              input.nota_clinica_original,
              `${input.datos_paciente.primer_nombre} ${input.datos_paciente.primer_apellido}`,
              input.datos_paciente.numero_documento,
            )
          : null,
        incapacidad: input.datos_paciente.incapacidad || "NO",
      },
    })
    .select("id, num_factura")
    .single();

  if (error) {
    devError("Error creando factura", error);
    return { success: false, error: error.message };
  }

  // 5. No se actualiza consecutivo — se asigna al aprobar

  registrarAuditLog({ accion: "crear_factura", tabla: "facturas", registroId: factura?.id, metadata: { num_factura: factura?.num_factura } });

  return { success: true, data: factura };
}

/** Aprueba una factura borrador — asigna el consecutivo real en este momento */
export async function aprobarFactura(facturaId: string) {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Verificar límite de facturas DIAN del plan
  const limiteOk = await verificarLimite(ctx.orgId, "factura_dian");
  if (!limiteOk.permitido) {
    return { success: false, error: limiteOk.mensaje || "Has alcanzado el límite de facturas DIAN de tu plan" };
  }

  // Verificar que la factura existe y es borrador
  const { data: factura } = await supabase
    .from("facturas")
    .select("id, resolucion_id, estado")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .eq("estado", "borrador")
    .single();

  if (!factura) return { success: false, error: "Factura no encontrada o no es borrador" };

  // Asignar consecutivo real — función atómica con row lock en PostgreSQL
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc("siguiente_numero_factura", { p_user_id: ctx.userId });

  if (rpcError) {
    // La función lanza excepción si el rango está agotado
    return { success: false, error: rpcError.message };
  }

  const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  const numero = row?.numero;
  if (!numero) {
    return {
      success: false,
      error: "No hay resolución de facturación activa o el rango está agotado. Configure una resolución en Configuración → Perfil.",
    };
  }

  // Actualizar factura: cambiar estado y asignar número real
  // (el consecutivo ya fue incrementado atómicamente por la función RPC)
  const { error } = await supabase
    .from("facturas")
    .update({
      estado: "aprobada",
      num_factura: numero,
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .eq("estado", "borrador");

  if (error) return { success: false, error: error.message };

  await incrementarUso(ctx.orgId, "factura_dian");
  registrarAuditLog({ accion: "aprobar_factura", tabla: "facturas", registroId: facturaId, metadata: { num_factura: numero } });

  return { success: true, numFactura: numero };
}

/** Anula una factura (solo borrador) */
export async function anularFactura(facturaId: string) {
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  const { error } = await supabase
    .from("facturas")
    .update({ estado: "anulada", updated_at: new Date().toISOString() })
    .eq("id", facturaId)
    .eq("organizacion_id", orgId)
    .eq("estado", "borrador");

  if (error) return { success: false, error: error.message };

  registrarAuditLog({ accion: "anular_factura", tabla: "facturas", registroId: facturaId });

  return { success: true };
}

/** Obtiene una factura completa con datos del paciente */
export async function obtenerFactura(facturaId: string) {
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  const { data } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("organizacion_id", orgId)
    .single();

  return data;
}

/** Lista facturas con filtros opcionales */
export async function listarFacturas(filtro?: {
  estado?: EstadoFacturaMVP;
  desde?: string;
  hasta?: string;
  pagina?: number;
  porPagina?: number;
}) {
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  const pagina = filtro?.pagina || 1;
  const porPagina = filtro?.porPagina || 20;
  const desde = (pagina - 1) * porPagina;

  let query = supabase
    .from("facturas")
    .select("id, num_factura, fecha_expedicion, nit_erp, valor_total, estado, copago, cuota_moderadora, metadata, paciente_id, pacientes(primer_nombre, primer_apellido, numero_documento)", { count: "exact" })
    .eq("organizacion_id", orgId)
    .order("created_at", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (filtro?.estado) query = query.eq("estado", filtro.estado);
  if (filtro?.desde) query = query.gte("fecha_expedicion", filtro.desde);
  if (filtro?.hasta) query = query.lte("fecha_expedicion", filtro.hasta);

  const { data, count, error } = await query;
  if (error) {
    devError("Error listando facturas", error);
    return { facturas: [], total: 0 };
  }

  return { facturas: data || [], total: count || 0 };
}

/** Marca una factura aprobada como descargada */
export async function marcarComoDescargada(facturaId: string) {
  const orgId = await getOrgIdActual();
  const supabase = await createClient();

  const { error } = await supabase
    .from("facturas")
    .update({ estado: "descargada", updated_at: new Date().toISOString() })
    .eq("id", facturaId)
    .eq("organizacion_id", orgId)
    .eq("estado", "aprobada");

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Edita una factura en estado borrador (datos clínicos, valores, y paciente) */
export async function editarFacturaBorrador(facturaId: string, datos: Partial<{
  diagnosticos: unknown[];
  procedimientos: unknown[];
  atencion: unknown;
  subtotal: number;
  copago: number;
  cuota_moderadora: number;
  valor_total: number;
  datos_paciente: {
    tipo_documento: string;
    numero_documento: string;
    primer_nombre: string;
    segundo_nombre?: string;
    primer_apellido: string;
    segundo_apellido?: string;
    fecha_nacimiento?: string;
    sexo?: string;
    tipo_usuario?: string;
    eps_codigo?: string;
    eps_nombre?: string;
    municipio_residencia_codigo?: string;
    zona_territorial?: string;
  };
}>) {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // Extraer atencion y datos_paciente del objeto de datos
  const { atencion, datos_paciente, ...restDatos } = datos;
  const updatePayload: Record<string, unknown> = { ...restDatos, updated_at: new Date().toISOString() };

  if (atencion !== undefined) {
    // Obtener metadata actual para hacer merge
    const { data: facturaActual } = await supabase
      .from("facturas")
      .select("metadata")
      .eq("id", facturaId)
      .single();
    const metadataActual = (facturaActual?.metadata as Record<string, unknown>) || {};
    updatePayload.metadata = { ...metadataActual, atencion };
  }

  // Actualizar paciente si se proporcionan datos
  if (datos_paciente) {
    const dp = datos_paciente;
    const { data: paciente } = await supabase
      .from("pacientes")
      .upsert(
        {
          user_id: ctx.userId,
          tipo_documento: dp.tipo_documento,
          numero_documento: dp.numero_documento,
          primer_nombre: dp.primer_nombre,
          primer_apellido: dp.primer_apellido,
          segundo_nombre: dp.segundo_nombre || null,
          segundo_apellido: dp.segundo_apellido || null,
          fecha_nacimiento: dp.fecha_nacimiento || null,
          sexo: dp.sexo || null,
          tipo_usuario: dp.tipo_usuario || null,
          eps_codigo: dp.eps_codigo || null,
          eps_nombre: dp.eps_nombre || null,
          municipio_residencia_codigo: dp.municipio_residencia_codigo || null,
          zona_territorial: dp.zona_territorial || null,
        },
        { onConflict: "user_id,tipo_documento,numero_documento" }
      )
      .select("id")
      .single();
    if (paciente) {
      updatePayload.paciente_id = paciente.id;
    }
  }

  const { error } = await supabase
    .from("facturas")
    .update(updatePayload)
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .eq("estado", "borrador");

  if (error) return { success: false, error: error.message };
  return { success: true };
}
