/**
 * Tests para facturas.ts — server actions de facturación
 *
 * Verifica:
 * - obtenerSiguienteNumeroFactura: consecutivo desde resolución activa / fallback
 * - crearFacturaBorrador: creación con número temporal, upsert paciente, snapshot perfil
 * - aprobarFactura: transición borrador→aprobada, asignación de número real, rango agotado
 * - anularFactura: solo borrador
 * - marcarComoDescargada: solo aprobada
 * - editarFacturaBorrador: merge metadata, upsert paciente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearCrearFacturaInput,
  crearPerfilMock,
  crearResolucionMock,
  crearPacienteMock,
  crearFacturaCompleta,
} from "./helpers/fixtures";
import {
  crearEstadoMock,
  configurarTabla,
  configurarSecuencia,
  configurarRpc,
  type MockSupabaseState,
} from "./helpers/supabase-mock";

// =====================================================================
// MOCK SETUP
// =====================================================================

let mockState: MockSupabaseState;

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn().mockImplementation(async () => {
    const { crearSupabaseMock } = await import("./helpers/supabase-mock");
    return crearSupabaseMock(mockState);
  }),
}));

vi.mock("@/lib/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
}));

// Mock organizacion — getContextoOrg / getOrgIdActual depend on mockState.user
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

// Mock suscripcion — verificarLimite permits by default, incrementarUso is a no-op
vi.mock("@/lib/suscripcion", () => ({
  verificarLimite: vi.fn().mockResolvedValue({ permitido: true, restante: 100 }),
  incrementarUso: vi.fn().mockResolvedValue(undefined),
}));

// =====================================================================
// TESTS
// =====================================================================

describe("obtenerSiguienteNumeroFactura", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("retorna consecutivo_actual + 1 con prefijo de la resolución activa", async () => {
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock({ prefijo: "FV-", consecutivo_actual: 5 }),
      error: null,
    });

    const { obtenerSiguienteNumeroFactura } = await import("@/app/actions/facturas");
    const result = await obtenerSiguienteNumeroFactura();

    expect(result.numero).toBe("FV-6");
    expect(result.resolucion_id).toBe("resolucion-uuid-1");
  });

  it("usa rango_inicio cuando consecutivo_actual es null", async () => {
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock({ prefijo: "FV-", consecutivo_actual: null, rango_inicio: 100 }),
      error: null,
    });

    const { obtenerSiguienteNumeroFactura } = await import("@/app/actions/facturas");
    const result = await obtenerSiguienteNumeroFactura();

    expect(result.numero).toBe("FV-100");
  });

  it("retorna error cuando no hay resolución activa", async () => {
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: null,
      error: { message: "No rows" },
    });

    const { obtenerSiguienteNumeroFactura } = await import("@/app/actions/facturas");
    const result = await obtenerSiguienteNumeroFactura();

    expect(result.numero).toBe("");
    expect(result.resolucion_id).toBeNull();
    expect(result.error).toBeDefined();
  });

  it("retorna error cuando no hay usuario autenticado", async () => {
    mockState.user = null;

    const { obtenerSiguienteNumeroFactura } = await import("@/app/actions/facturas");
    await expect(obtenerSiguienteNumeroFactura()).rejects.toThrow("No autenticado");
  });
});

describe("crearFacturaBorrador", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    // Default mocks for successful creation
    configurarTabla(mockState, "resoluciones_facturacion", "select", {
      data: crearResolucionMock(),
      error: null,
    });
    configurarTabla(mockState, "perfiles", "select", {
      data: crearPerfilMock(),
      error: null,
    });
    configurarTabla(mockState, "pacientes", "upsert", {
      data: crearPacienteMock(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "insert", {
      data: { id: "factura-new-1", num_factura: "BORR-ABC123" },
      error: null,
    });
  });

  it("crea factura en estado borrador con número temporal BORR-xxx", async () => {
    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    const input = crearCrearFacturaInput();
    const result = await crearFacturaBorrador(input);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.id).toBe("factura-new-1");
  });

  it("retorna error cuando no hay usuario autenticado", async () => {
    mockState.user = null;

    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    await expect(crearFacturaBorrador(crearCrearFacturaInput())).rejects.toThrow("No autenticado");
  });

  it("retorna error cuando la inserción de factura falla", async () => {
    configurarTabla(mockState, "facturas", "insert", {
      data: null,
      error: { message: "DB error inserting invoice" },
    });

    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    const result = await crearFacturaBorrador(crearCrearFacturaInput());

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });
});

describe("aprobarFactura", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("transiciona borrador a aprobada y asigna número real", async () => {
    // Mock: find factura as borrador
    configurarSecuencia(mockState, "facturas", "select", [
      { data: { id: "f1", resolucion_id: "r1", estado: "borrador" }, error: null },
    ]);
    // Mock: RPC atómica para asignar consecutivo
    configurarRpc(mockState, "siguiente_numero_factura", {
      data: [{ numero: "FV-11", resolucion_id: "r1", consecutivo: 11 }],
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const result = await aprobarFactura("f1");

    expect(result.success).toBe(true);
    expect(result.numFactura).toBe("FV-11");
  });

  it("rechaza si la factura no existe o no es borrador", async () => {
    configurarTabla(mockState, "facturas", "select", { data: null, error: null });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const result = await aprobarFactura("nonexistent");

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrada");
  });

  it("rechaza si la resolución está agotada", async () => {
    configurarSecuencia(mockState, "facturas", "select", [
      { data: { id: "f1", resolucion_id: "r1", estado: "borrador" }, error: null },
    ]);
    // Mock: RPC devuelve error de rango agotado
    configurarRpc(mockState, "siguiente_numero_factura", {
      data: null,
      error: { message: "Rango de resolución agotado (máximo: 1000). Configure una nueva resolución." },
    });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const result = await aprobarFactura("f1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("agotado");
  });

  it("rechaza si usuario no está autenticado", async () => {
    mockState.user = null;

    const { aprobarFactura } = await import("@/app/actions/facturas");
    await expect(aprobarFactura("f1")).rejects.toThrow("No autenticado");
  });
});

describe("anularFactura", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("anula una factura borrador exitosamente", async () => {
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { anularFactura } = await import("@/app/actions/facturas");
    const result = await anularFactura("f1");

    expect(result.success).toBe(true);
  });

  it("retorna error si la update falla (ej: factura no es borrador)", async () => {
    configurarTabla(mockState, "facturas", "update", {
      data: null,
      error: { message: "No matching row" },
    });

    const { anularFactura } = await import("@/app/actions/facturas");
    const result = await anularFactura("f1");

    expect(result.success).toBe(false);
  });

  it("rechaza si usuario no está autenticado", async () => {
    mockState.user = null;

    const { anularFactura } = await import("@/app/actions/facturas");
    await expect(anularFactura("f1")).rejects.toThrow("No autenticado");
  });
});

describe("marcarComoDescargada", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("transiciona aprobada a descargada", async () => {
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { marcarComoDescargada } = await import("@/app/actions/facturas");
    const result = await marcarComoDescargada("f1");

    expect(result.success).toBe(true);
  });

  it("retorna error si la factura no es aprobada", async () => {
    configurarTabla(mockState, "facturas", "update", {
      data: null,
      error: { message: "No matching row — not aprobada" },
    });

    const { marcarComoDescargada } = await import("@/app/actions/facturas");
    const result = await marcarComoDescargada("f1");

    expect(result.success).toBe(false);
  });

  it("rechaza si usuario no está autenticado", async () => {
    mockState.user = null;

    const { marcarComoDescargada } = await import("@/app/actions/facturas");
    await expect(marcarComoDescargada("f1")).rejects.toThrow("No autenticado");
  });
});

describe("editarFacturaBorrador", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("actualiza datos clínicos en factura borrador", async () => {
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { editarFacturaBorrador } = await import("@/app/actions/facturas");
    const result = await editarFacturaBorrador("f1", {
      subtotal: 120000,
      valor_total: 120000,
    });

    expect(result.success).toBe(true);
  });

  it("hace merge de metadata cuando se proporciona atencion", async () => {
    // First select to get current metadata
    configurarTabla(mockState, "facturas", "select", {
      data: { metadata: { eps_nombre: "SURA", nota_clinica_original: "dolor" } },
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { editarFacturaBorrador } = await import("@/app/actions/facturas");
    const result = await editarFacturaBorrador("f1", {
      atencion: { modalidad: "01", causa: "15", finalidad: "01", tipo_diagnostico: "01", tipo_servicio: "consulta", valor_consulta: 60000, valor_cuota: 0 },
    });

    expect(result.success).toBe(true);
  });

  it("upserts paciente cuando se proporcionan datos_paciente", async () => {
    configurarTabla(mockState, "pacientes", "upsert", {
      data: crearPacienteMock(),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { editarFacturaBorrador } = await import("@/app/actions/facturas");
    const result = await editarFacturaBorrador("f1", {
      datos_paciente: {
        tipo_documento: "CC",
        numero_documento: "987654321",
        primer_nombre: "María",
        primer_apellido: "López",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rechaza si usuario no está autenticado", async () => {
    mockState.user = null;

    const { editarFacturaBorrador } = await import("@/app/actions/facturas");
    await expect(editarFacturaBorrador("f1", { subtotal: 100 })).rejects.toThrow("No autenticado");
  });
});
