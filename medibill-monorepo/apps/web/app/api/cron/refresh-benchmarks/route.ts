import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron endpoint: refresca las vistas materializadas de benchmarks
 * y limpia clasificaciones_pendientes expiradas (Fase 2).
 * Protegido con CRON_SECRET. Frecuencia: diario (Vercel Cron).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Refrescar las 4 vistas materializadas de benchmarks
  const { data: refreshResult, error: refreshError } = await supabase.rpc(
    "refresh_benchmark_views",
  );

  // Limpiar clasificaciones_pendientes expiradas (de Fase 2)
  const { count, error: cleanError } = await supabase
    .from("clasificaciones_pendientes")
    .delete()
    .lt("expira_at", new Date().toISOString());

  return NextResponse.json({
    benchmarks: refreshError ? refreshError.message : refreshResult,
    clasificaciones_limpiadas: cleanError ? cleanError.message : (count ?? 0),
  });
}
