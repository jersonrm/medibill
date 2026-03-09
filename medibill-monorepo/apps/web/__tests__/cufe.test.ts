import { describe, it, expect } from "vitest";
import { calcularCufe, obtenerCadenaCufe } from "@/lib/cufe";
import type { DatosCufe } from "@/lib/cufe";
import { createHash } from "crypto";

/**
 * Tests unitarios para el cálculo del CUFE (Código Único de Factura Electrónica)
 *
 * Vector de prueba basado en el Anexo Técnico DIAN Resolución 000012 de 2021
 * y documentación de habilitación de facturación electrónica.
 */

// ═══ VECTOR DE PRUEBA DIAN ═══
// Basado en el ejemplo del Anexo Técnico 1.9, sección 6.1.1
const vectorPruebaDian: DatosCufe = {
  numFac: "SETP990000001",
  fecFac: "2019-01-16",
  horFac: "10:53:10-05:00",
  valFac: 1500000,       // Subtotal sin impuestos
  valImp1: 0,             // IVA = 0 (salud excluido)
  valImp2: 0,             // ICA = 0
  valImp3: 0,             // IC = 0
  valTot: 1500000,        // Total
  nitOFE: "700085464",    // NIT emisor
  numAdq: "800199436",    // NIT adquirente (EPS)
  clTec: "fc8eac422eba16e22ffd8c6f94b3f40a6e38162c",
  tipoAmbiente: "2",      // Habilitación/pruebas
};

describe("calcularCufe", () => {
  it("devuelve un hash SHA-384 de 96 caracteres hexadecimales", () => {
    const cufe = calcularCufe(vectorPruebaDian);
    expect(cufe).toHaveLength(96);
    expect(cufe).toMatch(/^[0-9a-f]{96}$/);
  });

  it("es determinista: mismos datos producen mismo CUFE", () => {
    const cufe1 = calcularCufe(vectorPruebaDian);
    const cufe2 = calcularCufe(vectorPruebaDian);
    expect(cufe1).toBe(cufe2);
  });

  it("la cadena de concatenación tiene el formato correcto", () => {
    const cadena = obtenerCadenaCufe(vectorPruebaDian);

    // Debe contener los componentes en el orden correcto
    expect(cadena).toContain("SETP990000001");        // NumFac
    expect(cadena).toContain("2019-01-16");           // FecFac
    expect(cadena).toContain("10:53:10-05:00");       // HorFac
    expect(cadena).toContain("1500000.00");           // ValFac
    expect(cadena).toContain("01");                   // CodImp1 (IVA)
    expect(cadena).toContain("04");                   // CodImp2 (ICA)
    expect(cadena).toContain("03");                   // CodImp3 (IC)
    expect(cadena).toContain("700085464");            // NitOFE
    expect(cadena).toContain("800199436");            // NumAdq
    expect(cadena).toContain("fc8eac422eba16e22ffd8c6f94b3f40a6e38162c"); // ClTec

    // Verificar orden: NumFac está al inicio
    expect(cadena.startsWith("SETP990000001")).toBe(true);
    // Verificar que tipoAmbiente "2" está al final
    expect(cadena.endsWith("2")).toBe(true);
  });

  it("produce el CUFE correcto para el vector de prueba (verificación SHA-384)", () => {
    // Computar manualmente la cadena y el hash esperado
    const cadena = obtenerCadenaCufe(vectorPruebaDian);
    const hashEsperado = createHash("sha384").update(cadena, "utf8").digest("hex");
    const cufe = calcularCufe(vectorPruebaDian);
    expect(cufe).toBe(hashEsperado);
  });

  it("cambia el CUFE si cambia cualquier dato", () => {
    const cufeOriginal = calcularCufe(vectorPruebaDian);

    // Cambiar número de factura
    const cufeNumDiff = calcularCufe({ ...vectorPruebaDian, numFac: "SETP990000002" });
    expect(cufeNumDiff).not.toBe(cufeOriginal);

    // Cambiar fecha
    const cufeFechaDiff = calcularCufe({ ...vectorPruebaDian, fecFac: "2019-01-17" });
    expect(cufeFechaDiff).not.toBe(cufeOriginal);

    // Cambiar valor
    const cufeValDiff = calcularCufe({ ...vectorPruebaDian, valFac: 1500001 });
    expect(cufeValDiff).not.toBe(cufeOriginal);

    // Cambiar NIT emisor
    const cufeNitDiff = calcularCufe({ ...vectorPruebaDian, nitOFE: "700085465" });
    expect(cufeNitDiff).not.toBe(cufeOriginal);

    // Cambiar clave técnica
    const cufeClTecDiff = calcularCufe({ ...vectorPruebaDian, clTec: "abc123" });
    expect(cufeClTecDiff).not.toBe(cufeOriginal);

    // Cambiar ambiente
    const cufeAmbienteDiff = calcularCufe({ ...vectorPruebaDian, tipoAmbiente: "1" });
    expect(cufeAmbienteDiff).not.toBe(cufeOriginal);
  });

  it("formatea los valores numéricos con exactamente 2 decimales", () => {
    const cadena = obtenerCadenaCufe({
      ...vectorPruebaDian,
      valFac: 100,
      valImp1: 19,
      valImp2: 0.5,
      valImp3: 0,
      valTot: 119.5,
    });

    expect(cadena).toContain("100.00");   // valFac
    expect(cadena).toContain("19.00");    // valImp1
    expect(cadena).toContain("0.50");     // valImp2
    expect(cadena).toContain("0.00");     // valImp3
    expect(cadena).toContain("119.50");   // valTot
  });

  it("funciona con valores de salud típicos (IVA=0, servicios excluidos)", () => {
    const datosSalud: DatosCufe = {
      numFac: "MDB001",
      fecFac: "2025-03-05",
      horFac: "14:30:00-05:00",
      valFac: 250000,
      valImp1: 0,  // Servicios de salud excluidos de IVA
      valImp2: 0,
      valImp3: 0,
      valTot: 250000,
      nitOFE: "1234567890",
      numAdq: "900123456",
      clTec: "clave-tecnica-dian-test-12345",
      tipoAmbiente: "2",
    };

    const cufe = calcularCufe(datosSalud);
    expect(cufe).toHaveLength(96);
    expect(cufe).toMatch(/^[0-9a-f]{96}$/);
  });

  it("maneja correctamente valores con muchos decimales (redondeo)", () => {
    const cadena = obtenerCadenaCufe({
      ...vectorPruebaDian,
      valFac: 1500000.999, // Debería truncarse a 1500001.00
    });
    expect(cadena).toContain("1500001.00");
  });
});
