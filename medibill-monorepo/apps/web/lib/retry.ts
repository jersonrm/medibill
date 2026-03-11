/**
 * Utilidad de retry con exponential backoff.
 *
 * Solo reintenta errores transitorios (429 rate limit, 5xx server).
 * NO agrega latencia en llamadas exitosas.
 * NO modifica la respuesta — solo re-ejecuta si hay error transitorio.
 */

import { devWarn } from "@/lib/logger";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;

interface RetryOptions {
  /** Número máximo de reintentos (default: 3) */
  maxRetries?: number;
  /** Delay base en ms, se duplica en cada intento (default: 1000) */
  baseDelayMs?: number;
  /** Label para logs (ej: "Gemini clasificación") */
  label?: string;
}

/**
 * Determina si un error es transitorio y merece reintento.
 * Solo 429 (rate limit) y 5xx (server error) se reintentan.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    // Google AI SDK incluye status en el mensaje o en propiedades
    if (msg.includes("429") || msg.includes("Too Many Requests")) return true;
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
    if (msg.includes("RESOURCE_EXHAUSTED")) return true;
    if (msg.includes("UNAVAILABLE") || msg.includes("INTERNAL")) return true;

    // Propiedad status del SDK de Google AI / fetch errors
    const status = (error as unknown as Record<string, unknown>).status;
    if (typeof status === "number") {
      return status === 429 || status >= 500;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta `fn` con retry automático en errores transitorios.
 *
 * - Llamadas exitosas: cero overhead.
 * - Errores 4xx (no 429): falla inmediatamente sin retry.
 * - Errores 429/5xx: reintenta hasta `maxRetries` veces con backoff exponencial.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const label = options.label ?? "withRetry";

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isTransientError(error)) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
      devWarn(
        `${label} — intento ${attempt + 1}/${maxRetries + 1} falló (reintentando en ${delay}ms)`,
        error instanceof Error ? error.message : error,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
