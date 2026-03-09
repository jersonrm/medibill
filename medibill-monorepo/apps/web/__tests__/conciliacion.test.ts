/**
 * Tests para conciliacion-service.ts — funciones internas de matching y clasificación
 *
 * Verifica el algoritmo de búsqueda de facturas por número (3 niveles),
 * la clasificación de conciliación, normalización, y resumen.
 */

import { describe, it, expect } from "vitest";
import {
  normalizarNumFactura,
  buscarFactura,
  clasificarConciliacion,
  calcularResumen,
  construirIndiceFacturas,
  generarResultadoSinFacturas,
  type FacturaIndexada,
} from "@/lib/conciliacion-service";
import { crearFilaNormalizada } from "./helpers/fixtures";
import type { ItemConciliacion, FilaNormalizada } from "@/lib/types/sabana";

// =====================================================================
// HELPERS
// =====================================================================

function crearFacturaIndexada(overrides?: Partial<FacturaIndexada>): FacturaIndexada {
  return {
    id: "factura-uuid-1",
    num_factura: "FV-006",
    num_factura_normalizado: "fv-006",
    valor_total: 100000,
    estado: "radicada",
    saldo_pendiente: 100000,
    eps_nombre: "EPS SURA",
    paciente_nombre: "Juan Pérez",
    ...overrides,
  };
}

// =====================================================================
// TESTS
// =====================================================================

describe("normalizarNumFactura", () => {
  it("convierte a lowercase y trim", () => {
    expect(normalizarNumFactura("  FV-006  ")).toBe("fv-006");
  });

  it("colapsa espacios múltiples", () => {
    expect(normalizarNumFactura("FV  006")).toBe("fv006");
  });

  it("colapsa guiones múltiples", () => {
    expect(normalizarNumFactura("FV--006")).toBe("fv-006");
  });

  it("maneja strings vacíos", () => {
    expect(normalizarNumFactura("")).toBe("");
  });
});

describe("buscarFactura", () => {
  const indice: FacturaIndexada[] = [
    crearFacturaIndexada({ id: "1", num_factura: "FV-001", num_factura_normalizado: "fv-001" }),
    crearFacturaIndexada({ id: "2", num_factura: "FV-002", num_factura_normalizado: "fv-002" }),
    crearFacturaIndexada({ id: "3", num_factura: "PREF-001234", num_factura_normalizado: "pref-001234" }),
  ];

  it("encuentra por match exacto normalizado", () => {
    const result = buscarFactura("FV-001", indice);
    expect(result?.id).toBe("1");
  });

  it("encuentra por match exacto con espacios/mayúsculas", () => {
    const result = buscarFactura("  FV-002  ", indice);
    expect(result?.id).toBe("2");
  });

  it("encuentra por match numérico (FV-001234 vs PREF-001234)", () => {
    const result = buscarFactura("FV-001234", indice);
    expect(result?.id).toBe("3");
  });

  it("encuentra por match numérico (solo número 001234)", () => {
    const result = buscarFactura("001234", indice);
    expect(result?.id).toBe("3");
  });

  it("encuentra por sufijo (número parcial)", () => {
    const result = buscarFactura("1234", indice);
    // Should match PREF-001234 via suffix
    expect(result?.id).toBe("3");
  });

  it("retorna null cuando no hay match", () => {
    const result = buscarFactura("XYZ-999", indice);
    expect(result).toBeNull();
  });

  it("retorna null para string vacío", () => {
    const result = buscarFactura("", indice);
    expect(result).toBeNull();
  });

  it("no hace match numérico con menos de 3 dígitos", () => {
    const result = buscarFactura("12", indice);
    // "12" has only 2 digits, should skip numeric and suffix matching
    expect(result).toBeNull();
  });
});

describe("clasificarConciliacion", () => {
  it("clasifica como ya_pagada cuando estado es pagada", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 100000 });
    const factura = crearFacturaIndexada({ estado: "pagada", saldo_pendiente: 0 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("ya_pagada");
    expect(result.seleccionado).toBe(false);
  });

  it("clasifica como ya_pagada cuando saldo_pendiente <= 0", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 50000 });
    const factura = crearFacturaIndexada({ estado: "radicada", saldo_pendiente: 0 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("ya_pagada");
    expect(result.seleccionado).toBe(false);
  });

  it("clasifica como excede_saldo cuando pago > saldo pendiente", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 150000 });
    const factura = crearFacturaIndexada({ saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("excede_saldo");
    expect(result.seleccionado).toBe(false);
  });

  it("clasifica como con_glosa cuando hay valor_glosado > 0", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 80000, valor_glosado: 20000 });
    const factura = crearFacturaIndexada({ saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("con_glosa");
    expect(result.seleccionado).toBe(true);
  });

  it("clasifica como pago_total cuando pago >= 99% del total (tolerancia redondeo)", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 99500 });
    const factura = crearFacturaIndexada({ valor_total: 100000, saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("pago_total");
    expect(result.seleccionado).toBe(true);
  });

  it("clasifica como pago_total cuando pago == total exacto", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 100000 });
    const factura = crearFacturaIndexada({ valor_total: 100000, saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("pago_total");
    expect(result.seleccionado).toBe(true);
  });

  it("clasifica como pago_parcial cuando pago < 99% del total", () => {
    const fila = crearFilaNormalizada({ valor_pagado: 50000 });
    const factura = crearFacturaIndexada({ valor_total: 100000, saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("pago_parcial");
    expect(result.seleccionado).toBe(true);
  });

  it("prioriza ya_pagada sobre excede_saldo", () => {
    // Factura pagada with saldo 0, and the payment would also exceed
    const fila = crearFilaNormalizada({ valor_pagado: 200000 });
    const factura = crearFacturaIndexada({ estado: "pagada", saldo_pendiente: 0, valor_total: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("ya_pagada");
  });

  it("prioriza con_glosa sobre pago_total cuando hay glosa", () => {
    // Even if the payment covers 99%+ of the total, if there's a glosa it should be con_glosa
    const fila = crearFilaNormalizada({ valor_pagado: 100000, valor_glosado: 5000 });
    const factura = crearFacturaIndexada({ valor_total: 100000, saldo_pendiente: 100000 });
    const result = clasificarConciliacion(fila, factura);

    expect(result.tipo).toBe("con_glosa");
  });
});

describe("construirIndiceFacturas", () => {
  it("construye índice con saldo_pendiente correcto", () => {
    const facturas = [{
      id: "f1", num_factura: "FV-001", valor_total: 100000,
      estado: "radicada", nit_erp: "800123", metadata: null, paciente_id: null,
    }];
    const pagos = { f1: 30000 };
    const indice = construirIndiceFacturas(facturas, pagos, {});

    expect(indice).toHaveLength(1);
    expect(indice[0]!.saldo_pendiente).toBe(70000);
    expect(indice[0]!.num_factura_normalizado).toBe("fv-001");
  });

  it("saldo_pendiente nunca es negativo", () => {
    const facturas = [{
      id: "f1", num_factura: "FV-001", valor_total: 100000,
      estado: "pagada", nit_erp: "800123", metadata: null, paciente_id: null,
    }];
    const pagos = { f1: 150000 }; // Overpayment
    const indice = construirIndiceFacturas(facturas, pagos, {});

    expect(indice[0]!.saldo_pendiente).toBe(0);
  });

  it("resuelve nombres de pacientes", () => {
    const facturas = [{
      id: "f1", num_factura: "FV-001", valor_total: 100000,
      estado: "radicada", nit_erp: "800123", metadata: null, paciente_id: "p1",
    }];
    const nombres = { p1: "Juan Pérez" };
    const indice = construirIndiceFacturas(facturas, {}, nombres);

    expect(indice[0]!.paciente_nombre).toBe("Juan Pérez");
  });

  it("usa eps_nombre de metadata cuando disponible", () => {
    const facturas = [{
      id: "f1", num_factura: "FV-001", valor_total: 100000,
      estado: "radicada", nit_erp: "800123",
      metadata: { eps_nombre: "EPS SURA" }, paciente_id: null,
    }];
    const indice = construirIndiceFacturas(facturas, {}, {});

    expect(indice[0]!.eps_nombre).toBe("EPS SURA");
  });
});

describe("calcularResumen", () => {
  it("calcula resumen correcto de items mixtos", () => {
    const fila = crearFilaNormalizada;
    const items: ItemConciliacion[] = [
      { fila: fila({ valor_pagado: 100000, valor_glosado: null }), factura: null, tipo: "sin_match_factura", seleccionado: false },
      { fila: fila({ valor_pagado: 50000, valor_glosado: 10000 }), factura: { id: "1", num_factura: "F1", valor_total: 100000, estado: "radicada", saldo_pendiente: 100000, eps_nombre: "X", paciente_nombre: "Y" }, tipo: "con_glosa", seleccionado: true },
      { fila: fila({ valor_pagado: 80000, valor_glosado: null }), factura: { id: "2", num_factura: "F2", valor_total: 80000, estado: "radicada", saldo_pendiente: 80000, eps_nombre: "X", paciente_nombre: "Z" }, tipo: "pago_total", seleccionado: true },
      { fila: fila({ valor_pagado: 20000, valor_glosado: null }), factura: { id: "3", num_factura: "F3", valor_total: 100000, estado: "pagada", saldo_pendiente: 0, eps_nombre: "X", paciente_nombre: "W" }, tipo: "ya_pagada", seleccionado: false },
    ];

    const resumen = calcularResumen(items);

    expect(resumen.total_filas).toBe(4);
    expect(resumen.sin_match).toBe(1);
    expect(resumen.ya_pagadas).toBe(1);
    expect(resumen.conciliadas).toBe(2);
    // monto_a_registrar only counts seleccionado items in conciliadas
    expect(resumen.monto_a_registrar).toBe(50000 + 80000);
    expect(resumen.monto_glosado).toBe(10000);
  });

  it("retorna ceros para lista vacía", () => {
    const resumen = calcularResumen([]);

    expect(resumen.total_filas).toBe(0);
    expect(resumen.conciliadas).toBe(0);
    expect(resumen.sin_match).toBe(0);
    expect(resumen.ya_pagadas).toBe(0);
    expect(resumen.monto_a_registrar).toBe(0);
    expect(resumen.monto_glosado).toBe(0);
  });
});

describe("generarResultadoSinFacturas", () => {
  it("marca todas las filas como sin_match_factura", () => {
    const filas: FilaNormalizada[] = [
      crearFilaNormalizada({ num_factura: "FV-001" }),
      crearFilaNormalizada({ num_factura: "FV-002" }),
    ];
    const result = generarResultadoSinFacturas(filas);

    expect(result.items).toHaveLength(2);
    expect(result.items.every(i => i.tipo === "sin_match_factura")).toBe(true);
    expect(result.items.every(i => !i.seleccionado)).toBe(true);
    expect(result.resumen.sin_match).toBe(2);
    expect(result.resumen.conciliadas).toBe(0);
  });
});
