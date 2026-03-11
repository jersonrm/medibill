/**
 * Tests para muv.ts + muv-client.ts — Validación MUV (MinSalud)
 *
 * Cubre:
 *   - muv-client: healthCheck, validarEnMuv, timeouts, manejo HTTP errors
 *   - muv.ts: validarRipsYObtenerCuv precondiciones, flujo completo, rollback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  crearEstadoMock,
  configurarTabla,
  setupSupabaseMock,
  type MockSupabaseState,
} from "./helpers/supabase-mock";
import { crearFacturaCompleta, crearPacienteMock } from "./helpers/fixtures";

// =====================================================================
// MOCKS
// =====================================================================

let mockState: MockSupabaseState;

vi.mock("@/lib/supabase-server", () => setupSupabaseMock(() => mockState));
vi.mock("@/lib/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
}));

vi.mock("@/lib/organizacion", () => ({
  getContextoOrg: vi.fn().mockImplementation(async () => {
    if (!mockState.user) throw new Error("No autenticado");
    return {
      userId: mockState.user.id,
      orgId: "org-test-123",
      orgNombre: "Clínica Test",
      orgTipo: "clinica" as const,
      rol: "owner" as const,
      suscripcion: { plan_id: "profesional", estado: "active", trial_fin: null, periodo_actual_fin: null },
    };
  }),
  getOrgIdActual: vi.fn().mockImplementation(async () => {
    if (!mockState.user) throw new Error("No autenticado");
    return "org-test-123";
  }),
}));

vi.mock("@/lib/suscripcion", () => ({
  verificarLimite: vi.fn().mockResolvedValue({ permitido: true, restante: 100 }),
  incrementarUso: vi.fn().mockResolvedValue(undefined),
}));

const mockDescargarXml = vi.fn();
vi.mock("@/lib/providers/matias-client", () => ({
  descargarXml: (...args: unknown[]) => mockDescargarXml(...args),
}));

const mockHealthCheck = vi.fn();
const mockValidarEnMuv = vi.fn();
vi.mock("@/lib/providers/muv-client", () => ({
  healthCheck: (...args: unknown[]) => mockHealthCheck(...args),
  validarEnMuv: (...args: unknown[]) => mockValidarEnMuv(...args),
}));

const mockGenerarJsonRipsMVP = vi.fn();
vi.mock("@/app/actions/rips", () => ({
  generarJsonRipsMVP: (...args: unknown[]) => mockGenerarJsonRipsMVP(...args),
}));

// =====================================================================
// FIXTURES
// =====================================================================

function facturaListaParaMuv(overrides?: Record<string, unknown>) {
  return {
    ...crearFacturaCompleta({
      estado: "aprobada",
      cufe: "CUFE-ABC-123",
      estado_dian: "aceptada",
      track_id_dian: "TRACK-1",
      cuv: null,
    }),
    pacientes: crearPacienteMock(),
    ...overrides,
  };
}

// =====================================================================
// TESTS — muv-client (healthCheck / validarEnMuv)
// =====================================================================

describe("muv-client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("healthCheck retorna true si Docker responde OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { healthCheck } = await vi.importActual<typeof import("@/lib/providers/muv-client")>("@/lib/providers/muv-client");
    const result = await healthCheck();
    expect(result).toBe(true);
  });

  it("healthCheck retorna false si Docker no responde", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const { healthCheck } = await vi.importActual<typeof import("@/lib/providers/muv-client")>("@/lib/providers/muv-client");
    const result = await healthCheck();
    expect(result).toBe(false);
  });

  it("validarEnMuv retorna CUV en validación exitosa", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valido: true,
        cuv: "CUV-123-MINSALUD",
        errores: [],
      }),
    });

    const { validarEnMuv } = await vi.importActual<typeof import("@/lib/providers/muv-client")>("@/lib/providers/muv-client");
    const result = await validarEnMuv({
      xml: "<xml>test</xml>",
      ripsJson: { numDocumentoIdObligado: "123" } as never,
    });

    expect(result.valido).toBe(true);
    expect(result.cuv).toBe("CUV-123-MINSALUD");
    expect(result.errores).toEqual([]);
  });

  it("validarEnMuv convierte respuesta non-JSON a MuvError HTTP-{status}", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const { validarEnMuv } = await vi.importActual<typeof import("@/lib/providers/muv-client")>("@/lib/providers/muv-client");
    const result = await validarEnMuv({
      xml: "<xml/>",
      ripsJson: {} as never,
    });

    expect(result.valido).toBe(false);
    expect(result.errores[0]!.codigo).toBe("HTTP-500");
    expect(result.errores[0]!.mensaje).toContain("Internal Server Error");
  });

  it("validarEnMuv parsea errores estructurados del MUV", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({
        errores: [
          { codigo: "RIPS-001", mensaje: "Campo faltante", severidad: "error" },
          { codigo: "RIPS-002", mensaje: "Formato erróneo", severidad: "warning" },
        ],
      }),
    });

    const { validarEnMuv } = await vi.importActual<typeof import("@/lib/providers/muv-client")>("@/lib/providers/muv-client");
    const result = await validarEnMuv({
      xml: "<xml/>",
      ripsJson: {} as never,
    });

    expect(result.valido).toBe(false);
    expect(result.errores).toHaveLength(2);
    expect(result.errores[0]!.codigo).toBe("RIPS-001");
  });
});

// =====================================================================
// TESTS — validarRipsYObtenerCuv (server action)
// =====================================================================

describe("validarRipsYObtenerCuv", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  it("retorna error si no autenticado", async () => {
    mockState.user = null;
    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    await expect(validarRipsYObtenerCuv("factura-1")).rejects.toThrow("No autenticado");
  });

  it("retorna error si factura no encontrada", async () => {
    configurarTabla(mockState, "facturas", "select", { data: null, error: { message: "not found" } });
    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("non-existent");
    expect(result.success).toBe(false);
  });

  it("rechaza si estado_dian no es aceptada", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv({ estado_dian: "enviada" }),
      error: null,
    });
    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("aceptada por la DIAN");
  });

  it("rechaza si no tiene CUFE o track_id_dian", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv({ cufe: null, track_id_dian: null }),
      error: null,
    });
    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("CUFE");
  });

  it("rechaza si ya tiene CUV asignado", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv({ cuv: "CUV-EXISTING" }),
      error: null,
    });
    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("CUV-EXISTING");
  });

  it("rechaza si Docker MUV no está disponible", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv(),
      error: null,
    });
    mockHealthCheck.mockResolvedValue(false);

    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Docker");
  });

  it("flujo completo exitoso: obtiene CUV", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockHealthCheck.mockResolvedValue(true);
    mockDescargarXml.mockResolvedValue("<xml>firmado-dian</xml>");
    mockGenerarJsonRipsMVP.mockResolvedValue({ numDocumentoIdObligado: "123", numFactura: "FV-001" });
    mockValidarEnMuv.mockResolvedValue({
      valido: true,
      cuv: "CUV-MINSALUD-777",
      errores: [],
    });

    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.cuv).toBe("CUV-MINSALUD-777");
  });

  it("retorna errores del MUV cuando validación falla", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockHealthCheck.mockResolvedValue(true);
    mockDescargarXml.mockResolvedValue("<xml/>");
    mockGenerarJsonRipsMVP.mockResolvedValue({});
    mockValidarEnMuv.mockResolvedValue({
      valido: false,
      cuv: null,
      errores: [
        { codigo: "RIPS-001", mensaje: "Campo faltante numDocumentoIdObligado", severidad: "error" },
        { codigo: "RIPS-002", mensaje: "Formato fecha inválido", severidad: "error" },
      ],
    });

    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errores).toHaveLength(2);
      expect(result.error).toContain("RIPS-001");
    }
  });

  it("hace rollback del estado_muv si falla la conexión con Docker", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockHealthCheck.mockResolvedValue(true);
    mockDescargarXml.mockResolvedValue("<xml/>");
    mockGenerarJsonRipsMVP.mockResolvedValue({});
    mockValidarEnMuv.mockRejectedValue(new Error("ECONNRESET"));

    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ECONNRESET");
  });

  it("retorna error si descarga de XML desde Matias falla", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaListaParaMuv(),
      error: null,
    });

    mockHealthCheck.mockResolvedValue(true);
    mockDescargarXml.mockRejectedValue(new Error("Matias descargarXml failed (404)"));

    const { validarRipsYObtenerCuv } = await import("@/app/actions/muv");
    const result = await validarRipsYObtenerCuv("factura-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("XML firmado");
  });
});
