import { describe, it, expect } from "vitest";
import { mapFacturaToMatiasJson } from "@/lib/providers/matias-mapper";
import type { FacturaCompleta } from "@/lib/types/factura";
import type { PerfilFevInput, ResolucionFevInput, ClienteFevInput, PacienteFevInput } from "@/lib/types/fev-xml";

// =====================================================================
// FIXTURES
// =====================================================================

const facturaMock: FacturaCompleta = {
  id: "test-uuid",
  user_id: "user-uuid",
  num_factura: "FEV-001",
  num_fev: "FEV001",
  nit_prestador: "900123456",
  nit_erp: "800456789",
  fecha_expedicion: "2026-03-06T10:30:00-05:00",
  fecha_radicacion: null,
  valor_total: 150000,
  subtotal: 170000,
  descuentos: 0,
  copago: 10000,
  cuota_moderadora: 10000,
  estado: "aprobada",
  paciente_id: "pac-uuid",
  resolucion_id: "res-uuid",
  diagnosticos: [
    { codigo_cie10: "J06.9", descripcion: "Infección aguda de las vías respiratorias superiores", rol: "principal", alternativas: [] },
  ],
  procedimientos: [
    {
      codigo_cups: "890201",
      descripcion: "Consulta de primera vez por medicina general",
      cantidad: 1,
      valor_unitario: 50000,
      fuente_tarifa: "pactada" as const,
      alternativas: [],
    },
    {
      codigo_cups: "903841",
      descripcion: "Hemograma completo",
      cantidad: 1,
      valor_unitario: 20000,
      fuente_tarifa: "pactada" as const,
      alternativas: [],
    },
  ],
  atencion: {
    modalidad: "01",
    causa: "15",
    finalidad: "10",
    tipo_diagnostico: "01",
    tipo_servicio: "consulta",
    valor_consulta: 100000,
    valor_cuota: 0,
    codConsultaCups: "890201",
    numAutorizacion: "AUTH-12345",
  },
  nota_clinica_original: "Paciente con cuadro respiratorio agudo",
  perfil_prestador_snapshot: null,
  fev_rips_json: null,
  metadata: {},
  created_at: "2026-03-06T10:00:00Z",
  updated_at: "2026-03-06T10:30:00Z",
  cufe: null,
  estado_dian: null,
  track_id_dian: null,
  fecha_envio_dian: null,
  respuesta_dian_json: null,
  cuv: null,
  estado_muv: null,
  fecha_envio_muv: null,
  respuesta_muv_json: null,
};

const perfilMock: PerfilFevInput = {
  tipo_documento: "CC",
  numero_documento: "900123456",
  digito_verificacion: "7",
  razon_social: "Dr. Juan Pérez",
  nombre_comercial: "Consultorio Dr. Pérez",
  codigo_habilitacion: "11001100101",
  tipo_prestador: "profesional_independiente",
  direccion: "Calle 100 #15-20",
  municipio_codigo: "11001",
  municipio_nombre: "Bogotá D.C.",
  departamento_codigo: "11",
  departamento_nombre: "Bogotá D.C.",
  telefono: "3001234567",
  email_facturacion: "doc@medibill.co",
  responsable_iva: false,
  regimen_fiscal: "no_responsable",
};

const resolucionMock: ResolucionFevInput = {
  numero_resolucion: "18764000001234",
  fecha_resolucion: "2025-01-15",
  prefijo: "FEV",
  rango_desde: 1,
  rango_hasta: 10000,
  fecha_vigencia_desde: "2025-01-15",
  fecha_vigencia_hasta: "2027-01-15",
  clave_tecnica: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
};

const clienteMock: ClienteFevInput = {
  tipo_documento: "31",
  numero_documento: "800456789",
  razon_social: "Nueva EPS S.A.",
  nombre_comercial: "Nueva EPS",
  responsable_iva: true,
  email: "facturacion@nuevaeps.com",
};

const pacienteMock: PacienteFevInput = {
  tipo_documento: "CC",
  numero_documento: "1023456789",
  primer_nombre: "María",
  segundo_nombre: "Elena",
  primer_apellido: "García",
  segundo_apellido: "López",
  tipo_usuario: "01",
  sexo: "F",
  fecha_nacimiento: "1990-05-15",
  municipio_residencia_codigo: "11001",
  zona_territorial: "U",
  eps_codigo: "EPS010",
  eps_nombre: "Nueva EPS",
};

// =====================================================================
// TESTS
// =====================================================================

describe("mapFacturaToMatiasJson", () => {
  it("genera un request con los campos obligatorios", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    expect(result.resolution_number).toBe("18764000001234");
    expect(result.prefix).toBe("FEV");
    expect(result.type_document_id).toBe(7);
    expect(result.operation_type_id).toBe(1);
    expect(result.date).toBe("2026-03-06");
    expect(result.time).toBe("10:30:00");
  });

  it("mapea correctamente el customer (EPS como NIT)", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    expect(result.customer.identity_document_id).toBe(6); // NIT
    expect(result.customer.type_organization_id).toBe(1); // Persona Jurídica
    expect(result.customer.company_name).toBe("Nueva EPS S.A.");
    expect(result.customer.dni).toBe("800456789");
    expect(result.customer.country_id).toBe(45); // Colombia
    expect(result.customer.tax_regime_id).toBe(1); // Responsable IVA
  });

  it("genera líneas por consulta + procedimientos", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    // 1 consulta (valor_consulta=100000) + 2 procedimientos
    expect(result.lines).toHaveLength(3);

    // Consulta médica
    expect(result.lines[0]!.description).toBe("Consulta médica");
    expect(result.lines[0]!.code).toBe("890201");
    expect(result.lines[0]!.price_amount).toBe("100000.00");

    // Procedimientos
    expect(result.lines[1]!.code).toBe("890201");
    expect(result.lines[1]!.price_amount).toBe("50000.00");
    expect(result.lines[2]!.code).toBe("903841");
    expect(result.lines[2]!.price_amount).toBe("20000.00");
  });

  it("impuestos son 0 para servicios de salud", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    expect(result.tax_totals).toHaveLength(1);
    expect(result.tax_totals[0]!.tax_id).toBe(1); // IVA
    expect(result.tax_totals[0]!.tax_amount).toBe("0.00");
    expect(result.tax_totals[0]!.percent).toBe("0");
  });

  it("genera extensión sector salud con user_collections", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    expect(result.health).toBeDefined();
    expect(result.health!.operation_type).toBe("SS-CUFE");
    expect(result.health!.user_collections).toHaveLength(1);

    const info = result.health!.user_collections[0]!.information;
    const findField = (name: string) => info.find(i => i.name === name);

    expect(findField("CODIGO_PRESTADOR")?.value).toBe("11001100101");
    expect(findField("TIPO_USUARIO")?.value).toBe("01");
    expect(findField("PRIMER_NOMBRE")?.value).toBe("María");
    expect(findField("PRIMER_APELLIDO")?.value).toBe("García");
    expect(findField("NUMERO_DOCUMENTO_IDENTIFICACION")?.value).toBe("1023456789");
    expect(findField("MODALIDAD_CONTRATACION")?.value).toBe("01");
    expect(findField("NUMERO_AUTORIZACION")?.value).toBe("AUTH-12345");
    expect(findField("COPAGO")?.value).toBe("10000.00");
    expect(findField("CUOTA_MODERADORA")?.value).toBe("10000.00");
  });

  it("totales monetarios son coherentes", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    // Subtotal líneas = consulta(100000) + proc1(50000) + proc2(20000) = 170000
    expect(result.legal_monetary_totals.line_extension_amount).toBe("170000.00");
    expect(result.legal_monetary_totals.tax_exclusive_amount).toBe("170000.00");
    // Sin IVA → mismo valor
    expect(result.legal_monetary_totals.tax_inclusive_amount).toBe("170000.00");
    expect(result.legal_monetary_totals.payable_amount).toBe("150000.00");
  });

  it("pago es crédito por defecto (salud)", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock, pacienteMock);

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]!.payment_method_id).toBe(2); // Crédito
    expect(result.payments[0]!.means_payment_id).toBe(42); // Consignación
    expect(result.payments[0]!.value_paid).toBe("150000.00");
  });

  it("funciona sin datos de paciente", () => {
    const result = mapFacturaToMatiasJson(facturaMock, perfilMock, resolucionMock, clienteMock);

    expect(result.health).toBeDefined();
    const info = result.health!.user_collections[0]!.information;
    const tipoUsuario = info.find(i => i.name === "TIPO_USUARIO");
    expect(tipoUsuario?.value).toBe("01"); // Default
  });
});
