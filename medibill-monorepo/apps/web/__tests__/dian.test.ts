/**
 * Tests para dian.ts + matias-client.ts — Integración DIAN vía Matias API
 *
 * Cubre:
 *   - enviarFacturaDian: validación estado, mapeo, envío, estado transitions
 *   - consultarEstadoDian: estado aceptada/rechazada
 *   - descargarXmlFirmado / descargarPdfDian
 *   - matias-client: autenticación PAT vs OAuth2, retry 401, throw 402
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  crearEstadoMock,
  configurarTabla,
  setupSupabaseMock,
  type MockSupabaseState,
} from "./helpers/supabase-mock";
import { crearFacturaCompleta, crearPacienteMock, crearPerfilMock, crearResolucionMock } from "./helpers/fixtures";

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

vi.mock("@/lib/providers/matias-mapper", () => ({
  mapFacturaToMatiasJson: vi.fn().mockReturnValue({ mocked: true }),
}));

const mockEnviarFactura = vi.fn();
const mockConsultarEstado = vi.fn();
const mockDescargarXml = vi.fn();
const mockDescargarPdf = vi.fn();

vi.mock("@/lib/providers/matias-client", () => ({
  enviarFactura: (...args: unknown[]) => mockEnviarFactura(...args),
  consultarEstado: (...args: unknown[]) => mockConsultarEstado(...args),
  descargarXml: (...args: unknown[]) => mockDescargarXml(...args),
  descargarPdf: (...args: unknown[]) => mockDescargarPdf(...args),
}));

// =====================================================================
// FIXTURES
// =====================================================================

function facturaAprobadaConPaciente(overrides?: Record<string, unknown>) {
  return {
    ...crearFacturaCompleta({ estado: "aprobada" }),
    pacientes: crearPacienteMock(),
    estado_dian: null,
    ...overrides,
  };
}

// =====================================================================
// TESTS — enviarFacturaDian
// =====================================================================

describe("enviarFacturaDian", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  it("retorna error si no autenticado", async () => {
    mockState.user = null;
    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No autenticado");
  });

  it("retorna error si factura no encontrada", async () => {
    configurarTabla(mockState, "facturas", "select", { data: null, error: { message: "not found" } });
    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("non-existent");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrada");
  });

  it("rechaza si factura no está en estado aprobada/descargada", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaAprobadaConPaciente({ estado: "borrador" }),
      error: null,
    });
    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("aprobada");
  });

  it("rechaza si ya fue enviada a la DIAN", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaAprobadaConPaciente({ estado_dian: "enviada" }),
      error: null,
    });
    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ya fue enviada");
  });

  it("envía factura exitosamente y retorna cufe + trackId", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaAprobadaConPaciente(),
      error: null,
    });
    configurarTabla(mockState, "perfiles", "select", {
      data: crearPerfilMock(),
      error: null,
    });
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockEnviarFactura.mockResolvedValue({
      success: true,
      document: { document_key: "CUFE-123-ABC" },
    });

    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cufe).toBe("CUFE-123-ABC");
      expect(result.trackId).toBe("CUFE-123-ABC");
    }
  });

  it("retorna error estructurado si Matias rechaza la factura", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaAprobadaConPaciente(),
      error: null,
    });
    configurarTabla(mockState, "perfiles", "select", {
      data: crearPerfilMock(),
      error: null,
    });
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock(),
      error: null,
    });

    mockEnviarFactura.mockResolvedValue({
      success: false,
      errors: { nit: ["NIT inválido"], total: ["Total no coincide"] },
    });

    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("NIT inválido");
      expect(result.error).toContain("Total no coincide");
    }
  });

  it("maneja errores de conexión con Matias API", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: facturaAprobadaConPaciente(),
      error: null,
    });
    configurarTabla(mockState, "perfiles", "select", {
      data: crearPerfilMock(),
      error: null,
    });
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock(),
      error: null,
    });

    mockEnviarFactura.mockRejectedValue(new Error("ECONNREFUSED"));

    const { enviarFacturaDian } = await import("@/app/actions/dian");
    const result = await enviarFacturaDian("factura-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ECONNREFUSED");
  });
});

// =====================================================================
// TESTS — consultarEstadoDian
// =====================================================================

describe("consultarEstadoDian", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  it("retorna error si no autenticado", async () => {
    mockState.user = null;
    const { consultarEstadoDian } = await import("@/app/actions/dian");
    const result = await consultarEstadoDian("factura-1");
    expect(result.success).toBe(false);
  });

  it("retorna error si factura sin track_id_dian", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: null, estado_dian: null },
      error: null,
    });
    const { consultarEstadoDian } = await import("@/app/actions/dian");
    const result = await consultarEstadoDian("factura-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no ha sido enviada");
  });

  it("actualiza estado a 'aceptada' cuando DIAN valida", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: "TRACK-1", estado_dian: "enviada" },
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockConsultarEstado.mockResolvedValue({
      document: { is_valid: true, status: "Documento aceptado" },
    });

    const { consultarEstadoDian } = await import("@/app/actions/dian");
    const result = await consultarEstadoDian("factura-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.estadoDian).toBe("aceptada");
      expect(result.mensaje).toBe("Documento aceptado");
    }
  });

  it("actualiza estado a 'rechazada' cuando DIAN rechaza", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: "TRACK-1", estado_dian: "enviada" },
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    mockConsultarEstado.mockResolvedValue({
      document: { is_valid: false, status: "Documento rechazado por errores" },
    });

    const { consultarEstadoDian } = await import("@/app/actions/dian");
    const result = await consultarEstadoDian("factura-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.estadoDian).toBe("rechazada");
    }
  });
});

// =====================================================================
// TESTS — descargarXmlFirmado / descargarPdfDian
// =====================================================================

describe("descargarXmlFirmado", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  it("retorna XML firmado desde Matias API", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: "TRACK-1", estado_dian: "aceptada" },
      error: null,
    });
    mockDescargarXml.mockResolvedValue("<xml>firmado</xml>");

    const { descargarXmlFirmado } = await import("@/app/actions/dian");
    const result = await descargarXmlFirmado("factura-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.xml).toBe("<xml>firmado</xml>");
  });

  it("retorna error si factura sin track_id", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: null },
      error: null,
    });

    const { descargarXmlFirmado } = await import("@/app/actions/dian");
    const result = await descargarXmlFirmado("factura-1");

    expect(result.success).toBe(false);
  });
});

describe("descargarPdfDian", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  it("retorna PDF en base64 desde Matias API", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { track_id_dian: "TRACK-1", estado_dian: "aceptada" },
      error: null,
    });

    const pdfBuffer = new ArrayBuffer(4);
    const view = new Uint8Array(pdfBuffer);
    view[0] = 0x25; view[1] = 0x50; view[2] = 0x44; view[3] = 0x46; // %PDF
    mockDescargarPdf.mockResolvedValue(pdfBuffer);

    const { descargarPdfDian } = await import("@/app/actions/dian");
    const result = await descargarPdfDian("factura-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.pdfBase64.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// TESTS — matias-client (autenticación y HTTP)
// =====================================================================

describe("matias-client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("MATIAS_API_URL", "https://matias-test.api");
    vi.stubEnv("MATIAS_PAT_TOKEN", "");
    vi.stubEnv("MATIAS_API_EMAIL", "test@mail.com");
    vi.stubEnv("MATIAS_API_PASSWORD", "pass123");
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("usa PAT directamente si está configurado", async () => {
    vi.stubEnv("MATIAS_PAT_TOKEN", "my-pat-token-123");
    const mod = await vi.importActual<typeof import("@/lib/providers/matias-client")>("@/lib/providers/matias-client");
    if ("limpiarTokenCache" in mod) (mod as { limpiarTokenCache: () => void }).limpiarTokenCache();
    const token = await mod.autenticar();
    expect(token).toBe("my-pat-token-123");
  });

  it("hace login OAuth2 cuando no hay PAT", async () => {
    vi.stubEnv("MATIAS_PAT_TOKEN", "");
    const mod = await vi.importActual<typeof import("@/lib/providers/matias-client")>("@/lib/providers/matias-client");
    if ("limpiarTokenCache" in mod) (mod as { limpiarTokenCache: () => void }).limpiarTokenCache();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "oauth-token-xyz", expires_in: 7776000 }),
    });

    const token = await mod.autenticar();
    expect(token).toBe("oauth-token-xyz");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("lanza error en 402 (límite de consumo)", async () => {
    vi.stubEnv("MATIAS_PAT_TOKEN", "valid-pat");
    const mod = await vi.importActual<typeof import("@/lib/providers/matias-client")>("@/lib/providers/matias-client");
    if ("limpiarTokenCache" in mod) (mod as { limpiarTokenCache: () => void }).limpiarTokenCache();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => "Payment required",
    });

    await expect(mod.enviarFactura({} as never)).rejects.toThrow("Límite de consumo");
  });

  it("retry una vez en 401 Unauthorized", async () => {
    vi.stubEnv("MATIAS_PAT_TOKEN", "");
    const mod = await vi.importActual<typeof import("@/lib/providers/matias-client")>("@/lib/providers/matias-client");
    if ("limpiarTokenCache" in mod) (mod as { limpiarTokenCache: () => void }).limpiarTokenCache();

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/auth/login")) {
        return {
          ok: true,
          json: async () => ({ token: `token-${++callCount}`, expires_in: 7776000 }),
        };
      }
      if (String(url).includes("/invoice")) {
        if (callCount <= 1) {
          return { ok: false, status: 401, text: async () => "Unauthorized" };
        }
        return {
          ok: true,
          json: async () => ({ success: true, document: { document_key: "KEY" } }),
        };
      }
      return { ok: false, status: 500, text: async () => "Error" };
    });

    const result = await mod.enviarFactura({} as never);
    expect(result.success).toBe(true);
  });
});
