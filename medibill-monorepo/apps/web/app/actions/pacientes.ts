"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { safeError } from "@/lib/safe-error";
import type { PacienteDB, PacienteInput } from "@/lib/types/paciente";

// ==========================================
// PACIENTES — Server Actions
// ==========================================

/** Buscar paciente por tipo y número de documento */
export async function buscarPacientePorDocumento(
  tipoDoc: string,
  numDoc: string
): Promise<PacienteDB | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("pacientes")
    .select("*")
    .eq("user_id", user.id)
    .eq("tipo_documento", tipoDoc)
    .eq("numero_documento", numDoc)
    .single();

  if (error || !data) return null;
  return data as PacienteDB;
}

/** Guardar o actualizar paciente (upsert por user_id + tipo_doc + num_doc) */
export async function guardarPaciente(
  datos: PacienteInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const payload = {
    user_id: user.id,
    ...datos,
    updated_at: new Date().toISOString(),
  };

  // Intentar buscar el paciente existente para decidir upsert
  const { data: existente } = await supabase
    .from("pacientes")
    .select("id")
    .eq("user_id", user.id)
    .eq("tipo_documento", datos.tipo_documento)
    .eq("numero_documento", datos.numero_documento)
    .single();

  if (existente) {
    const { error } = await supabase
      .from("pacientes")
      .update(payload)
      .eq("id", existente.id);
    if (error) return { success: false, error: safeError("guardarPaciente", error) };
    revalidatePath("/pacientes");
    return { success: true, id: existente.id };
  }

  const { data, error } = await supabase
    .from("pacientes")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { success: false, error: safeError("guardarPaciente", error) };
  revalidatePath("/pacientes");
  return { success: true, id: data?.id };
}

/** Listar pacientes del médico con búsqueda y paginación */
export async function listarPacientes(filtro?: {
  busqueda?: string;
  pagina?: number;
  porPagina?: number;
}): Promise<{ pacientes: PacienteDB[]; total: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pacientes: [], total: 0 };

  const pagina = filtro?.pagina ?? 1;
  const porPagina = filtro?.porPagina ?? 20;
  const desde = (pagina - 1) * porPagina;

  let query = supabase
    .from("pacientes")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("activo", true)
    .order("updated_at", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (filtro?.busqueda) {
    const term = `%${filtro.busqueda}%`;
    query = query.or(
      `primer_nombre.ilike.${term},primer_apellido.ilike.${term},numero_documento.ilike.${term}`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    devError("Error listando pacientes", error);
    return { pacientes: [], total: 0 };
  }

  return { pacientes: (data ?? []) as PacienteDB[], total: count ?? 0 };
}

/** Obtener historial de auditorías y facturas de un paciente */
export async function obtenerHistorialPaciente(pacienteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { auditorias: [], facturas: [] };

  // Obtener datos del paciente para buscar por documento
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("numero_documento")
    .eq("id", pacienteId)
    .eq("user_id", user.id)
    .single();

  if (!paciente) return { auditorias: [], facturas: [] };

  const [audRes, facRes] = await Promise.all([
    supabase
      .from("auditorias_rips")
      .select("*")
      .eq("user_id", user.id)
      .eq("documento_paciente", paciente.numero_documento)
      .order("creado_en", { ascending: false })
      .limit(20),
    supabase
      .from("facturas")
      .select("id, num_factura, fecha_expedicion, valor_total, estado, created_at")
      .eq("user_id", user.id)
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    auditorias: audRes.data ?? [],
    facturas: facRes.data ?? [],
  };
}
