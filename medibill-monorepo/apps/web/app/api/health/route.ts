import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Supabase
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("organizaciones").select("id").limit(1);
    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  // Redis (Upstash)
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const res = await fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      checks.redis = res.ok ? "ok" : "error";
    } else {
      checks.redis = "ok"; // Sin Redis configurado (dev), no es error
    }
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
