import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

/**
 * Tipos TypeScript para FEV-RIPS (Resolución 2275 de 2023)
 * Estructura oficial del JSON de Facturación Electrónica de Validación
 * 
 * Fuente: Anexo Técnico Resolución 2275 de 2023 - MinSalud Colombia
 */

// ==========================================
// ENUMS DE DOMINIO (Resolución 2275)
// ==========================================

/** Tipos de documento válidos */
export type TipoDocumento = "CC" | "TI" | "RC" | "CE" | "PA" | "MS" | "AS" | "CD" | "SC" | "PE" | "PT" | "CN" | "DE" | "SI" | "NI";

/** Tipos de usuario / régimen (ampliado FEV-RIPS API v4.3) */
export type TipoUsuario = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12";

/** Sexo biológico */
export type CodSexo = "M" | "F" | "I";

/** Zona territorial (FEV-RIPS API v4.3: "01"=urbana, "02"=rural) */
export type ZonaTerritorial = "01" | "02";

/** Incapacidad */
export type Incapacidad = "SI" | "NO";

/** Modalidad de grupo de servicio / tecnología en salud (FEV-RIPS API v4.3) */
export type ModalidadGrupoServicio = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09";

/** Finalidad tecnología en salud (FEV-RIPS API v4.3) */
export type FinalidadTecnologia = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "44";

/** Causa / motivo de atención (FEV-RIPS API v4.3) */
export type CausaMotivoAtencion = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30" | "31" | "32" | "33" | "34" | "35" | "36" | "37" | "38";

/** Tipo de diagnóstico principal */
export type TipoDiagnosticoPrincipal = "01" | "02" | "03";

/** Concepto de recaudo */
export type ConceptoRecaudo = "01" | "02" | "03" | "04" | "05";

/** Vía de ingreso al servicio de salud */
export type ViaIngresoServicioSalud = "01" | "02";

// ==========================================
// NODO: USUARIOS (US)
// ==========================================
export interface UsuarioRips {
  consecutivo: number;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  tipoUsuario: TipoUsuario;
  fechaNacimiento: string; // YYYY-MM-DD
  codSexo: CodSexo;
  codPaisResidencia: string; // ISO 3166-1 numérico (170 = Colombia)
  codMunicipioResidencia: string; // DIVIPOLA (ej: "52001" para Pasto)
  codZonaTerritorialResidencia: ZonaTerritorial;
  incapacidad: Incapacidad;
  codPaisOrigen: string; // ISO 3166-1 numérico (170 = Colombia) — requerido por FEV-RIPS API v4.3
  servicios: ServiciosRips; // Res. 2275: servicios anidados dentro de cada usuario
}

// ==========================================
// NODO: CONSULTAS (CT)
// ==========================================
export interface ConsultaRips {
  codPrestador: string; // Código de habilitación
  fechaInicioAtencion: string; // YYYY-MM-DD HH:MM
  numAutorizacion: string | null;
  codConsulta: string; // CUPS de consulta (ej: 890201)
  modalidadGrupoServicioTecSal: ModalidadGrupoServicio;
  grupoServicios: string;
  codServicio: number;
  finalidadTecnologiaSalud: FinalidadTecnologia;
  causaMotivoAtencion: CausaMotivoAtencion;
  codDiagnosticoPrincipal: string; // CIE-10
  codDiagnosticoRelacionado1: string | null;
  codDiagnosticoRelacionado2: string | null;
  codDiagnosticoRelacionado3: string | null;
  tipoDiagnosticoPrincipal: TipoDiagnosticoPrincipal;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: PROCEDIMIENTOS (AF)
// ==========================================
export interface ProcedimientoRips {
  codPrestador: string;
  fechaInicioAtencion: string;
  idMIPRES: string | null;
  numAutorizacion: string | null;
  codProcedimiento: string; // CUPS
  viaIngresoServicioSalud: ViaIngresoServicioSalud;
  modalidadGrupoServicioTecSal: ModalidadGrupoServicio;
  grupoServicios: string;
  codServicio: number;
  finalidadTecnologiaSalud: FinalidadTecnologia;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  codDiagnosticoPrincipal: string;
  codDiagnosticoRelacionado: string | null;
  codComplicacion: string | null;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: URGENCIAS (AU) — Resolución 2275
// ==========================================
export interface UrgenciaRips {
  codPrestador: string;
  fechaInicioAtencion: string; // YYYY-MM-DD HH:MM
  numAutorizacion: string | null;
  codDiagnosticoPrincipal: string; // CIE-10
  codDiagnosticoRelacionado1: string | null;
  codDiagnosticoRelacionado2: string | null;
  codDiagnosticoRelacionado3: string | null;
  codDiagnosticoCausaMuerte: string | null;
  condicionDestinoUsuarioEgreso: "01" | "02" | "03" | "04" | "05" | "06";
  tipoDiagnosticoPrincipal: TipoDiagnosticoPrincipal; // Res. 2275 — aplica también en AU
  fechaEgreso: string; // YYYY-MM-DD HH:MM
  codConsulta: string; // CUPS de consulta
  modalidadGrupoServicioTecSal: ModalidadGrupoServicio;
  grupoServicios: string;
  codServicio: number;
  causaMotivoAtencion: CausaMotivoAtencion;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: MEDICAMENTOS (AM) — Resolución 2275
// ==========================================
export interface MedicamentoRips {
  codPrestador: string;
  numAutorizacion: string | null;
  idMIPRES: string | null;
  fechaDispensAdmon: string; // YYYY-MM-DD HH:MM
  codDiagnosticoPrincipal: string; // CIE-10 — requerido por FEV-RIPS API v4.3
  codDiagnosticoRelacionado: string | null;
  tipoMedicamento: "01" | "02"; // 01=medicamento, 02=insumo
  codTecnologiaSalud: string; // Código IUM/CUM
  nomTecnologiaSalud: string | null;
  concentracionMedicamento: number;
  unidadMedida: number; // código numérico (ej: 176)
  formaFarmaceutica: string | null;
  unidadMinDispensa: number;
  cantidadMedicamento: number;
  diasTratamiento: number;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  vrUnitMedicamento: number;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: SERVICIOS (agrupa todas las secciones)
// ==========================================
// ==========================================
// NODO: OTROS SERVICIOS (AT) — Resolución 2275
// ==========================================
export interface OtroServicioRips {
  codPrestador: string;
  numAutorizacion: string | null;
  idMIPRES: string | null;
  fechaSuministroTecnologia: string; // YYYY-MM-DD HH:mm
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  nomTecnologiaSalud: string; // Nombre del material/insumo/dispositivo
  codTecnologiaSalud: string; // Código unificado (CUM, INVIMA, etc.)
  cantidad: number;
  vrUnitTecnologia: number;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: HOSPITALIZACIÓN (AH) — Resolución 2275 (stub tipado para futuro)
// ==========================================
export interface HospitalizacionRips {
  codPrestador: string;
  viaIngresoServicioSalud: ViaIngresoServicioSalud;
  fechaInicioAtencion: string; // YYYY-MM-DD HH:mm
  numAutorizacion: string | null;
  causaMotivoAtencion: CausaMotivoAtencion;
  codDiagnosticoPrincipal: string;
  codDiagnosticoRelacionado1: string | null;
  codDiagnosticoRelacionado2: string | null;
  codDiagnosticoRelacionado3: string | null;
  codComplicacion: string | null;
  codDiagnosticoCausaMuerte: string | null;
  condicionDestinoUsuarioEgreso: "01" | "02" | "03" | "04" | "05" | "06";
  fechaEgreso: string; // YYYY-MM-DD HH:mm
  codDiagnosticoMuerte: string | null;
  modalidadGrupoServicioTecSal: ModalidadGrupoServicio;
  grupoServicios: string;
  codServicio: number;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  vrServicio: number;
  conceptoRecaudo: ConceptoRecaudo;
  valorPagoModerador: number;
  numFEVPagoModerador: string | null;
  consecutivo: number;
}

// ==========================================
// NODO: RECIÉN NACIDOS (AN) — Resolución 2275 (stub tipado para futuro)
// ==========================================
export interface RecienNacidoRips {
  codPrestador: string;
  fechaNacimiento: string; // YYYY-MM-DD HH:mm
  edadGestacional: number;
  numConsultasCPN: number;
  codSexo: CodSexo;
  peso: number;
  codDiagnosticoPrincipal: string;
  codDiagnosticoRelacionado1: string | null;
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  condicionDestinoUsuarioEgreso: "01" | "02" | "03" | "04" | "05" | "06";
  codDiagnosticoCausaMuerte: string | null;
  fechaEgreso: string; // YYYY-MM-DD HH:mm
  consecutivo: number;
}

// ==========================================
// NODO: SERVICIOS (agrupa todas las secciones)
// ==========================================
export interface ServiciosRips {
  consultas: ConsultaRips[];
  procedimientos: ProcedimientoRips[];
  urgencias: UrgenciaRips[];
  hospitalizacion: HospitalizacionRips[];
  recienNacidos: RecienNacidoRips[];
  medicamentos: MedicamentoRips[];
  otrosServicios: OtroServicioRips[];
}

// ==========================================
// NODO RAÍZ: FEV-RIPS (Factura Electrónica de Validación)
// ==========================================
export interface FevRips {
  numDocumentoIdObligado: string; // NIT del obligado a reportar (prestador o EPS)
  numFactura: string; // Número de factura electrónica
  numObligacion: string; // Número de la obligación (contrato/póliza)
  tipoNota: string | null; // null si no es nota crédito/débito
  numNota: string | null; // null si no es nota
  usuarios: UsuarioRips[];
}

// ==========================================
// INTERFACE PARA LOS DATOS DE ENTRADA (del formulario al servidor)
// ==========================================
// ==========================================
// INTERFACES DE ENTRADA PARA MEDICAMENTOS Y MATERIALES
// ==========================================

/** Input de medicamento desde el formulario (UI → RIPS) */
export interface MedicamentoInput {
  codTecnologiaSalud: string; // Código IUM/CUM
  tipoMedicamento: "01" | "02"; // 01=medicamento, 02=insumo
  nomTecnologiaSalud: string | null;
  formaFarmaceutica: string | null;
  concentracionMedicamento: number;
  unidadMedida: number; // código numérico
  unidadMinDispensa: number;
  cantidadMedicamento: number;
  diasTratamiento: number;
  vrUnitMedicamento: number;
  codDiagnosticoPrincipal?: string;
  codDiagnosticoRelacionado?: string | null;
  numAutorizacion?: string;
  idMIPRES?: string;
}

/** Input de material/insumo/dispositivo desde el formulario (UI → RIPS) */
export interface OtroServicioInput {
  codTecnologiaSalud: string;
  nomTecnologiaSalud: string;
  cantidad: number;
  vrUnitTecnologia: number;
  numAutorizacion?: string;
  idMIPRES?: string;
}

// ==========================================
// INTERFACE PARA LOS DATOS DE ENTRADA (del formulario al servidor)
// ==========================================
export interface DatosParaRips {
  // Datos de la factura
  numFactura: string; // Número real de factura (prefijo+consecutivo DIAN)
  numObligacion?: string; // Número del contrato/póliza con la EPS

  // Datos del paciente
  tipoDocumentoPaciente: TipoDocumento;
  documentoPaciente: string;
  fechaNacimientoPaciente: string;
  sexoPaciente: CodSexo;
  tipoUsuarioPaciente: TipoUsuario;
  codPaisResidencia: string;
  codPaisOrigen: string; // ISO 3166-1 numérico (170 = Colombia)
  codMunicipioResidencia: string;
  codZonaTerritorialResidencia: ZonaTerritorial;
  incapacidad: Incapacidad;

  // Datos del profesional que atiende (Res. 2275: numDocumentoIdentificacion en servicios = profesional)
  tipoDocumentoProfesional: TipoDocumento;
  documentoProfesional: string;

  // Datos clínicos de la IA (ya validados contra DB)
  diagnosticos: DiagnosticoIA[];
  procedimientos: ProcedimientoIA[];

  // Medicamentos y materiales (input manual)
  medicamentos?: MedicamentoInput[];
  otrosServicios?: OtroServicioInput[];

  // Liquidación sugerida por la IA y editada por el médico
  atencionIA: {
    modalidad: string;
    causa: string;
    finalidad: string;
    tipo_diagnostico: string;
    tipo_servicio: string;
    valor_consulta: number;
    valor_cuota: number;
    condicion_egreso?: string;
    codConsultaCups?: string; // CUPS de consulta (890201 general, 890301 pediatría, 890381 ortopedia, etc.)
    numAutorizacion?: string; // Autorización de la consulta o urgencia
  };
}
