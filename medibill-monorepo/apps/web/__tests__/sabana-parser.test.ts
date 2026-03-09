/**
 * Tests para parsearArchivoSabana — lib/sabana-parser.ts
 *
 * Verifica parsing de archivos Excel/CSV de sábana EPS,
 * normalización de números colombianos, filtrado de filas,
 * y manejo de edge cases.
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsearArchivoSabana } from "@/lib/sabana-parser";

// =====================================================================
// HELPERS: crear buffers de prueba
// =====================================================================

/** Crea un ArrayBuffer XLSX a partir de un array de objetos */
function crearExcelBuffer(data: Record<string, unknown>[], sheetName = "Hoja1"): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}

/** Crea un ArrayBuffer XLSX con múltiples hojas */
function crearExcelMultiHoja(sheets: { name: string; data: Record<string, unknown>[] }[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Crea un ArrayBuffer CSV a partir de texto */
function crearCsvBuffer(csvText: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(csvText).buffer.slice(0) as ArrayBuffer;
}

// =====================================================================
// TESTS
// =====================================================================

describe("parsearArchivoSabana", () => {
  describe("Parsing básico", () => {
    it("parsea un XLSX con datos válidos y retorna headers + filas", () => {
      const data = [
        { "Nro Factura": "FV-001", "Valor": 100000, "Paciente": "Juan" },
        { "Nro Factura": "FV-002", "Valor": 200000, "Paciente": "María" },
      ];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "sabana.xlsx");

      expect(result.headers).toContain("Nro Factura");
      expect(result.headers).toContain("Valor");
      expect(result.headers).toContain("Paciente");
      expect(result.filas).toHaveLength(2);
      expect(result.hoja).toBe("Hoja1");
      expect(result.total_filas_original).toBe(2);
    });

    it("parsea un archivo con extensión .xls", () => {
      const data = [{ "Factura": "FV-001", "Monto": 50000 }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "pagos.xls");

      expect(result.headers).toContain("Factura");
      expect(result.filas).toHaveLength(1);
    });

    it("rechaza extensiones no soportadas", () => {
      const buf = new ArrayBuffer(10);
      expect(() => parsearArchivoSabana(buf, "archivo.pdf")).toThrow("Formato no soportado");
      expect(() => parsearArchivoSabana(buf, "archivo.doc")).toThrow("Formato no soportado");
      expect(() => parsearArchivoSabana(buf, "archivo.txt")).toThrow("Formato no soportado");
    });
  });

  describe("Normalización de números colombianos", () => {
    it("convierte formato colombiano $1.234.567,89 a número", () => {
      const data = [{ "Valor": "$1.234.567,89", "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(1234567.89);
    });

    it("convierte formato colombiano sin pesos 1.234.567 a número", () => {
      const data = [{ "Valor": "1.234.567", "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(1234567);
    });

    it("convierte negativos entre paréntesis (1.234) a número negativo", () => {
      const data = [{ "Valor": "(1.234)", "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(-1234);
    });

    it("convierte decimal colombiano 1234,56 a número", () => {
      const data = [{ "Valor": "1234,56", "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(1234.56);
    });

    it("mantiene formato US 1,234.56 como número", () => {
      const data = [{ "Valor": "1,234.56", "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(1234.56);
    });

    it("preserva números que ya son numéricos en el Excel", () => {
      const data = [{ "Valor": 99000, "Factura": "FV-001" }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Valor"]).toBe(99000);
    });
  });

  describe("Valores null-ish", () => {
    it('colapsa "", "-", "N/A" a null', () => {
      const data = [
        { "Factura": "FV-001", "Obs1": "", "Obs2": "-", "Obs3": "N/A", "Valor": 1000 },
      ];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Obs1"]).toBeNull();
      expect(result.filas[0]!["Obs2"]).toBeNull();
      expect(result.filas[0]!["Obs3"]).toBeNull();
    });

    it("preserva strings no vacíos como texto", () => {
      const data = [{ "Factura": "FV-001", "Obs": "Sin novedad", "Valor": 1000 }];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas[0]!["Obs"]).toBe("Sin novedad");
    });
  });

  describe("Filtrado de filas", () => {
    it("filtra filas completamente vacías", () => {
      const data = [
        { "Factura": "FV-001", "Valor": 50000 },
        { "Factura": null, "Valor": null },
        { "Factura": "FV-002", "Valor": 60000 },
      ];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.filas).toHaveLength(2);
    });

    it("filtra filas de subtotal (contienen 'total' con pocos valores)", () => {
      const data = [
        { "Factura": "FV-001", "Valor": 50000, "Paciente": "Juan" },
        { "Factura": "TOTAL", "Valor": 50000, "Paciente": null },
        { "Factura": "FV-002", "Valor": 60000, "Paciente": "María" },
      ];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      // The subtotal row should be filtered if it has ≤3 non-null values and contains "total"
      expect(result.filas.length).toBeLessThanOrEqual(3);
      // Should NOT contain a row where Factura is "TOTAL"
      const totalRows = result.filas.filter(f => f["Factura"] === "TOTAL");
      expect(totalRows).toHaveLength(0);
    });
  });

  describe("Selección de hoja", () => {
    it("elige la hoja con más filas en workbooks multi-hoja", () => {
      const buf = crearExcelMultiHoja([
        { name: "Resumen", data: [{ "A": 1 }] },
        { name: "Detalle", data: [{ "F": "FV-001", "V": 1 }, { "F": "FV-002", "V": 2 }, { "F": "FV-003", "V": 3 }] },
        { name: "Config", data: [{ "X": "Y" }, { "X": "Z" }] },
      ]);
      const result = parsearArchivoSabana(buf, "multi.xlsx");

      expect(result.hoja).toBe("Detalle");
      expect(result.filas).toHaveLength(3);
    });
  });

  describe("Límites y errores", () => {
    it("limita a MAX_FILAS (500) filas", () => {
      const data = Array.from({ length: 600 }, (_, i) => ({
        "Factura": `FV-${String(i + 1).padStart(4, "0")}`,
        "Valor": (i + 1) * 1000,
      }));
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "grande.xlsx");

      // After slicing to 500, some might be filtered (empty/subtotal), but never > 500
      expect(result.filas.length).toBeLessThanOrEqual(500);
      expect(result.total_filas_original).toBe(600);
    });

    it("retorna total_filas_original con el conteo real", () => {
      const data = [
        { "F": "FV-001", "V": 100 },
        { "F": "FV-002", "V": 200 },
        { "F": "FV-003", "V": 300 },
      ];
      const buf = crearExcelBuffer(data);
      const result = parsearArchivoSabana(buf, "test.xlsx");

      expect(result.total_filas_original).toBe(3);
    });
  });
});
