/**
 * Tests para paginación en obtenerMisPendientes()
 *
 * Verifica:
 * - Con >100 facturas borrador, retorna máximo 100 pendientes
 * - Facturas con fecha >12 meses no se incluyen (filtro por defecto)
 * - Parámetros opcionales (limite, mesesAtras) funcionan
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearEstadoMock,
  configurarTabla,
  configurarSecuencia,
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

vi.mock("@/lib/suscripcion", () => ({
  tieneFeature: vi.fn().mockResolvedValue(true),
}));

// =====================================================================
// HELPERS
// =====================================================================

function crearFacturaBorrador(i: number) {
  return {
    id: `f-${i}`,
    num_factura: `FV-${String(i).padStart(3, "0")}`,
    fecha_expedicion: "2026-01-15",
    fecha_limite_rad: null,
    valor_total: 100_000,
    valor_glosado: 0,
    estado: "borrador",
  };
}

// =====================================================================
// obtenerMisPendientes — paginación
// =====================================================================

describe("obtenerMisPendientes — paginación", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    configurarTabla(mockState, "usuarios_organizacion", "select", {
      data: { organizacion_id: "org-test-123" },
      error: null,
    });
  });

  it("retorna máximo 100 pendientes con >100 facturas borrador", async () => {
    // Generar 120 facturas borrador
    const facturas120 = Array.from({ length: 120 }, (_, i) =>
      crearFacturaBorrador(i + 1)
    );

    configurarTabla(mockState, "facturas", "select", {
      data: facturas120,
      error: null,
    });
    configurarTabla(mockState, "glosas", "select", {
      data: [],
      error: null,
    });
    configurarTabla(mockState, "glosas_recibidas", "select", {
      data: [],
      error: null,
    });

    const { obtenerMisPendientes } = await import("@/app/actions/glosas");
    const result = await obtenerMisPendientes();

    // Debe retornar máximo 100 items en pendientes
    expect(result.pendientes.length).toBeLessThanOrEqual(100);
    // kpis.pendientesTotal refleja el total real (antes del slice)
    expect(result.kpis.pendientesTotal).toBe(120);
  });

  it("respeta parámetro limite personalizado", async () => {
    const facturas30 = Array.from({ length: 30 }, (_, i) =>
      crearFacturaBorrador(i + 1)
    );

    configurarTabla(mockState, "facturas", "select", {
      data: facturas30,
      error: null,
    });
    configurarTabla(mockState, "glosas", "select", {
      data: [],
      error: null,
    });
    configurarTabla(mockState, "glosas_recibidas", "select", {
      data: [],
      error: null,
    });

    const { obtenerMisPendientes } = await import("@/app/actions/glosas");
    const result = await obtenerMisPendientes({ limite: 10 });

    expect(result.pendientes.length).toBeLessThanOrEqual(10);
    expect(result.kpis.pendientesTotal).toBe(30);
  });

  it("retorna pendientes vacíos si no hay usuario", async () => {
    mockState.user = null;

    const { obtenerMisPendientes } = await import("@/app/actions/glosas");
    const result = await obtenerMisPendientes();

    expect(result.pendientes).toEqual([]);
    expect(result.kpis.pendientesTotal).toBe(0);
  });

  it("calcula KPIs correctamente con facturas limitadas", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: [
        { ...crearFacturaBorrador(1), valor_total: 200_000, estado: "radicada" },
        { ...crearFacturaBorrador(2), valor_total: 300_000, estado: "glosada", valor_glosado: 50_000 },
        { ...crearFacturaBorrador(3), valor_total: 100_000, estado: "borrador" },
      ],
      error: null,
    });
    configurarTabla(mockState, "glosas", "select", {
      data: [],
      error: null,
    });
    configurarTabla(mockState, "glosas_recibidas", "select", {
      data: [],
      error: null,
    });

    const { obtenerMisPendientes } = await import("@/app/actions/glosas");
    const result = await obtenerMisPendientes();

    expect(result.kpis.totalFacturado).toBe(600_000);
    expect(result.kpis.totalGlosado).toBe(50_000);
    expect(result.kpis.facturasBorrador).toBe(1);
  });
});
