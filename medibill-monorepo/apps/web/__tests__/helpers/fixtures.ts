/**
 * Shared test fixtures and factory functions for Medibill tests.
 * All factories return valid defaults with optional Partial<T> overrides.
 */

import type { DatosParaRips, MedicamentoInput, OtroServicioInput } from "@/lib/types/rips";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";
import type { CrearFacturaInput, FacturaCompleta } from "@/lib/types/factura";
import type { RegistrarPagoInput, PagoDB } from "@/lib/types/pago";
import type { FilaNormalizada, FilaSabana } from "@/lib/types/sabana";
import type { AtencionUI, DiagnosticoUI, ProcedimientoUI } from "@/lib/types/ui";

// =====================================================================
// DIAGNOSTICOS & PROCEDIMIENTOS (IA types)
// =====================================================================

export function crearDiagnosticoIA(overrides?: Partial<DiagnosticoIA>): DiagnosticoIA {
  return {
    codigo: "Z000",
    descripcion: "Examen general de rutina",
    tipo: "principal",
    codigo_cie10: "Z000",
    rol: "principal",
    cie10_validado: true,
    ...overrides,
  };
}

export function crearDiagnosticoRelacionado(overrides?: Partial<DiagnosticoIA>): DiagnosticoIA {
  return crearDiagnosticoIA({
    codigo: "M545",
    descripcion: "Lumbago no especificado",
    tipo: "relacionado",
    codigo_cie10: "M545",
    rol: "relacionado",
    ...overrides,
  });
}

export function crearDiagnosticoCausaExterna(overrides?: Partial<DiagnosticoIA>): DiagnosticoIA {
  return crearDiagnosticoIA({
    codigo: "W010",
    descripcion: "Caída en el mismo nivel por tropezón",
    tipo: "relacionado",
    codigo_cie10: "W010",
    rol: "causa_externa",
    ...overrides,
  });
}

export function crearProcedimientoIA(overrides?: Partial<ProcedimientoIA>): ProcedimientoIA {
  return {
    codigo_cups: "890201",
    descripcion: "Consulta de primera vez por medicina general",
    cantidad: 1,
    valor_unitario: 50000,
    cups_validado: true,
    ...overrides,
  };
}

// =====================================================================
// DIAGNOSTICOS & PROCEDIMIENTOS (UI types)
// =====================================================================

export function crearDiagnosticoUI(overrides?: Partial<DiagnosticoUI>): DiagnosticoUI {
  return {
    codigo_cie10: "Z000",
    descripcion: "Examen general de rutina",
    rol: "principal",
    alternativas: [],
    ...overrides,
  };
}

export function crearProcedimientoUI(overrides?: Partial<ProcedimientoUI>): ProcedimientoUI {
  return {
    codigo_cups: "881602",
    descripcion: "Radiografía de columna lumbosacra",
    cantidad: 1,
    alternativas: [],
    valor_procedimiento: 45000,
    valor_unitario: 45000,
    fuente_tarifa: "propia",
    ...overrides,
  };
}

export function crearAtencionUI(overrides?: Partial<AtencionUI>): AtencionUI {
  return {
    modalidad: "01",
    causa: "15",
    finalidad: "01",
    tipo_diagnostico: "01",
    tipo_servicio: "consulta",
    valor_consulta: 50000,
    valor_cuota: 0,
    codConsultaCups: "890201",
    ...overrides,
  };
}

// =====================================================================
// DATOS PARA RIPS
// =====================================================================

export function crearDatosParaRips(overrides?: Partial<DatosParaRips>): DatosParaRips {
  return {
    numFactura: "FV-001",
    numObligacion: "",
    tipoDocumentoPaciente: "CC",
    documentoPaciente: "1234567890",
    fechaNacimientoPaciente: "1990-05-15",
    sexoPaciente: "M",
    tipoUsuarioPaciente: "01",
    codPaisResidencia: "170",
    codMunicipioResidencia: "11001",
    codZonaTerritorialResidencia: "U",
    incapacidad: "NO",
    codEntidadAdministradora: "EPS001",
    diagnosticos: [crearDiagnosticoIA()],
    procedimientos: [],
    atencionIA: {
      modalidad: "01",
      causa: "15",
      finalidad: "01",
      tipo_diagnostico: "01",
      tipo_servicio: "consulta",
      valor_consulta: 50000,
      valor_cuota: 0,
      codConsultaCups: "890201",
    },
    ...overrides,
  };
}

// =====================================================================
// MEDICAMENTOS & OTROS SERVICIOS
// =====================================================================

export function crearMedicamentoInput(overrides?: Partial<MedicamentoInput>): MedicamentoInput {
  return {
    codMedicamento: "J01CA04",
    tipoMedicamento: "01",
    nombreGenerico: "Amoxicilina",
    formaFarmaceutica: "Cápsulas",
    concentracion: "500mg",
    unidadMedida: "Cápsula",
    cantidadDispensada: 21,
    diasTratamiento: 7,
    vrUnitMedicamento: 500,
    ...overrides,
  };
}

export function crearOtroServicioInput(overrides?: Partial<OtroServicioInput>): OtroServicioInput {
  return {
    codTecnologiaSalud: "INS001",
    nomTecnologiaSalud: "Guantes de nitrilo caja x100",
    cantidad: 2,
    vrUnitTecnologia: 15000,
    ...overrides,
  };
}

// =====================================================================
// FACTURA INPUT & COMPLETE
// =====================================================================

export function crearCrearFacturaInput(overrides?: Partial<CrearFacturaInput>): CrearFacturaInput {
  return {
    nit_erp: "800123456",
    eps_nombre: "EPS SURA",
    paciente_tipo_documento: "CC",
    paciente_numero_documento: "1234567890",
    paciente_nombre: "Juan Pérez",
    diagnosticos: [{ ...crearDiagnosticoUI(), manual: false }],
    procedimientos: [{
      ...crearProcedimientoUI(),
      manual: false,
      valor_unitario: 45000,
      fuente_tarifa: "propia" as const,
    }],
    atencion: crearAtencionUI(),
    nota_clinica_original: "Paciente con dolor lumbar crónico",
    subtotal: 95000,
    copago: 0,
    cuota_moderadora: 0,
    descuentos: 0,
    valor_total: 95000,
    datos_paciente: {
      tipo_documento: "CC",
      numero_documento: "1234567890",
      primer_nombre: "Juan",
      primer_apellido: "Pérez",
      segundo_nombre: "Carlos",
      segundo_apellido: "García",
      fecha_nacimiento: "1990-05-15",
      sexo: "M",
      tipo_usuario: "01",
      eps_codigo: "EPS001",
      eps_nombre: "EPS SURA",
      municipio_residencia_codigo: "11001",
      zona_territorial: "U",
    },
    ...overrides,
  };
}

export function crearFacturaCompleta(overrides?: Partial<FacturaCompleta>): FacturaCompleta {
  return {
    id: "factura-uuid-1",
    user_id: "user-test-123",
    num_factura: "FV-001",
    num_fev: null,
    nit_prestador: "123456789",
    nit_erp: "800123456",
    fecha_expedicion: "2026-03-06",
    fecha_radicacion: null,
    valor_total: 95000,
    subtotal: 95000,
    descuentos: 0,
    copago: 0,
    cuota_moderadora: 0,
    estado: "borrador",
    paciente_id: "paciente-uuid-1",
    resolucion_id: "resolucion-uuid-1",
    diagnosticos: [{ ...crearDiagnosticoUI(), manual: false }],
    procedimientos: [{
      ...crearProcedimientoUI(),
      manual: false,
      valor_unitario: 45000,
      fuente_tarifa: "propia" as const,
    }],
    atencion: crearAtencionUI(),
    nota_clinica_original: "Paciente con dolor lumbar crónico",
    perfil_prestador_snapshot: {
      numero_documento: "123456789",
      nombre_completo: "Dr. Test",
      codigo_habilitacion: "HAB001",
    },
    fev_rips_json: null,
    metadata: {
      eps_nombre: "EPS SURA",
      atencion: crearAtencionUI(),
      nota_clinica_original: "Paciente con dolor lumbar crónico",
    },
    created_at: "2026-03-06T10:00:00.000Z",
    updated_at: "2026-03-06T10:00:00.000Z",
    cufe: null,
    estado_dian: null,
    track_id_dian: null,
    fecha_envio_dian: null,
    respuesta_dian_json: null,
    cuv: null,
    estado_muv: null,
    fecha_envio_muv: null,
    respuesta_muv_json: null,
    ...overrides,
  };
}

// =====================================================================
// PERFIL & RESOLUCIÓN
// =====================================================================

export function crearPerfilMock(overrides?: Record<string, unknown>) {
  return {
    id: "user-test-123",
    user_id: "user-test-123",
    numero_documento: "123456789",
    tipo_documento: "CC",
    nombre_completo: "Dr. Test Medibill",
    codigo_habilitacion: "HAB001",
    email: "test@medibill.co",
    onboarding_completo: true,
    ...overrides,
  };
}

export function crearResolucionMock(overrides?: Record<string, unknown>) {
  return {
    id: "resolucion-uuid-1",
    user_id: "user-test-123",
    numero_resolucion: "18764000001234",
    prefijo: "FV-",
    rango_inicio: 1,
    rango_hasta: 1000,
    consecutivo_actual: 5,
    activa: true,
    fecha_inicio: "2025-01-01",
    fecha_fin: "2027-01-01",
    clave_tecnica: "abc123",
    ...overrides,
  };
}

// =====================================================================
// PAGOS
// =====================================================================

export function crearRegistrarPagoInput(overrides?: Partial<RegistrarPagoInput>): RegistrarPagoInput {
  return {
    factura_id: "factura-uuid-1",
    monto: 95000,
    fecha_pago: "2026-03-06",
    metodo_pago: "transferencia",
    referencia: "REF-001",
    ...overrides,
  };
}

export function crearPagoMock(overrides?: Partial<PagoDB>): PagoDB {
  return {
    id: "pago-uuid-1",
    factura_id: "factura-uuid-1",
    user_id: "user-test-123",
    monto: 95000,
    fecha_pago: "2026-03-06",
    metodo_pago: "transferencia",
    referencia: "REF-001",
    notas: null,
    created_at: "2026-03-06T10:00:00.000Z",
    updated_at: "2026-03-06T10:00:00.000Z",
    ...overrides,
  };
}

// =====================================================================
// SABANA / FILA NORMALIZADA
// =====================================================================

export function crearFilaNormalizada(overrides?: Partial<FilaNormalizada>): FilaNormalizada {
  return {
    num_factura: "FV-006",
    valor_facturado: 95000,
    valor_pagado: 95000,
    valor_glosado: null,
    fecha_pago: "2026-03-01",
    referencia_pago: "PAG-001",
    documento_paciente: "1234567890",
    nombre_paciente: "Juan Pérez",
    observacion: null,
    fila_original: 1,
    ...overrides,
  };
}

export function crearFilaSabana(overrides?: Partial<FilaSabana>): FilaSabana {
  return {
    "Nro Factura": "FV-006",
    "Valor Facturado": 95000,
    "Valor Pagado": 95000,
    "Fecha Pago": "2026-03-01",
    ...overrides,
  };
}

// =====================================================================
// PACIENTE
// =====================================================================

export function crearPacienteMock(overrides?: Record<string, unknown>) {
  return {
    id: "paciente-uuid-1",
    user_id: "user-test-123",
    tipo_documento: "CC",
    numero_documento: "1234567890",
    primer_nombre: "Juan",
    segundo_nombre: "Carlos",
    primer_apellido: "Pérez",
    segundo_apellido: "García",
    fecha_nacimiento: "1990-05-15",
    sexo: "M",
    tipo_usuario: "01",
    eps_codigo: "EPS001",
    eps_nombre: "EPS SURA",
    municipio_residencia_codigo: "11001",
    zona_territorial: "U",
    ...overrides,
  };
}
