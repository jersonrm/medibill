/**
 * Tests para generar-fev-xml.ts — Generador XML UBL 2.1 FEV DIAN
 *
 * Cubre:
 *   - Estructura XML válida con namespaces DIAN
 *   - CUFE calculado correctamente (SHA-384)
 *   - Extensión de sector salud
 *   - Líneas de factura (consulta + procedimientos)
 *   - IVA siempre 0 para servicios de salud
 *   - Campos obligatorios presentes
 *   - SoftwareSecurityCode SHA-384
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearFacturaCompleta,
  crearAtencionUI,
  crearProcedimientoFactura,
  crearDiagnosticoUI,
} from "./helpers/fixtures";

// =====================================================================
// MOCKS
// =====================================================================

vi.mock("@/lib/cufe", () => ({
  calcularCufe: vi.fn().mockReturnValue("mock-cufe-sha384-hex-string-96chars"),
}));

// =====================================================================
// FIXTURES — FEV-specific inputs
// =====================================================================

function crearPerfilFevInput(overrides?: Record<string, unknown>) {
  return {
    tipo_documento: "CC",
    numero_documento: "123456789",
    digito_verificacion: "0",
    razon_social: "Dr. Test Medibill",
    nombre_comercial: "Consultorio Dr. Test",
    codigo_habilitacion: "HAB001",
    tipo_prestador: "profesional_independiente",
    direccion: "Cra 10 #20-30",
    municipio_codigo: "11001",
    municipio_nombre: "Bogotá",
    departamento_codigo: "11",
    departamento_nombre: "Bogotá, D.C.",
    telefono: "3001234567",
    email_facturacion: "test@medibill.co",
    responsable_iva: false,
    regimen_fiscal: "no_responsable",
    ...overrides,
  };
}

function crearResolucionFevInput(overrides?: Record<string, unknown>) {
  return {
    numero_resolucion: "18764000001234",
    fecha_resolucion: "2025-01-15",
    prefijo: "FV-",
    rango_desde: 1,
    rango_hasta: 1000,
    fecha_vigencia_desde: "2025-01-01",
    fecha_vigencia_hasta: "2027-01-01",
    clave_tecnica: "abc123clave",
    ...overrides,
  };
}

function crearClienteFevInput(overrides?: Record<string, unknown>) {
  return {
    tipo_documento: "31",
    numero_documento: "800123456",
    razon_social: "EPS SURA",
    nombre_comercial: "EPS SURA",
    responsable_iva: true,
    direccion: "Calle 50 #40-20",
    municipio_codigo: "05001",
    municipio_nombre: "Medellín",
    departamento_codigo: "05",
    departamento_nombre: "Antioquia",
    telefono: "6041234567",
    email: "facturacion@epssura.co",
    ...overrides,
  };
}

function crearPacienteFevInput(overrides?: Record<string, unknown>) {
  return {
    tipo_documento: "CC",
    numero_documento: "1234567890",
    primer_nombre: "Juan",
    primer_apellido: "Pérez",
    tipo_usuario: "01",
    sexo: "M",
    fecha_nacimiento: "1990-05-15",
    ...overrides,
  };
}

// =====================================================================
// TESTS
// =====================================================================

describe("generarXmlFev", () => {
  let generarXmlFev: typeof import("@/lib/generar-fev-xml").generarXmlFev;

  beforeEach(async () => {
    vi.stubEnv("DIAN_SOFTWARE_ID", "test-software-id");
    vi.stubEnv("DIAN_SOFTWARE_PIN", "test-pin");

    const mod = await import("@/lib/generar-fev-xml");
    generarXmlFev = mod.generarXmlFev;
  });

  // ─── Estructura básica ───────────────────────────────────────────

  it("retorna xml, cufe, invoice y numFactura", () => {
    const factura = crearFacturaCompleta({ fecha_expedicion: "2026-03-06T10:00:00-05:00" });
    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result).toHaveProperty("xml");
    expect(result).toHaveProperty("cufe");
    expect(result).toHaveProperty("invoice");
    expect(result).toHaveProperty("numFactura");
    expect(result.numFactura).toBe("FV-001");
  });

  it("genera XML con declaración y encoding UTF-8", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"');
  });

  it("incluye namespaces UBL 2.1 y DIAN en el XML", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2");
    expect(result.xml).toContain("dian:gov:co:facturaelectronica:Structures-2-1");
    expect(result.xml).toContain("cbc:");
    expect(result.xml).toContain("cac:");
  });

  // ─── CUFE ────────────────────────────────────────────────────────

  it("calcula CUFE y lo incluye como UUID en el invoice", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.cufe).toBe("mock-cufe-sha384-hex-string-96chars");
    expect(result.invoice.UUID).toBe("mock-cufe-sha384-hex-string-96chars");
  });

  it("pasa datos correctos al cálculo de CUFE", async () => {
    const { calcularCufe } = await import("@/lib/cufe");

    generarXmlFev(
      crearFacturaCompleta({
        num_factura: "FV-TEST",
        fecha_expedicion: "2026-03-06",
        valor_total: 100000,
        subtotal: 100000,
      }),
      crearPerfilFevInput({ numero_documento: "NIT-EMISOR" }),
      crearResolucionFevInput({ clave_tecnica: "CLAVE-TEC" }),
      crearClienteFevInput({ numero_documento: "NIT-EPS" }),
      "2",
    );

    expect(calcularCufe).toHaveBeenCalledWith(
      expect.objectContaining({
        numFac: "FV-TEST",
        fecFac: "2026-03-06",
        nitOFE: "NIT-EMISOR",
        numAdq: "NIT-EPS",
        clTec: "CLAVE-TEC",
        tipoAmbiente: "2",
      }),
    );
  });

  // ─── Líneas de factura ──────────────────────────────────────────

  it("genera línea de consulta cuando valor_consulta > 0", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 50000, codConsultaCups: "890201" }),
      procedimientos: [],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.InvoiceLine.length).toBe(1);
    expect(result.invoice.InvoiceLine[0]!.Item.Description).toBe("Consulta médica");
    expect(result.invoice.InvoiceLine[0]!.Item.StandardItemIdentification.ID).toBe("890201");
    expect(result.invoice.InvoiceLine[0]!.LineExtensionAmount).toBe(50000);
  });

  it("NO genera línea de consulta cuando valor_consulta es 0", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 0 }),
      procedimientos: [crearProcedimientoFactura({ codigo_cups: "881602", valor_unitario: 45000 })],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    const descriptions = result.invoice.InvoiceLine.map(l => l.Item.Description);
    expect(descriptions).not.toContain("Consulta médica");
  });

  it("genera líneas de procedimientos con CUPS como ID", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 0 }),
      procedimientos: [
        crearProcedimientoFactura({ codigo_cups: "881602", descripcion: "Radiografía", valor_unitario: 45000, cantidad: 1 }),
        crearProcedimientoFactura({ codigo_cups: "903841", descripcion: "Hemograma", valor_unitario: 15000, cantidad: 2 }),
      ],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.InvoiceLine.length).toBe(2);
    expect(result.invoice.InvoiceLine[0]!.Item.StandardItemIdentification.ID).toBe("881602");
    expect(result.invoice.InvoiceLine[1]!.Item.StandardItemIdentification.ID).toBe("903841");
    expect(result.invoice.InvoiceLine[1]!.LineExtensionAmount).toBe(30000); // 15000 * 2
  });

  it("ordena: consulta primero, luego procedimientos", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 50000 }),
      procedimientos: [crearProcedimientoFactura({ codigo_cups: "881602", valor_unitario: 45000 })],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.InvoiceLine.length).toBe(2);
    expect(result.invoice.InvoiceLine[0]!.ID).toBe(1);
    expect(result.invoice.InvoiceLine[0]!.Item.Description).toBe("Consulta médica");
    expect(result.invoice.InvoiceLine[1]!.ID).toBe(2);
  });

  // ─── IVA = 0 (sector salud) ───────────────────────────────────

  it("reporta IVA = 0 en TaxTotal (sector salud excluido)", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.TaxTotal.length).toBeGreaterThan(0);
    const taxTotal = result.invoice.TaxTotal[0]!;
    expect(taxTotal.TaxAmount).toBe(0);
    expect(taxTotal.TaxSubtotal[0]!.TaxAmount).toBe(0);
    expect(taxTotal.TaxSubtotal[0]!.TaxCategory.TaxScheme.ID).toBe("ZZ");
  });

  it("IVA 0 también en cada línea de factura", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 50000 }),
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    for (const line of result.invoice.InvoiceLine) {
      expect(line.TaxTotal?.TaxAmount).toBe(0);
    }
  });

  // ─── Extensión Sector Salud ─────────────────────────────────────

  it("incluye extensión de sector salud con datos EPS", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput({ numero_documento: "800123456", razon_social: "EPS SURA" }),
      "2",
      crearPacienteFevInput({ tipo_usuario: "01" }),
    );

    const hs = result.invoice.HealthSector!;
    expect(hs.AdministradoraCode).toBe("800123456");
    expect(hs.AdministradoraName).toBe("EPS SURA");
    expect(hs.TipoUsuario).toBe("01");
    expect(hs.ModalidadAtencion).toBe("01");
    expect(hs.CoberturaPlaBenef).toBe("01");
  });

  it("incluye extensión salud en el XML serializado", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.xml).toContain("sts:HealthSector");
    expect(result.xml).toContain("sts:AdministradoraCode");
    expect(result.xml).toContain("sts:TipoUsuario");
  });

  // ─── Montos y Totales ──────────────────────────────────────────

  it("calcula LegalMonetaryTotal correctamente", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      valor_total: 95000,
      subtotal: 95000,
      descuentos: 5000,
      copago: 0,
      atencion: crearAtencionUI({ valor_consulta: 50000 }),
      procedimientos: [crearProcedimientoFactura({ valor_unitario: 45000, cantidad: 1 })],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.LegalMonetaryTotal.PayableAmount).toBe(95000);
    expect(result.invoice.LegalMonetaryTotal.AllowanceTotalAmount).toBe(5000);
  });

  // ─── Supplier (prestador) ──────────────────────────────────────

  it("construye supplier con datos del perfil", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput({
        tipo_documento: "CC",
        numero_documento: "999888777",
        razon_social: "Dr. Especialista",
      }),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    const supplier = result.invoice.AccountingSupplierParty;
    expect(supplier.Party.PartyIdentification.ID).toBe("999888777");
    expect(supplier.Party.PartyTaxScheme.RegistrationName).toBe("Dr. Especialista");
  });

  it("persona natural es AdditionalAccountID = 2", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput({ tipo_documento: "CC", tipo_prestador: "profesional_independiente" }),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.AccountingSupplierParty.AdditionalAccountID).toBe("2");
  });

  it("Clínica (NIT) es AdditionalAccountID = 1 (persona jurídica)", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput({ tipo_documento: "NI", tipo_prestador: "clinica" }),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.AccountingSupplierParty.AdditionalAccountID).toBe("1");
  });

  // ─── Customer (EPS) ────────────────────────────────────────────

  it("EPS siempre es persona jurídica (AdditionalAccountID = 1)", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput({ tipo_documento: "31" }),
    );

    expect(result.invoice.AccountingCustomerParty.AdditionalAccountID).toBe("1");
  });

  // ─── InvoiceControl (resolución) ──────────────────────────────

  it("incluye datos de resolución en InvoiceControl", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput({
        numero_resolucion: "RES-9999",
        prefijo: "ABC",
        rango_desde: 100,
        rango_hasta: 500,
      }),
      crearClienteFevInput(),
    );

    const ic = result.invoice.InvoiceControl;
    expect(ic.InvoiceAuthorization).toBe("RES-9999");
    expect(ic.AuthorizedInvoices.Prefix).toBe("ABC");
    expect(ic.AuthorizedInvoices.From).toBe(100);
    expect(ic.AuthorizedInvoices.To).toBe(500);
  });

  it("incluye InvoiceControl en el XML serializado", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.xml).toContain("sts:InvoiceControl");
    expect(result.xml).toContain("sts:InvoiceAuthorization");
    expect(result.xml).toContain("sts:Prefix");
  });

  // ─── Metadatos UBL ─────────────────────────────────────────────

  it("establece UBLVersionID y ProfileID correctos", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.UBLVersionID).toBe("UBL 2.1");
    expect(result.invoice.ProfileID).toBe("DIAN 2.1");
    expect(result.invoice.InvoiceTypeCode).toBe("01");
    expect(result.invoice.DocumentCurrencyCode).toBe("COP");
  });

  it("ProfileExecutionID refleja el ambiente", () => {
    const prod = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
      "1",
    );
    expect(prod.invoice.ProfileExecutionID).toBe("1");

    const test = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
      "2",
    );
    expect(test.invoice.ProfileExecutionID).toBe("2");
  });

  // ─── Medio de pago ─────────────────────────────────────────────

  it("medio de pago es crédito (salud siempre a crédito con EPS)", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.PaymentMeans.ID).toBe("2"); // Crédito
    expect(result.invoice.PaymentMeans.PaymentMeansCode).toBe("42"); // Consignación
  });

  // ─── Fecha y hora ──────────────────────────────────────────────

  it("extrae fecha YYYY-MM-DD de fecha_expedicion", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06T15:30:00-05:00" }),
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.IssueDate).toBe("2026-03-06");
  });

  it("genera LineCountNumeric correcto", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      atencion: crearAtencionUI({ valor_consulta: 50000 }),
      procedimientos: [
        crearProcedimientoFactura({ codigo_cups: "A" }),
        crearProcedimientoFactura({ codigo_cups: "B" }),
      ],
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.LineCountNumeric).toBe(3); // 1 consulta + 2 procs
  });

  // ─── Copago y cuota moderadora en extensión salud ──────────────

  it("incluye copago y cuota moderadora en extensión salud", () => {
    const factura = crearFacturaCompleta({
      fecha_expedicion: "2026-03-06",
      copago: 5000,
      cuota_moderadora: 3500,
    });

    const result = generarXmlFev(
      factura,
      crearPerfilFevInput(),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    expect(result.invoice.HealthSector!.Copago).toBe(5000);
    expect(result.invoice.HealthSector!.CuotaModeradora).toBe(3500);
  });

  // ─── SoftwareProvider ──────────────────────────────────────────

  it("incluye SoftwareProvider con SHA-384 security code", () => {
    const result = generarXmlFev(
      crearFacturaCompleta({ fecha_expedicion: "2026-03-06" }),
      crearPerfilFevInput({ numero_documento: "NIT123" }),
      crearResolucionFevInput(),
      crearClienteFevInput(),
    );

    const sp = result.invoice.SoftwareProvider;
    expect(sp.ProviderID).toBe("NIT123");
    expect(sp.SoftwareID).toBe("test-software-id");
    // Security code should be a hex string (SHA-384 = 96 hex chars)
    expect(sp.SoftwareSecurityCode).toMatch(/^[a-f0-9]+$/);
  });
});
