"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { registrarAuditLog } from "@/lib/audit-log";

// ==========================================
// ACUERDOS DE VOLUNTADES — Server Actions
// ==========================================

/** Listar acuerdos de voluntades del usuario */
export async function obtenerAcuerdos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('acuerdos_voluntades')
    .select('*')
    .eq('prestador_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    devError("Error obteniendo acuerdos", error);
    return [];
  }
  return data ?? [];
}

/** Obtener un acuerdo con sus tarifas */
export async function obtenerAcuerdoConTarifas(acuerdoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: acuerdo } = await supabase
    .from('acuerdos_voluntades')
    .select('*')
    .eq('id', acuerdoId)
    .eq('prestador_id', user.id)
    .single();

  if (!acuerdo) return null;

  const { data: tarifas } = await supabase
    .from('acuerdo_tarifas')
    .select('*')
    .eq('acuerdo_id', acuerdoId)
    .order('cups_codigo', { ascending: true });

  return { acuerdo, tarifas: tarifas ?? [] };
}

/** Crear o actualizar un acuerdo de voluntades */
export async function guardarAcuerdo(datos: {
  id?: string;
  eps_codigo: string;
  nombre_eps: string;
  email_radicacion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  tarifario_base: string;
  porcentaje_sobre_base: number;
  requiere_autorizacion: boolean;
  observaciones?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "No autenticado" };

  const payload = {
    prestador_id: user.id,
    eps_codigo: datos.eps_codigo,
    nombre_eps: datos.nombre_eps,
    email_radicacion: datos.email_radicacion || null,
    fecha_inicio: datos.fecha_inicio,
    fecha_fin: datos.fecha_fin,
    tarifario_base: datos.tarifario_base,
    porcentaje_sobre_base: datos.porcentaje_sobre_base,
    requiere_autorizacion: datos.requiere_autorizacion,
    observaciones: datos.observaciones || null,
    activo: true,
    updated_at: new Date().toISOString(),
  };

  if (datos.id) {
    const { error } = await supabase
      .from('acuerdos_voluntades')
      .update(payload)
      .eq('id', datos.id)
      .eq('prestador_id', user.id);
    if (error) return { exito: false, error: error.message };
    registrarAuditLog({ accion: "actualizar_acuerdo", tabla: "acuerdos_voluntades", registroId: datos.id, metadata: { eps_codigo: datos.eps_codigo } });
    return { exito: true, id: datos.id };
  } else {
    const { data, error } = await supabase
      .from('acuerdos_voluntades')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { exito: false, error: error.message };
    registrarAuditLog({ accion: "crear_acuerdo", tabla: "acuerdos_voluntades", registroId: data?.id, metadata: { eps_codigo: datos.eps_codigo } });
    return { exito: true, id: data?.id };
  }
}

/** Guardar tarifas específicas de un acuerdo (reemplaza todas las existentes) */
export async function guardarTarifasAcuerdo(
  acuerdoId: string,
  tarifas: Array<{
    cups_codigo: string;
    valor_pactado: number;
    incluye_honorarios: boolean;
    incluye_materiales: boolean;
    es_paquete: boolean;
    servicios_incluidos_paquete?: string[];
    observaciones?: string;
  }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "No autenticado" };

  // Verificar que el acuerdo pertenece al usuario
  const { data: acuerdo } = await supabase
    .from('acuerdos_voluntades')
    .select('id')
    .eq('id', acuerdoId)
    .eq('prestador_id', user.id)
    .single();

  if (!acuerdo) return { exito: false, error: "Acuerdo no encontrado" };

  // Eliminar tarifas existentes
  await supabase
    .from('acuerdo_tarifas')
    .delete()
    .eq('acuerdo_id', acuerdoId);

  // Insertar nuevas
  if (tarifas.length > 0) {
    const rows = tarifas.map(t => ({
      acuerdo_id: acuerdoId,
      cups_codigo: t.cups_codigo,
      valor_pactado: t.valor_pactado,
      incluye_honorarios: t.incluye_honorarios,
      incluye_materiales: t.incluye_materiales,
      es_paquete: t.es_paquete,
      servicios_incluidos_paquete: t.servicios_incluidos_paquete || null,
      observaciones: t.observaciones || null,
    }));

    const { error } = await supabase
      .from('acuerdo_tarifas')
      .insert(rows);

    if (error) return { exito: false, error: error.message };
  }

  return { exito: true };
}

/** Eliminar un acuerdo de voluntades y sus tarifas (cascade) */
export async function eliminarAcuerdo(acuerdoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "No autenticado" };

  const { error } = await supabase
    .from('acuerdos_voluntades')
    .delete()
    .eq('id', acuerdoId)
    .eq('prestador_id', user.id);

  if (error) return { exito: false, error: error.message };
  registrarAuditLog({ accion: "eliminar_acuerdo", tabla: "acuerdos_voluntades", registroId: acuerdoId });
  return { exito: true };
}
