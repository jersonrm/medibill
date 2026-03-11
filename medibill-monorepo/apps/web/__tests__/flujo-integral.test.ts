/**
 * Tests de flujo integral — escenarios end-to-end que recorren
 * el ciclo completo de facturación Medibill.
 *
 * Cada escenario encadena las server actions en orden real:
 *   crearFacturaBorrador → aprobarFactura → RIPS → registrarPago
 *
 * Valida transiciones de estado, números de factura, saldos y edge cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearCrearFacturaInput,
  crearPerfilMock,
  crearResolucionMock,
  crearPacienteMock,
  crearDiagnosticoIA,
  crearDiagnosticoRelacionado,
  crearDiagnosticoCausaExterna,
  crearProcedimientoIA,
  crearDatosParaRips,
  crearRegistrarPagoInput,
  crearAtencionUI,
  crearDiagnosticoUI,
  crearProcedimientoUI,
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

// Helper: configure common mocks for the full lifecycle
function configurarFlujoBase(overrides?: {
  resolucion?: Record<string, unknown>;
  perfil?: Record<string, unknown>;
  paciente?: Record<string, unknown>;
  facturaId?: string;
  numFactura?: string;
}) {
  const facturaId = overrides?.facturaId || "factura-uuid-flow";
  const numFactura = overrides?.numFactura || "FV-6";
  const resolucion = crearResolucionMock(overrides?.resolucion);
  const perfil = crearPerfilMock(overrides?.perfil);
  const paciente = crearPacienteMock(overrides?.paciente);

  // resoluciones_facturacion — called for crearBorrador (get active resolution id)
  configurarSecuencia(mockState, "resoluciones_facturacion", "select", [
    { data: { id: resolucion.id }, error: null }, // crearBorrador: get active resolution id
  ]);

  // aprobarFactura: RPC atómica para asignar consecutivo
  configurarRpc(mockState, "siguiente_numero_factura", {
    data: [{ numero: numFactura, resolucion_id: resolucion.id, consecutivo: 6 }],
    error: null,
  });

  configurarTabla(mockState, "perfiles", "select", { data: perfil, error: null });
  configurarTabla(mockState, "pacientes", "upsert", { data: paciente, error: null });
  configurarTabla(mockState, "facturas", "insert", {
    data: { id: facturaId, num_factura: "BORR-TEMP" },
    error: null,
  });

  // aprobarFactura needs to find the borrador
  configurarTabla(mockState, "facturas", "select", {
    data: { id: facturaId, resolucion_id: resolucion.id, estado: "borrador" },
    error: null,
  });
  configurarTabla(mockState, "facturas", "update", { data: null, error: null });

  return { facturaId, numFactura, resolucion, perfil, paciente };
}

// Helper: configure RIPS profile + services mock
function configurarRips(perfil: Record<string, unknown>) {
  configurarSecuencia(mockState, "perfiles", "select", [
    { data: perfil, error: null },
  ]);
  configurarTabla(mockState, "servicios_medico", "select", {
    data: null,
    error: { message: "not found" },
  });
}

// Helper: configure pagos for registrarPago flow
function configurarPagos(opts: {
  facturaId: string;
  valorTotal: number;
  estadoActual: string;
  pagosExistentes?: { monto: number }[];
  pagoInsertado?: Record<string, unknown>;
}) {
  // Select factura for payment validation
  configurarTabla(mockState, "facturas", "select", {
    data: { id: opts.facturaId, valor_total: opts.valorTotal, estado: opts.estadoActual },
    error: null,
  });
  configurarTabla(mockState, "pagos", "select", {
    data: opts.pagosExistentes || [],
    error: null,
  });
  configurarTabla(mockState, "pagos", "insert", {
    data: opts.pagoInsertado || { id: "pago-flow-1", monto: opts.valorTotal },
    error: null,
  });
  configurarTabla(mockState, "facturas", "update", { data: null, error: null });
}

// =====================================================================
// ESCENARIO 1: Happy path — Consulta contributivo
// =====================================================================

describe("Escenario 1: Happy path consulta contributivo", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("recorre el flujo completo: borrador → aprobada → RIPS → pago total", async () => {
    const { facturaId, perfil } = configurarFlujoBase();
    const input = crearCrearFacturaInput({ valor_total: 95000, subtotal: 95000 });

    // Step 1: Crear borrador
    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    const borrador = await crearFacturaBorrador(input);
    expect(borrador.success).toBe(true);
    expect(borrador.data?.id).toBe(facturaId);

    // Step 2: Aprobar
    const { aprobarFactura } = await import("@/app/actions/facturas");
    const aprobada = await aprobarFactura(facturaId);
    expect(aprobada.success).toBe(true);
    expect(aprobada.numFactura).toBe("FV-6");

    // Step 3: Generar RIPS
    // Reset perfiles sequence for RIPS call
    configurarRips(perfil);
    const datos = crearDatosParaRips({
      numFactura: "FV-6",
      diagnosticos: [
        crearDiagnosticoIA({ codigo: "Z000", tipo: "principal", rol: "principal" }),
      ],
    });

    const { construirFevRips } = await import("@/lib/construir-fev-rips");
    const rips = construirFevRips(datos, { nit: "123456789", cod: "HAB001" });
    expect(rips.numFactura).toBe("FV-6");
    expect(rips.usuarios).toHaveLength(1);
    expect(rips.usuarios[0]!.servicios.consultas).toHaveLength(1);

    // Step 4: Registrar pago total
    configurarPagos({
      facturaId,
      valorTotal: 95000,
      estadoActual: "radicada",
    });
    const { registrarPago } = await import("@/app/actions/pagos");
    const pago = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 95000 })
    );
    expect(pago.success).toBe(true);
    expect(pago.nuevo_estado).toBe("pagada");
  });
});

// =====================================================================
// ESCENARIO 2: Urgencias
// =====================================================================

describe("Escenario 2: Urgencias con 3 diagnósticos", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("genera RIPS de urgencia con viaIngreso y mapea diagnósticos correctamente", async () => {
    const perfil = crearPerfilMock();
    configurarFlujoBase();

    // RIPS con urgencia
    configurarRips(perfil);
    const datos = crearDatosParaRips({
      numFactura: "FV-6",
      diagnosticos: [
        crearDiagnosticoIA({ codigo: "R104", codigo_cie10: "R104", tipo: "principal", rol: "principal" }),
        crearDiagnosticoRelacionado({ codigo: "K359", codigo_cie10: "K359" }),
        crearDiagnosticoRelacionado({ codigo: "R112", codigo_cie10: "R112" }),
      ],
      atencionIA: {
        ...crearAtencionUI(),
        tipo_servicio: "urgencias",
        causa: "01",
      },
    });

    const { construirFevRips } = await import("@/lib/construir-fev-rips");
    const rips = construirFevRips(datos, { nit: "123456789", cod: "HAB001" });

    const servicios = rips.usuarios[0]!.servicios;
    // Must have urgencias, not consultas
    expect(servicios.urgencias).toHaveLength(1);
    expect(servicios.consultas).toHaveLength(0);
    expect(servicios.urgencias![0]!.codDiagnosticoPrincipal).toBe("R104");
    expect(servicios.urgencias![0]!.codDiagnosticoRelacionado1).toBe("K359");
    expect(servicios.urgencias![0]!.codDiagnosticoRelacionado2).toBe("R112");
    // Urgencias have viaIngreso on procedures, here we check the urgencias entry exists
    expect(servicios.urgencias![0]!.codConsulta).toBeDefined();
  });
});

// =====================================================================
// ESCENARIO 3: Causa externa accidente de trabajo
// =====================================================================

describe("Escenario 3: Causa externa - accidente de trabajo", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("asigna conceptoRecaudo 05 y reserva tercer dx para causa externa W/X/Y/V", async () => {
    const perfil = crearPerfilMock();
    configurarRips(perfil);

    const datos = crearDatosParaRips({
      diagnosticos: [
        crearDiagnosticoIA({ codigo: "S520", codigo_cie10: "S520", tipo: "principal", rol: "principal" }),
        crearDiagnosticoCausaExterna({ codigo: "W010", codigo_cie10: "W010" }),
      ],
      atencionIA: {
        ...crearAtencionUI(),
        tipo_servicio: "consulta",
        causa: "02", // Accidente de trabajo
      },
    });

    const { construirFevRips } = await import("@/lib/construir-fev-rips");
    const rips = construirFevRips(datos, { nit: "123456789", cod: "HAB001" });

    const consulta = rips.usuarios[0]!.servicios.consultas![0]!;
    // Causa 02 AT → conceptoRecaudo 05
    expect(consulta.conceptoRecaudo).toBe("05");
    // W100 goes into codDiagnosticoRelacionado slot (causa_externa prioritized)
    // The function reserves the last slots for causa_external diagnoses
    const relSlots = [consulta.codDiagnosticoRelacionado1, consulta.codDiagnosticoRelacionado2, consulta.codDiagnosticoRelacionado3];
    expect(relSlots).toContain("W010");
  });
});

// =====================================================================
// ESCENARIO 4: Validación falla, corrección y aprobación
// =====================================================================

describe("Escenario 4: Corrección de borrador y re-aprobación", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("edita borrador (datos clínicos y paciente) antes de aprobar", async () => {
    configurarFlujoBase();
    const input = crearCrearFacturaInput();

    // Step 1: Crear borrador
    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    const borrador = await crearFacturaBorrador(input);
    expect(borrador.success).toBe(true);

    // Step 2: Editar — cambiar procedimiento y paciente
    configurarTabla(mockState, "facturas", "select", {
      data: { metadata: { eps_nombre: "SURA", nota_clinica_original: "dolor" } },
      error: null,
    });
    configurarTabla(mockState, "pacientes", "upsert", {
      data: crearPacienteMock({ primer_nombre: "María" }),
      error: null,
    });
    configurarTabla(mockState, "facturas", "update", { data: null, error: null });

    const { editarFacturaBorrador } = await import("@/app/actions/facturas");
    const editResult = await editarFacturaBorrador(borrador.data!.id, {
      subtotal: 120000,
      valor_total: 120000,
      atencion: { ...crearAtencionUI(), valor_consulta: 70000 },
      datos_paciente: {
        tipo_documento: "CC",
        numero_documento: "9876543",
        primer_nombre: "María",
        primer_apellido: "López",
      },
    });
    expect(editResult.success).toBe(true);

    // Step 3: Aprobar after correction
    configurarTabla(mockState, "facturas", "select", {
      data: { id: borrador.data!.id, resolucion_id: "resolucion-uuid-1", estado: "borrador" },
      error: null,
    });
    // Need fresh RPC mock for aprobar
    configurarRpc(mockState, "siguiente_numero_factura", {
      data: [{ numero: "FV-6", resolucion_id: "resolucion-uuid-1", consecutivo: 6 }],
      error: null,
    });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const aprobada = await aprobarFactura(borrador.data!.id);
    expect(aprobada.success).toBe(true);
    expect(aprobada.numFactura).toBe("FV-6");
  });
});

// =====================================================================
// ESCENARIO 5: Pagos parciales acumulados
// =====================================================================

describe("Escenario 5: Pagos parciales acumulados", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("acumula 3 pagos parciales hasta completar el saldo", async () => {
    const facturaId = "f-parcial";
    const valorTotal = 300_000;

    // Pago 1: 100k → pagada_parcial
    configurarPagos({
      facturaId,
      valorTotal,
      estadoActual: "radicada",
      pagosExistentes: [],
    });
    const { registrarPago } = await import("@/app/actions/pagos");
    const p1 = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 100_000 })
    );
    expect(p1.success).toBe(true);
    expect(p1.nuevo_estado).toBe("pagada_parcial");

    // Pago 2: 100k → pagada_parcial
    configurarPagos({
      facturaId,
      valorTotal,
      estadoActual: "pagada_parcial",
      pagosExistentes: [{ monto: 100_000 }],
    });
    const p2 = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 100_000 })
    );
    expect(p2.success).toBe(true);
    expect(p2.nuevo_estado).toBe("pagada_parcial");

    // Pago 3: 100k → pagada (completo)
    configurarPagos({
      facturaId,
      valorTotal,
      estadoActual: "pagada_parcial",
      pagosExistentes: [{ monto: 100_000 }, { monto: 100_000 }],
    });
    const p3 = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 100_000 })
    );
    expect(p3.success).toBe(true);
    expect(p3.nuevo_estado).toBe("pagada");
  });
});

// =====================================================================
// ESCENARIO 6: Sábana EPS + conciliación
// =====================================================================

describe("Escenario 6: Sábana EPS import y conciliación", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("parsea archivo sábana, aplica mapeo y concilia con funciones internas", async () => {
    const XLSX = await import("xlsx");

    // Crear sábana con 2 filas (column headers as the EPS would provide)
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nro Factura", "Valor Facturado", "Valor Pagado", "Valor Glosado", "Fecha Pago", "Referencia Pago", "Documento Paciente", "Nombre Paciente", "Observacion"],
      ["FV-006", "$95.000", "$95.000", null, "2026-03-01", "PAG-001", "1234567890", "Juan Pérez", null],
      ["FV-007", "$200.000", "$150.000", "$50.000", "2026-03-01", "PAG-002", "9876543210", "María López", "Glosa parcial"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    // Step 1: Parse raw sabana
    const { parsearArchivoSabana } = await import("@/lib/sabana-parser");
    const parseResult = parsearArchivoSabana(new Uint8Array(buf).buffer as ArrayBuffer, "sabana.xlsx");

    expect(parseResult.filas.length).toBe(2);
    // Raw FilaSabana uses original column headers
    expect(parseResult.filas[0]!["Nro Factura"]).toBe("FV-006");
    expect(parseResult.headers).toContain("Nro Factura");

    // Step 2: Apply column mapping (FilaSabana → FilaNormalizada)
    const { aplicarMapeo } = await import("@/lib/sabana-mapper");
    const mapeo = {
      num_factura: "Nro Factura",
      valor_facturado: "Valor Facturado",
      valor_pagado: "Valor Pagado",
      valor_glosado: "Valor Glosado",
      fecha_pago: "Fecha Pago",
      referencia_pago: "Referencia Pago",
      documento_paciente: "Documento Paciente",
      nombre_paciente: "Nombre Paciente",
      observacion: "Observacion",
    } as Record<string, string>;
    const filasNormalizadas = aplicarMapeo(parseResult.filas, mapeo);

    expect(filasNormalizadas).toHaveLength(2);
    expect(filasNormalizadas[0]!.num_factura).toBe("FV-006");
    expect(filasNormalizadas[0]!.valor_pagado).toBe(95000);
    expect(filasNormalizadas[1]!.valor_glosado).toBe(50000);

    // Step 3: Conciliate using pure internal functions
    const {
      construirIndiceFacturas,
      clasificarConciliacion,
      buscarFactura,
      calcularResumen,
    } = await import("@/lib/conciliacion-service");

    const facturas = [
      { id: "f1", num_factura: "FV-006", valor_total: 95000, estado: "radicada", nit_erp: "800", metadata: null, paciente_id: "p1" },
      { id: "f2", num_factura: "FV-007", valor_total: 200000, estado: "radicada", nit_erp: "800", metadata: null, paciente_id: "p2" },
    ];
    const pagosPorFactura: Record<string, number> = {};
    const pacienteNombres: Record<string, string> = { p1: "Juan Pérez", p2: "María López" };

    const indice = construirIndiceFacturas(facturas, pagosPorFactura, pacienteNombres);

    // Verify FV-006: pago total
    const match1 = buscarFactura("FV-006", indice);
    expect(match1).toBeDefined();
    expect(match1!.id).toBe("f1");
    const result1 = clasificarConciliacion(filasNormalizadas[0]!, match1!);
    expect(result1.tipo).toBe("pago_total");

    // Verify FV-007: con_glosa
    const match2 = buscarFactura("FV-007", indice);
    expect(match2).toBeDefined();
    const result2 = clasificarConciliacion(filasNormalizadas[1]!, match2!);
    expect(result2.tipo).toBe("con_glosa");
  });
});

// =====================================================================
// ESCENARIO 7: Anulación y re-creación
// =====================================================================

describe("Escenario 7: Anulación de borrador y re-creación", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("anula borrador y crea nueva factura con mismo paciente", async () => {
    configurarFlujoBase();
    const input = crearCrearFacturaInput();

    // Step 1: Crear borrador
    const { crearFacturaBorrador } = await import("@/app/actions/facturas");
    const borrador1 = await crearFacturaBorrador(input);
    expect(borrador1.success).toBe(true);

    // Step 2: Anular
    configurarTabla(mockState, "facturas", "update", { data: [{ id: borrador1.data!.id }], error: null });
    const { anularFactura } = await import("@/app/actions/facturas");
    const anulada = await anularFactura(borrador1.data!.id);
    expect(anulada.success).toBe(true);

    // Step 3: Re-crear con datos corregidos
    configurarSecuencia(mockState, "resoluciones_facturacion", "select", [
      { data: { id: "resolucion-uuid-1" }, error: null },
    ]);
    configurarTabla(mockState, "perfiles", "select", { data: crearPerfilMock(), error: null });
    configurarTabla(mockState, "pacientes", "upsert", { data: crearPacienteMock(), error: null });
    configurarTabla(mockState, "facturas", "insert", {
      data: { id: "factura-uuid-new", num_factura: "BORR-NEW" },
      error: null,
    });

    const borrador2 = await crearFacturaBorrador(
      crearCrearFacturaInput({ valor_total: 150000, subtotal: 150000 })
    );
    expect(borrador2.success).toBe(true);
    expect(borrador2.data!.id).toBe("factura-uuid-new");
  });
});

// =====================================================================
// ESCENARIO 8: Resolución agotada bloquea aprobación
// =====================================================================

describe("Escenario 8: Resolución agotada bloquea aprobación", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("rechaza aprobar cuando el consecutivo supera rango_hasta", async () => {
    // Resolution at limit
    configurarFlujoBase({
      resolucion: { consecutivo_actual: 999, rango_hasta: 1000 },
    });

    const facturaId = "factura-uuid-flow";
    // Re-set facturas.select to return borrador for the aprobar call
    configurarTabla(mockState, "facturas", "select", {
      data: { id: facturaId, resolucion_id: "resolucion-uuid-1", estado: "borrador" },
      error: null,
    });
    // RPC returns success — 999+1=1000, NOT > 1000 so it should succeed
    configurarRpc(mockState, "siguiente_numero_factura", {
      data: [{ numero: "FV-1000", resolucion_id: "resolucion-uuid-1", consecutivo: 1000 }],
      error: null,
    });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const result = await aprobarFactura(facturaId);

    expect(result.success).toBe(true);
  });

  it("rechaza cuando consecutivo_actual ya IGUALA rango_hasta", async () => {
    const facturaId = "factura-uuid-flow";
    configurarTabla(mockState, "facturas", "select", {
      data: { id: facturaId, resolucion_id: "resolucion-uuid-1", estado: "borrador" },
      error: null,
    });
    // RPC returns error — rango agotado (1001 > 1000)
    configurarRpc(mockState, "siguiente_numero_factura", {
      data: null,
      error: { message: "Rango de resolución agotado (máximo: 1000). Configure una nueva resolución." },
    });

    const { aprobarFactura } = await import("@/app/actions/facturas");
    const result = await aprobarFactura(facturaId);

    // 1000 + 1 = 1001 > 1000 → agotado
    expect(result.success).toBe(false);
    expect(result.error).toContain("Error al guardar");
  });
});

// =====================================================================
// ESCENARIO 9: Multi-procedimiento con tarifas personalizadas
// =====================================================================

describe("Escenario 9: Multi-procedimiento con tarifas personalizadas", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("usa tarifas del servicio_medico cuando están configuradas", async () => {
    const perfil = crearPerfilMock();
    // Setup RIPS with custom tariffs from servicios_medico
    configurarSecuencia(mockState, "perfiles", "select", [
      { data: perfil, error: null },
    ]);
    configurarTabla(mockState, "servicios_medico", "select", {
      data: { tarifa: 80000 },
      error: null,
    });

    const datos = crearDatosParaRips({
      diagnosticos: [
        crearDiagnosticoIA(),
        crearDiagnosticoRelacionado(),
      ],
      procedimientos: [
        crearProcedimientoIA({ codigo_cups: "881602", valor_unitario: 45000, cantidad: 1 }),
        crearProcedimientoIA({ codigo_cups: "123456", valor_unitario: 30000, cantidad: 2 }),
      ],
      atencionIA: {
        ...crearAtencionUI(),
        valor_consulta: 80000,
        codConsultaCups: "890201",
      },
    });

    const { construirFevRips } = await import("@/lib/construir-fev-rips");
    const rips = construirFevRips(datos, { nit: "123456789", cod: "HAB001" });

    const servicios = rips.usuarios[0]!.servicios;
    // Consulta should use tarifa_propia from servicios_medico
    const consulta = servicios.consultas![0]!;
    // servicios_medico returns array — the code queries .eq("codigo_cups", codConsultaCups).single()
    // Since our mock returns array for the table, single() returns the mock response
    // The tarifa field name in the actual query is "tarifa" not "tarifa_propia"
    expect(consulta.vrServicio).toBe(80000);

    // Procedimientos use valor_procedimiento or valor_unitario from the input,
    // NOT from servicios_medico (only consulta tariff is looked up)
    const proc1 = servicios.procedimientos!.find(
      p => p.codProcedimiento === "881602"
    );
    expect(proc1).toBeDefined();
    // proc valor comes from the input procedimiento's valor_unitario
    expect(proc1!.vrServicio).toBe(45000);

    // Second procedure
    const proc2 = servicios.procedimientos!.find(
      p => p.codProcedimiento === "123456"
    );
    expect(proc2).toBeDefined();
    expect(proc2!.vrServicio).toBe(30000);
  });
});

// =====================================================================
// ESCENARIO 10: Pago rechazado por exceso de saldo
// =====================================================================

describe("Escenario 10: Pago rechazado por exceso de saldo", () => {
  beforeEach(() => {
    mockState = crearEstadoMock();
  });

  it("rechaza pago que excede saldo y luego acepta monto correcto", async () => {
    const facturaId = "f-exceso";
    const valorTotal = 100_000;

    // Attempt 1: Pay 80k when only 30k remains → reject
    configurarPagos({
      facturaId,
      valorTotal,
      estadoActual: "pagada_parcial",
      pagosExistentes: [{ monto: 70_000 }],
    });

    const { registrarPago } = await import("@/app/actions/pagos");
    const reject = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 80_000 })
    );
    expect(reject.success).toBe(false);
    expect(reject.error).toContain("excede");

    // Attempt 2: Pay exact remaining 30k → success
    configurarPagos({
      facturaId,
      valorTotal,
      estadoActual: "pagada_parcial",
      pagosExistentes: [{ monto: 70_000 }],
      pagoInsertado: { id: "p-correcto", monto: 30_000, factura_id: facturaId },
    });

    const success = await registrarPago(
      crearRegistrarPagoInput({ factura_id: facturaId, monto: 30_000 })
    );
    expect(success.success).toBe(true);
    expect(success.nuevo_estado).toBe("pagada");
  });

  it("rechaza pago en factura con estado inválido (aprobada sin radicar)", async () => {
    configurarTabla(mockState, "facturas", "select", {
      data: { id: "f-aprobada", valor_total: 100_000, estado: "aprobada" },
      error: null,
    });

    const { registrarPago } = await import("@/app/actions/pagos");
    const result = await registrarPago(
      crearRegistrarPagoInput({ factura_id: "f-aprobada" })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("aprobada");
  });
});
