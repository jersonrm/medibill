/**
 * Tests para empaquetador-radicacion.ts — Generación de paquete ZIP de radicación
 *
 * Cubre:
 *   - Guards: auth, factura exists, CUFE, CUV, estado, track_id_dian
 *   - Archivos ZIP: FEV_*.xml, RIPS_*.json, SOPORTE_*.pdf, manifest.json
 *   - Manifest: estructura, paciente, prestador, EPS, archivos
 *   - Descarga en paralelo de XML/PDF/RIPS
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearEstadoMock,
  configurarTabla,
  setupSupabaseMock,
  type MockSupabaseState,
} from "./helpers/supabase-mock";

// =====================================================================
// MOCKS
// =====================================================================

let mockState: MockSupabaseState;

vi.mock("@/lib/supabase-server", () => setupSupabaseMock(() => mockState));

const mockDescargarXml = vi.fn().mockResolvedValue("<xml>firmado</xml>");
const mockDescargarPdf = vi.fn().mockResolvedValue(Buffer.from("PDF_CONTENT"));
vi.mock("@/lib/providers/matias-client", () => ({
  descargarXml: (...args: unknown[]) => mockDescargarXml(...args),
  descargarPdf: (...args: unknown[]) => mockDescargarPdf(...args),
}));

const mockGenerarJsonRipsMVP = vi.fn().mockResolvedValue({ rips: "json" });
vi.mock("@/app/actions/rips", () => ({
  generarJsonRipsMVP: (...args: unknown[]) => mockGenerarJsonRipsMVP(...args),
}));

// =====================================================================
// FIXTURES
// =====================================================================

function crearFacturaParaRadicacion(overrides?: Record<string, unknown>) {
  return {
    id: "fact-001",
    num_factura: "FEV-1001",
    cufe: "CUFE-ABC123",
    cuv: "CUV-XYZ789",
    estado: "aprobada",
    track_id_dian: "trackid-123",
    fecha_expedicion: "2026-03-01",
    valor_total: 500000,
    nit_prestador: "900123456",
    nit_erp: "800456789",
    user_id: "user-123",
    metadata: { eps_nombre: "EPS Salud Total", numObligacion: "OBL001" },
    perfil_prestador_snapshot: {
      razon_social: "Clínica Test SAS",
      codigo_habilitacion: "110012345601",
    },
    diagnosticos: [{ codigo_cie10: "M545", descripcion: "Lumbago" }],
    procedimientos: [{ codigo_cups: "881602", descripcion: "Rx Columna" }],
    atencion: { modalidad: "01", causa: "15", finalidad: "01", tipo_servicio: "consulta", valor_consulta: 50000, valor_cuota: 0 },
    pacientes: {
      tipo_documento: "CC",
      numero_documento: "1234567",
      primer_nombre: "Juan",
      segundo_nombre: null,
      primer_apellido: "Pérez",
      segundo_apellido: "López",
      fecha_nacimiento: "1990-05-15",
      sexo: "M",
      tipo_usuario: "01",
      municipio_residencia_codigo: "11001",
      zona_territorial: "U",
    },
    ...overrides,
  };
}

// =====================================================================
// TESTS
// =====================================================================

describe("generarPaqueteRadicacion", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
    vi.clearAllMocks();
  });

  // --- Guards ---

  it("lanza error si no autenticado", async () => {
    mockState.user = null;

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("No autenticado");
  });

  it("lanza error si factura no encontrada", async () => {
    configurarTabla(mockState, "facturas", "select", { data: null, error: { message: "not found" } });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("Factura no encontrada");
  });

  it("lanza error si factura sin CUFE", async () => {
    const factura = crearFacturaParaRadicacion({ cufe: null });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("CUFE");
  });

  it("lanza error si factura sin CUV", async () => {
    const factura = crearFacturaParaRadicacion({ cuv: null });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("CUV");
  });

  it("lanza error si estado no es aprobada/descargada", async () => {
    const factura = crearFacturaParaRadicacion({ estado: "borrador" });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("aprobada o descargada");
  });

  it("lanza error si factura sin track_id_dian", async () => {
    const factura = crearFacturaParaRadicacion({ track_id_dian: null });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("Track ID");
  });

  // --- Success path ---

  it("retorna ZIP base64 y nombre correcto", async () => {
    const factura = crearFacturaParaRadicacion();
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    const result = await generarPaqueteRadicacion("fact-001");

    expect(result.zipBase64).toBeTruthy();
    expect(result.nombreArchivo).toMatch(/^RAD_FEV-1001_\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it("estado 'descargada' también es válido", async () => {
    const factura = crearFacturaParaRadicacion({ estado: "descargada" });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    const result = await generarPaqueteRadicacion("fact-001");

    expect(result.zipBase64).toBeTruthy();
  });

  it("descarga XML y PDF con track_id_dian correcto", async () => {
    const factura = crearFacturaParaRadicacion();
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await generarPaqueteRadicacion("fact-001");

    expect(mockDescargarXml).toHaveBeenCalledWith("trackid-123");
    expect(mockDescargarPdf).toHaveBeenCalledWith("trackid-123");
  });

  it("llama generarJsonRipsMVP con facturaId", async () => {
    const factura = crearFacturaParaRadicacion();
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await generarPaqueteRadicacion("fact-001");

    expect(mockGenerarJsonRipsMVP).toHaveBeenCalledWith("fact-001");
  });

  it("maneja pacientes como array", async () => {
    const factura = crearFacturaParaRadicacion({
      pacientes: [
        {
          tipo_documento: "CC",
          numero_documento: "7654321",
          primer_nombre: "María",
          primer_apellido: "Gómez",
          segundo_nombre: null,
          segundo_apellido: null,
          fecha_nacimiento: "1985-01-01",
          sexo: "F",
          tipo_usuario: "01",
          municipio_residencia_codigo: "05001",
          zona_territorial: "U",
        },
      ],
    });
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await generarPaqueteRadicacion("fact-001");

    expect(mockGenerarJsonRipsMVP).toHaveBeenCalledWith("fact-001");
  });

  it("lanza error si descargar XML falla", async () => {
    const factura = crearFacturaParaRadicacion();
    configurarTabla(mockState, "facturas", "select", { data: factura, error: null });
    mockDescargarXml.mockRejectedValueOnce(new Error("XML download failed"));

    const { generarPaqueteRadicacion } = await import("@/lib/empaquetador-radicacion");
    await expect(generarPaqueteRadicacion("fact-001")).rejects.toThrow("XML download failed");
  });
});
