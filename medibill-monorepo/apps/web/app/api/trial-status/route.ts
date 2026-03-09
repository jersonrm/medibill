import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ trialing: false });

  const { data: membership } = await supabase
    .from("usuarios_organizacion")
    .select("organizacion_id")
    .eq("user_id", user.id)
    .eq("activo", true)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ trialing: false });

  const { data: sub } = await supabase
    .from("suscripciones")
    .select("estado, fin_periodo_actual")
    .eq("organizacion_id", membership.organizacion_id)
    .single();

  if (!sub || sub.estado !== "trialing") {
    return NextResponse.json({ trialing: false });
  }

  const diasRestantes = Math.max(
    0,
    Math.ceil(
      (new Date(sub.fin_periodo_actual).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  return NextResponse.json({ trialing: true, diasRestantes });
}
