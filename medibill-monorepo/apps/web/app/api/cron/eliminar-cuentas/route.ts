import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * Cron endpoint: purga cuentas cuyo `eliminacion_programada_at` >= 7 días.
 * Protegido con un secreto compartido vía header Authorization.
 * Llamar desde Vercel Cron, Supabase pg_cron, o similar.
 *
 * DELETE cascade: elimina perfil, membresías y datos asociados.
 * No elimina la auth.users row — se deja para que Supabase la limpie si se desea.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Buscar perfiles con eliminación programada hace más de 7 días
  const { data: perfiles, error: fetchErr } = await supabase
    .from("perfiles")
    .select("user_id")
    .not("eliminacion_programada_at", "is", null)
    .lte("eliminacion_programada_at", sieteDiasAtras);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!perfiles || perfiles.length === 0) {
    return NextResponse.json({ purged: 0 });
  }

  const userIds = perfiles.map((p) => p.user_id);

  // Eliminar membresías de organización
  await supabase
    .from("usuarios_organizacion")
    .delete()
    .in("user_id", userIds);

  // Eliminar perfiles
  await supabase
    .from("perfiles")
    .delete()
    .in("user_id", userIds);

  // Eliminar usuarios de auth (service role) — en paralelo
  const results = await Promise.allSettled(
    userIds.map((uid) => supabase.auth.admin.deleteUser(uid))
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[cron] ${failed.length}/${userIds.length} auth deletes failed`);
  }

  return NextResponse.json({ purged: userIds.length, authDeletesFailed: failed.length });
}
