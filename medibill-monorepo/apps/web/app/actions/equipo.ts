"use server";

import { createClient } from "@/lib/supabase-server";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { safeError } from "@/lib/safe-error";
import { randomBytes } from "crypto";
import type { UsuarioOrganizacion, Invitacion, RolOrganizacion } from "@/lib/types/suscripcion";

// ==========================================
// EQUIPO — Server Actions (gestión de usuarios de la organización)
// ==========================================

/** Lista los miembros de la organización actual */
export async function listarMiembros(): Promise<{
  miembros: (UsuarioOrganizacion & { email?: string })[];
  invitaciones: Invitacion[];
  error?: string;
}> {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    const [miembrosResult, invitacionesResult] = await Promise.all([
      supabase
        .from("usuarios_organizacion")
        .select("*")
        .eq("organizacion_id", ctx.orgId)
        .order("created_at"),
      supabase
        .from("invitaciones")
        .select("*")
        .eq("organizacion_id", ctx.orgId)
        .eq("usado", false)
        .order("created_at", { ascending: false }),
    ]);

    return {
      miembros: (miembrosResult.data || []) as (UsuarioOrganizacion & { email?: string })[],
      invitaciones: (invitacionesResult.data || []) as Invitacion[],
    };
  } catch (error: unknown) {
    return {
      miembros: [],
      invitaciones: [],
      error: "Error al cargar el equipo. Intenta de nuevo.",
    };
  }
}

/** Invita un nuevo usuario a la organización por email */
export async function invitarUsuario(
  email: string,
  rol: RolOrganizacion = "doctor"
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_equipo");

    const supabase = await createClient();

    // Verificar límite de usuarios
    const { data: org } = await supabase
      .from("organizaciones")
      .select("max_usuarios")
      .eq("id", ctx.orgId)
      .single();

    const { count: miembrosActuales } = await supabase
      .from("usuarios_organizacion")
      .select("id", { count: "exact", head: true })
      .eq("organizacion_id", ctx.orgId)
      .eq("activo", true);

    if (org && miembrosActuales != null && miembrosActuales >= org.max_usuarios) {
      return {
        success: false,
        error: `Has alcanzado el límite de ${org.max_usuarios} usuarios de tu plan. Actualiza tu plan para agregar más.`,
      };
    }

    // Verificar que no exista invitación pendiente
    const { data: existente } = await supabase
      .from("invitaciones")
      .select("id")
      .eq("organizacion_id", ctx.orgId)
      .eq("email", email.toLowerCase())
      .eq("usado", false)
      .single();

    if (existente) {
      return { success: false, error: "Ya existe una invitación pendiente para este email." };
    }

    // Verificar que no sea ya miembro
    // Primero buscar si el email corresponde a algún auth user
    // Nota: no podemos consultar auth.users directamente con RLS,
    // pero podemos verificar en usuarios_organizacion con un join
    const { data: yaMiembro } = await supabase
      .from("usuarios_organizacion")
      .select("id, user_id")
      .eq("organizacion_id", ctx.orgId)
      .eq("invitado_email", email.toLowerCase())
      .eq("activo", true)
      .limit(1);

    if (yaMiembro && yaMiembro.length > 0) {
      return { success: false, error: "Este email ya es miembro de tu organización." };
    }

    // Generar token seguro
    const token = randomBytes(32).toString("hex");

    // Crear invitación
    const { error: insertError } = await supabase
      .from("invitaciones")
      .insert({
        organizacion_id: ctx.orgId,
        email: email.toLowerCase(),
        rol,
        token,
        invitado_por: ctx.userId,
      });

    if (insertError) {
      return { success: false, error: safeError("invitarUsuario", insertError) };
    }

    // TODO: Enviar email de invitación con el link
    // El link será: {APP_URL}/invitacion/{token}

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al invitar usuario. Intenta de nuevo." };
  }
}

/** Cambia el rol de un miembro de la organización */
export async function cambiarRolMiembro(
  miembroId: string,
  nuevoRol: RolOrganizacion
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_equipo");

    const supabase = await createClient();

    // No se puede cambiar el rol del owner
    const { data: miembro } = await supabase
      .from("usuarios_organizacion")
      .select("rol, user_id")
      .eq("id", miembroId)
      .eq("organizacion_id", ctx.orgId)
      .single();

    if (!miembro) return { success: false, error: "Miembro no encontrado" };
    if (miembro.rol === "owner") return { success: false, error: "No se puede cambiar el rol del propietario" };
    if (miembro.user_id === ctx.userId) return { success: false, error: "No puedes cambiar tu propio rol" };

    const { error } = await supabase
      .from("usuarios_organizacion")
      .update({ rol: nuevoRol })
      .eq("id", miembroId)
      .eq("organizacion_id", ctx.orgId);

    if (error) return { success: false, error: safeError("cambiarRolMiembro", error) };
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al cambiar rol. Intenta de nuevo." };
  }
}

/** Desactiva un miembro de la organización */
export async function desactivarMiembro(
  miembroId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_equipo");

    const supabase = await createClient();

    // No se puede desactivar al owner
    const { data: miembro } = await supabase
      .from("usuarios_organizacion")
      .select("rol, user_id")
      .eq("id", miembroId)
      .eq("organizacion_id", ctx.orgId)
      .single();

    if (!miembro) return { success: false, error: "Miembro no encontrado" };
    if (miembro.rol === "owner") return { success: false, error: "No se puede desactivar al propietario" };
    if (miembro.user_id === ctx.userId) return { success: false, error: "No puedes desactivarte a ti mismo" };

    const { error } = await supabase
      .from("usuarios_organizacion")
      .update({ activo: false })
      .eq("id", miembroId)
      .eq("organizacion_id", ctx.orgId);

    if (error) return { success: false, error: safeError("desactivarMiembro", error) };
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al desactivar miembro. Intenta de nuevo." };
  }
}

/** Acepta una invitación usando el token */
export async function aceptarInvitacion(
  token: string
): Promise<{ success: boolean; orgNombre?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    // Buscar invitación válida
    const { data: invitacion } = await supabase
      .from("invitaciones")
      .select("*, organizacion:organizaciones!inner(id, nombre)")
      .eq("token", token)
      .eq("usado", false)
      .single();

    if (!invitacion) {
      return { success: false, error: "Invitación no encontrada o ya fue usada." };
    }

    // Verificar que no haya expirado
    if (new Date(invitacion.expira_at) < new Date()) {
      return { success: false, error: "Esta invitación ha expirado." };
    }

    const org = invitacion.organizacion as unknown as { id: string; nombre: string };

    // Verificar que no sea ya miembro
    const { data: existente } = await supabase
      .from("usuarios_organizacion")
      .select("id")
      .eq("organizacion_id", org.id)
      .eq("user_id", user.id)
      .single();

    if (existente) {
      return { success: false, error: "Ya eres miembro de esta organización." };
    }

    // Crear membership
    const { error: memberError } = await supabase
      .from("usuarios_organizacion")
      .insert({
        organizacion_id: org.id,
        user_id: user.id,
        rol: invitacion.rol,
        invitado_por: invitacion.invitado_por,
        invitado_email: invitacion.email,
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      return { success: false, error: safeError("aceptarInvitacion", memberError) };
    }

    // Marcar invitación como usada
    await supabase
      .from("invitaciones")
      .update({ usado: true })
      .eq("id", invitacion.id);

    return { success: true, orgNombre: org.nombre };
  } catch (error: unknown) {
    return { success: false, error: "Error al aceptar invitación. Intenta de nuevo." };
  }
}

/** Cancela una invitación pendiente */
export async function cancelarInvitacion(
  invitacionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "gestionar_equipo");

    const supabase = await createClient();
    const { error } = await supabase
      .from("invitaciones")
      .update({ usado: true })
      .eq("id", invitacionId)
      .eq("organizacion_id", ctx.orgId);

    if (error) return { success: false, error: safeError("cancelarInvitacion", error) };
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Error al cancelar invitación. Intenta de nuevo." };
  }
}
