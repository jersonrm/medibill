"use server";

import { createClient } from "@/lib/supabase-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// 5 intentos de login / 15 min por IP
const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60_000 });
// 3 registros / hora por IP
const signupLimiter = createRateLimiter({ max: 3, windowMs: 60 * 60_000 });

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function iniciarSesion(formData: FormData) {
  const supabase = await createClient();
  const ip = await getClientIp();

  if (await loginLimiter.isLimited(`login:${ip}`, supabase)) {
    return redirect("/login?mensaje=demasiados_intentos");
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(`/login?mensaje=error_credenciales`);
  }

  return redirect("/");
}

export async function registrarCuenta(formData: FormData) {
  const supabase = await createClient();
  const ip = await getClientIp();

  if (await signupLimiter.isLimited(`signup:${ip}`, supabase)) {
    return redirect("/login?mensaje=demasiados_intentos");
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const consentimiento = formData.get("consentimiento");

  if (!consentimiento) {
    return redirect("/login?mensaje=consentimiento_requerido");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        consentimiento_terminos_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return redirect(`/login?mensaje=error_credenciales`);
  }

  return redirect("/login?mensaje=registro_ok");
}

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "https://medibill.co";

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Limpiar cookie de onboarding al cerrar sesión
  const cookieStore = await cookies();
  cookieStore.set("medibill_onboarding", "", { path: "/", maxAge: 0 });
  return redirect(LANDING_URL);
}