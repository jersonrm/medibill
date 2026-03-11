"use server";

import { createClient } from "@/lib/supabase-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// 3 intentos de recuperación / 15 min por IP
const resetLimiter = createRateLimiter({ max: 3, windowMs: 15 * 60_000 });

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function solicitarRecuperacion(formData: FormData) {
  const supabase = await createClient();
  const ip = await getClientIp();

  if (await resetLimiter.isLimited(`reset:${ip}`, supabase)) {
    return redirect("/login?mensaje=demasiados_intentos");
  }

  const email = (formData.get("email") as string)?.trim();

  if (!email) {
    return redirect("/forgot-password?error=1");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/login`,
  });

  if (error) {
    return redirect("/login?mensaje=password_reset_error");
  }

  // Always redirect with success message to avoid email enumeration
  return redirect("/login?mensaje=password_reset_ok");
}
