import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

const isDev = process.env.NODE_ENV === 'development';

/** Best-effort extraction of x-request-id from incoming request headers. */
async function getRequestId(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

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

export async function devError(label: string, ...args: unknown[]) {
  if (isDev) {
    console.error(`[DEV] ${label}`, ...args);
  } else {
    const requestId = await getRequestId();
    const error = args.find((a) => a instanceof Error);
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { label, ...(requestId ? { request_id: requestId } : {}) },
      });
    } else {
      Sentry.captureMessage(`${label}: ${String(args[0] ?? "")}`, {
        level: "error",
        tags: { ...(requestId ? { request_id: requestId } : {}) },
      });
    }
    console.error(
      JSON.stringify({
        level: "error",
        label,
        ...(requestId ? { request_id: requestId } : {}),
        message: error instanceof Error ? error.message : String(args[0] ?? ""),
        ts: new Date().toISOString(),
      })
    );
  }
}


