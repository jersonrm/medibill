"use server";

import { createClient } from "@/lib/supabase-server";

/**
 * Registra una entrada en la tabla audit_log.
 * Se ejecuta fire-and-forget: no bloquea ni lanza errores al caller.
 */
export async function registrarAuditLog(params: {
  accion: string;
  tabla: string;
  registroId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_log").insert({
      user_id: user.id,
      accion: params.accion,
      tabla: params.tabla,
      registro_id: params.registroId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    // Audit log nunca debe romper el flujo principal — pero sí loguear el fallo
    console.error(JSON.stringify({ level: "error", label: "audit_log_failed", accion: params.accion, ts: new Date().toISOString(), message: e instanceof Error ? e.message : String(e) }));
  }
}
