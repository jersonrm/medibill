"use server";

import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Verifica si el usuario autenticado es un administrador de plataforma.
 * Usa la tabla `platform_admins` (sin RLS) vía service role key.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const service = getServiceClient();
  const { data } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  return !!data;
}

/**
 * Verifica y lanza error si no es platform admin.
 * Uso en server actions de /admin.
 */
export async function requirePlatformAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const service = getServiceClient();
  const { data } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!data) throw new Error("Acceso denegado: no es administrador de plataforma");
  return user.id;
}
