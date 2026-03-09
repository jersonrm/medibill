/**
 * Rate limiter distribuido con Upstash Redis + fallback in-memory.
 * Uso: const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });
 *      if (await limiter.isLimited(userId)) return 429;
 *
 * En producción usa Upstash Redis (sliding window).
 * En desarrollo (sin UPSTASH_REDIS_REST_URL) usa Map in-memory.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimiterOptions {
  /** Máximo de requests permitidos en la ventana */
  max: number;
  /** Duración de la ventana en milisegundos */
  windowMs: number;
}

/** Singleton Redis para no crear múltiples conexiones */
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function msToDuration(ms: number): `${number} ms` | `${number} s` | `${number} m` | `${number} h` {
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} m`;
  if (ms >= 1000 && ms % 1000 === 0) return `${ms / 1000} s`;
  return `${ms} ms`;
}

export function createRateLimiter(opts: RateLimiterOptions) {
  const r = getRedis();

  if (r) {
    const limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(opts.max, msToDuration(opts.windowMs)),
    });

    return {
      async isLimited(key: string, _supabase?: unknown): Promise<boolean> {
        const { success } = await limiter.limit(key);
        return !success;
      },
    };
  }

  // Fallback in-memory para desarrollo local
  const map = new Map<string, { count: number; resetAt: number }>();

  if (typeof globalThis !== "undefined") {
    const CLEANUP_INTERVAL = 5 * 60_000;
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of map) {
        if (now > v.resetAt) map.delete(k);
      }
    }, CLEANUP_INTERVAL).unref?.();
  }

  return {
    async isLimited(key: string, _supabase?: unknown): Promise<boolean> {
      const now = Date.now();
      const entry = map.get(key);

      if (!entry || now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + opts.windowMs });
        return false;
      }

      entry.count++;
      return entry.count > opts.max;
    },
  };
}
