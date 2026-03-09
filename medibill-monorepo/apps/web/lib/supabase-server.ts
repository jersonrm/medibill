import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { devWarn } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (e) {
            devWarn("Cookie set failed (expected in RSC)", e);
          }
        },
      },
    }
  );
}

/**
 * Verifica autenticación y retorna el usuario o lanza un error.
 * Uso: `const { user, supabase } = await requireUser();`
 */
export async function requireUser(): Promise<{ user: User; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { user, supabase };
}