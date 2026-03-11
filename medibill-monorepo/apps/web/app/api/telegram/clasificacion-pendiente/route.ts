import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * GET /api/telegram/clasificacion-pendiente?token=UUID
 * Devuelve la clasificación pendiente para el deep link desde Telegram.
 * Requiere autenticación (el usuario debe estar logueado).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("clasificaciones_pendientes")
    .select("*")
    .eq("token", token)
    .eq("user_id", user.id)
    .gt("expira_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Clasificación no encontrada o expirada" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
