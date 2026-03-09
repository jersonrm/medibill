import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === 'development';

export function devLog(label: string, ...args: unknown[]) {
  if (isDev) console.log(`[DEV] ${label}`, ...args);
}

export function devWarn(label: string, ...args: unknown[]) {
  if (isDev) {
    console.warn(`[DEV] ${label}`, ...args);
  } else {
    console.warn(JSON.stringify({ level: "warn", label, ts: new Date().toISOString() }));
  }
}

export function devError(label: string, ...args: unknown[]) {
  if (isDev) {
    console.error(`[DEV] ${label}`, ...args);
  } else {
    const error = args.find((a) => a instanceof Error);
    if (error instanceof Error) {
      Sentry.captureException(error, { tags: { label } });
    } else {
      Sentry.captureMessage(`${label}: ${String(args[0] ?? "")}`, { level: "error" });
    }
    console.error(
      JSON.stringify({
        level: "error",
        label,
        message: error instanceof Error ? error.message : String(args[0] ?? ""),
        ts: new Date().toISOString(),
      })
    );
  }
}

/**
 * Registra un evento de auditoría en Supabase (fire-and-forget).
 * Usar para: auth fallidos, rate limits excedidos, errores de facturación.
 */
export function logAudit(
  supabase: SupabaseClient,
  event: { action: string; user_id?: string; metadata?: Record<string, unknown> }
) {
  supabase
    .from("audit_log")
    .insert({
      action: event.action,
      user_id: event.user_id ?? null,
      metadata: event.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) {
        console.error(
          JSON.stringify({ level: "error", label: "audit_log_failed", action: event.action })
        );
      }
    });
}
