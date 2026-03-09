"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { crearOrganizacion } from "@/lib/organizacion";
import type { PerfilPrestador, ResolucionFacturacion } from "@/lib/types/perfil";

// ==========================================
// PERFIL DEL PRESTADOR — Server Actions
// ==========================================

/** Obtener perfil del usuario logueado */
export async function obtenerPerfil(): Promise<PerfilPrestador | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as PerfilPrestador;
}

/** Guardar o actualizar perfil del prestador */
export async function guardarPerfil(
  datos: Partial<Omit<PerfilPrestador, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const payload = {
    ...datos,
    id: user.id,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("perfiles")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    devError("Error guardando perfil", error);
    return { success: false, error: error.message };
  }

  // Si es onboarding completo y no tiene org, crear organización
  if (datos.onboarding_completo) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("organizacion_id")
      .eq("user_id", user.id)
      .single();

    if (!perfil?.organizacion_id) {
      const tipoOrg =
        datos.tipo_prestador === "profesional_independiente"
          ? "independiente"
          : "clinica";
      await crearOrganizacion(
        datos.razon_social || datos.nombre_comercial || "Mi organización",
        tipoOrg as "independiente" | "clinica"
      );
    }
  }

  revalidatePath("/configuracion/perfil");
  revalidatePath("/onboarding");
  return { success: true };
}

/** Verificar si el usuario completó el onboarding */
export async function verificarOnboarding(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("perfiles")
    .select("onboarding_completo")
    .eq("user_id", user.id)
    .single();

  return data?.onboarding_completo === true;
}

// ==========================================
// RESOLUCIÓN DE FACTURACIÓN — Server Actions
// ==========================================

/** Obtener resolución activa del usuario */
export async function obtenerResolucionActiva(): Promise<ResolucionFacturacion | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("resoluciones_facturacion")
    .select("*")
    .eq("user_id", user.id)
    .eq("activa", true)
    .single();

  if (error || !data) return null;
  return data as ResolucionFacturacion;
}

/** Guardar o actualizar resolución de facturación */
export async function guardarResolucion(
  datos: Omit<ResolucionFacturacion, "id" | "user_id" | "consecutivo_actual" | "created_at"> & { id?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const payload = {
    user_id: user.id,
    numero_resolucion: datos.numero_resolucion,
    fecha_resolucion: datos.fecha_resolucion,
    prefijo: datos.prefijo,
    rango_desde: datos.rango_desde,
    rango_hasta: datos.rango_hasta,
    fecha_vigencia_desde: datos.fecha_vigencia_desde,
    fecha_vigencia_hasta: datos.fecha_vigencia_hasta,
    clave_tecnica: datos.clave_tecnica ?? null,
    activa: datos.activa,
  };

  if (datos.id) {
    const { error } = await supabase
      .from("resoluciones_facturacion")
      .update(payload)
      .eq("id", datos.id)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("resoluciones_facturacion")
      .insert({ ...payload, consecutivo_actual: datos.rango_desde - 1 });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/configuracion/perfil");
  revalidatePath("/onboarding");
  return { success: true };
}

/** Obtener todas las resoluciones del usuario (activas e inactivas) */
export async function obtenerResoluciones(): Promise<ResolucionFacturacion[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("resoluciones_facturacion")
    .select("*")
    .eq("user_id", user.id)
    .order("activa", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    devError("Error obteniendo resoluciones", error);
    return [];
  }
  return (data as ResolucionFacturacion[]) ?? [];
}

/** Activar una resolución específica (desactiva las demás) */
export async function activarResolucion(resolucionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Verificar que la resolución pertenece al usuario
  const { data: res } = await supabase
    .from("resoluciones_facturacion")
    .select("id")
    .eq("id", resolucionId)
    .eq("user_id", user.id)
    .single();

  if (!res) return { success: false, error: "Resolución no encontrada" };

  // Desactivar todas
  await supabase
    .from("resoluciones_facturacion")
    .update({ activa: false })
    .eq("user_id", user.id);

  // Activar la seleccionada
  const { error } = await supabase
    .from("resoluciones_facturacion")
    .update({ activa: true })
    .eq("id", resolucionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/configuracion/perfil");
  return { success: true };
}