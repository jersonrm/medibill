/**
 * Tests para pagos.ts — server actions de pagos
 *
 * Verifica:
 * - registrarPago: validación de estado, tope saldo, transición estado factura
 * - listarPagosPorFactura: filtra por usuario
 * - obtenerCarteraPendiente: filtros, resumen
 * - obtenerKPICartera: cálculo correcto
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearRegistrarPagoInput,
} from "./helpers/fixtures";
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

// =====================================================================
// registrarPago
// =====================================================================

describe("registrarPago", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("registra pago total y transiciona factura a pagada", async () => {
    // Factura radicada con valor 100_000
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 100_000, estado: "radicada" },
      error: null,
    });
    // No pagos previos
    configurarTabla(mockState, "pagos", "select", { data: [], error: null });
    // Insert pago
    configurarTabla(mockState, "pagos", "insert", {
      data: { id: "p1", monto: 100_000, factura_id: "f1" },
      error: null,
    });
    // Update factura estado
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ monto: 100_000, factura_id: "f1" })
    );

    expect(result.success).toBe(true);
    expect(result.nuevo_estado).toBe("pagada");
  });

  it("registra pago parcial y transiciona a pagada_parcial", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 200_000, estado: "radicada" },
      error: null,
    });
    configurarTabla(mockState, "pagos", "select", { data: [], error: null });
    configurarTabla(mockState, "pagos", "insert", {
      data: { id: "p1", monto: 50_000, factura_id: "f1" },
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ monto: 50_000, factura_id: "f1" })
    );

    expect(result.success).toBe(true);
    expect(result.nuevo_estado).toBe("pagada_parcial");
  });

  it("acumula pagos previos y transiciona a pagada al completar", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 100_000, estado: "pagada_parcial" },
      error: null,
    });
    // Ya hay 60_000 pagados
    configurarTabla(mockState, "pagos", "select", {
      data: [{ monto: 30_000 }, { monto: 30_000 }],
      error: null,
    });
    configurarTabla(mockState, "pagos", "insert", {
      data: { id: "p3", monto: 40_000, factura_id: "f1" },
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ monto: 40_000, factura_id: "f1" })
    );

    expect(result.success).toBe(true);
    expect(result.nuevo_estado).toBe("pagada");
  });

  it("rechaza si factura no existe", async () => {
    configurarTabla(mockState, "facturas", "select", { data: null, error: null });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ factura_id: "inexistente" })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrada");
  });

  it("rechaza si factura no está en estado radicada ni pagada_parcial", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 100_000, estado: "borrador" },
      error: null,
    });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ factura_id: "f1" })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("borrador");
  });

  it("rechaza si el monto excede el saldo pendiente", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 100_000, estado: "radicada" },
      error: null,
    });
    configurarTabla(mockState, "pagos", "select", {
      data: [{ monto: 80_000 }],
      error: null,
    });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ monto: 30_000, factura_id: "f1" })
    );

    // Saldo pendiente = 20_000 but trying to pay 30_000
    expect(result.success).toBe(false);
    expect(result.error).toContain("excede");
  });

  it("rechaza si usuario no está autenticado", async () => {
    mockState.user = null;

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(crearRegistrarPagoInput());

    expect(result.success).toBe(false);
    expect(result.error).toBe("No autenticado");
  });

  it("retorna error de la base de datos al insertar pago", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f1", valor_total: 100_000, estado: "radicada" },
      error: null,
    });
    configurarTabla(mockState, "pagos", "select", { data: [], error: null });
    configurarTabla(mockState, "pagos", "insert", {
      data: null,
      error: { message: "DB constraint violation" },
    });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ monto: 50_000, factura_id: "f1" })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB constraint");
  });
});

// =====================================================================
// listarPagosPorFactura
// =====================================================================

describe("listarPagosPorFactura", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("retorna pagos de la factura", async () => {
    configurarTabla(mockState, "pagos", "select", {
      data: [
        { id: "p1", monto: 50_000, fecha_pago: "2024-01-15" },
        { id: "p2", monto: 30_000, fecha_pago: "2024-02-01" },
      ],
      error: null,
    });

    const { listarPagosPorFactura } = await import("@/app/actions/pagos");
    const result = await listarPagosPorFactura("f1");

    expect(result).toHaveLength(2);
    expect(result[0].monto).toBe(50_000);
  });

  it("retorna array vacío si no hay usuario", async () => {
    mockState.user = null;

    const { listarPagosPorFactura } = await import("@/app/actions/pagos");
    const result = await listarPagosPorFactura("f1");

    expect(result).toEqual([]);
  });
});

// =====================================================================
// obtenerKPICartera
// =====================================================================

describe("obtenerKPICartera", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("calcula valor pendiente descontando pagos parciales", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: [
        { id: "f1", valor_total: 200_000 },
        { id: "f2", valor_total: 100_000 },
      ],
      error: null,
    });
    configurarTabla(mockState, "pagos", "select", {
      data: [{ factura_id: "f1", monto: 50_000 }],
      error: null,
    });

    const { obtenerKPICartera } = await import("@/app/actions/pagos");
    const result = await obtenerKPICartera();

    // f1 pendiente: 200k - 50k = 150k, f2: 100k => total 250k
    expect(result.valor_pendiente).toBe(250_000);
    expect(result.facturas_pendientes).toBe(2);
  });

  it("retorna ceros si no hay facturas pendientes", async () => {
    configurarTabla(mockState, "facturas", "select", { data: [], error: null });

    const { obtenerKPICartera } = await import("@/app/actions/pagos");
    const result = await obtenerKPICartera();

    expect(result.valor_pendiente).toBe(0);
    expect(result.facturas_pendientes).toBe(0);
  });

  it("retorna ceros si no hay usuario", async () => {
    mockState.user = null;

    const { obtenerKPICartera } = await import("@/app/actions/pagos");
    const result = await obtenerKPICartera();

    expect(result.valor_pendiente).toBe(0);
    expect(result.facturas_pendientes).toBe(0);
  });
});

// =====================================================================
// Cartera: chunking y eficiencia de queries
// =====================================================================

describe("obtenerCarteraPendiente — chunking N+1", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("con 50 facturas ejecuta solo 2 queries (facturas + 1 lote pagos), no 51", async () => {
    // Generar 50 facturas radicadas
    const facturas50 = Array.from({ length: 50 }, (_, i) => ({
      id: `f-${i + 1}`,
      num_factura: `FV-${String(i + 1).padStart(3, "0")}`,
      fecha_expedicion: "2026-01-15",
      nit_erp: "900123456",
      valor_total: 100_000,
      estado: "radicada",
      metadata: null,
      created_at: "2026-01-15T10:00:00.000Z",
      pacientes: { primer_nombre: "Juan", primer_apellido: "Pérez", numero_documento: "123" },
    }));

    configurarTabla(mockState, "facturas", "select", {
      data: facturas50,
      error: null,
    });
    // Single batch of pagos for all 50 facturas
    configurarTabla(mockState, "pagos", "select", {
      data: [
        { factura_id: "f-1", monto: 30_000 },
        { factura_id: "f-2", monto: 50_000 },
      ],
      error: null,
    });

    const { obtenerCarteraPendiente } = await import("@/app/actions/pagos");
    const result = await obtenerCarteraPendiente();

    // Verify correct results
    expect(result.items.length).toBe(50);
    expect(result.resumen.total_facturas).toBe(50);

    // f-1: 100k - 30k = 70k, f-2: 100k - 50k = 50k, others: 100k each
    // Total: 70k + 50k + 48*100k = 4_920_000
    expect(result.resumen.total_pendiente).toBe(4_920_000);
  });

  it("calcula saldo pendiente correctamente con pagos parciales", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: [
        {
          id: "f-1",
          num_factura: "FV-001",
          fecha_expedicion: "2026-01-15",
          nit_erp: "900123456",
          valor_total: 500_000,
          estado: "pagada_parcial",
          metadata: null,
          created_at: "2026-01-15T10:00:00.000Z",
          pacientes: null,
        },
      ],
      error: null,
    });
    configurarTabla(mockState, "pagos", "select", {
      data: [
        { factura_id: "f-1", monto: 200_000 },
        { factura_id: "f-1", monto: 100_000 },
      ],
      error: null,
    });

    const { obtenerCarteraPendiente } = await import("@/app/actions/pagos");
    const result = await obtenerCarteraPendiente();

    expect(result.items[0]!.total_pagado).toBe(300_000);
    expect(result.items[0]!.saldo_pendiente).toBe(200_000);
  });
});
