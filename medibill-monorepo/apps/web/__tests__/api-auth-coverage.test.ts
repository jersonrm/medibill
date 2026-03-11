import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Test estático de cobertura de autenticación en API routes.
 * Verifica que CADA route handler contiene al menos un patrón de auth reconocido.
 *
 * Si este test falla, significa que alguien agregó una API route sin protección de auth.
 * El middleware NO protege /api/* — cada route DEBE verificar auth internamente.
 */

const API_DIR = path.resolve(__dirname, "../app/api");

// Patterns de auth válidos que deben aparecer en cada route
const AUTH_PATTERNS = [
  "getUser",                   // Supabase user auth
  "CRON_SECRET",               // Cron job bearer token
  "TELEGRAM_WEBHOOK_SECRET",   // Telegram webhook secret header
  "verificarWebhookFirma",     // Wompi HMAC signature
];

// Routes públicas que intencionalmente NO requieren auth
const PUBLIC_ROUTES = [
  "api/health",
];

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      results.push(fullPath);
    }
  }
  return results;
}

describe("API routes auth coverage", () => {
  const routeFiles = findRouteFiles(API_DIR);

  it("should find at least 5 API route files", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const routeFile of routeFiles) {
    const relativePath = path.relative(path.resolve(__dirname, ".."), routeFile).replace(/\\/g, "/");

    // Skip public routes
    const isPublic = PUBLIC_ROUTES.some((pub) => relativePath.includes(pub));
    if (isPublic) continue;

    it(`${relativePath} must contain an auth check`, () => {
      const content = fs.readFileSync(routeFile, "utf-8");
      const hasAuth = AUTH_PATTERNS.some((pattern) => content.includes(pattern));
      expect(
        hasAuth,
        `${relativePath} no contiene ningún patrón de auth (${AUTH_PATTERNS.join(", ")}). ` +
        `Cada API route DEBE verificar auth internamente. ` +
        `Si es intencionalmente público, agregar a PUBLIC_ROUTES en este test.`
      ).toBe(true);
    });
  }
});
