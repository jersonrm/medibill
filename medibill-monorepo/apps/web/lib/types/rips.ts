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

/** Tipos de usuario / régimen */
export type TipoUsuario = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

/** Sexo biológico */
export type CodSexo = "M" | "F" | "I";

/** Zona territorial */
export type ZonaTerritorial = "U" | "R";

/** Incapacidad */
export type Incapacidad = "SI" | "NO";

/** Modalidad de grupo de servicio / tecnología en salud */
export type ModalidadGrupoServicio = "01" | "02" | "03" | "04" | "05" | "06" | "07";

/** Finalidad tecnología en salud */
export type FinalidadTecnologia = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15";

/** Causa / motivo de atención */
export type CausaMotivoAtencion = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "15";

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
  tipoDocumentoIdentificacion: TipoDocumento;
  numDocumentoIdentificacion: string;
  tipoUsuario: TipoUsuario;
  fechaNacimiento: string; // YYYY-MM-DD
  codSexo: CodSexo;
  codPaisResidencia: string; // ISO 3166-1 numérico (170 = Colombia)
  codMunicipioResidencia: string; // DIVIPOLA (ej: "52001" para Pasto)
  codZonaTerritorialResidencia: ZonaTerritorial;
  incapacidad: Incapacidad;
  consecutivo: number;
}

// ==========================================
// NODO: CONSULTAS (CT)
// ==========================================
export interface ConsultaRips {
  codPrestador: string; // Código de habilitación
  fechaInicioAtencion: string; // YYYY-MM-DD HH:MM
  numAutorizacion: string | null;
  codigoConsulta: string; // CUPS de consulta (ej: 890201)
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
  codigoProcedimiento: string; // CUPS
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
  codigoConsulta: string; // CUPS de consulta
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
  codigoMedicamento: string; // Código CUM o ATC
  tipoMedicamento: "01" | "02"; // 01=Pos, 02=No Pos
  nombreGenerico: string;
  formaFarmaceutica: string;
  concentracion: string;
  unidadMedida: string;
  cantidadDispensada: number;
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
export interface ServiciosRips {
  consultas: ConsultaRips[];
  procedimientos: ProcedimientoRips[];
  urgencias: UrgenciaRips[];
  hospitalizacion: any[]; // Vacío si no aplica
  recienNacidos: any[]; // Vacío si no aplica
  medicamentos: MedicamentoRips[]; // Resolución 2275 — sección AM
  otrosServicios: any[]; // Vacío si no aplica
}

// ==========================================
// NODO RAÍZ: FEV-RIPS (Factura Electrónica de Validación)
// ==========================================
export interface FevRips {
  numDocumentoIdObligado: string; // NIT del obligado a reportar (prestador o EPS)
  numFactura: string; // Número de factura electrónica
  tipoNota: string | null; // null si no es nota crédito/débito
  numNota: string | null; // null si no es nota
  usuarios: UsuarioRips[];
  servicios: ServiciosRips;
}

// ==========================================
// INTERFACE PARA LOS DATOS DE ENTRADA (del formulario al servidor)
// ==========================================
export interface DatosParaRips {
  // Datos del paciente
  tipoDocumentoPaciente: TipoDocumento;
  documentoPaciente: string;
  fechaNacimientoPaciente: string;
  sexoPaciente: CodSexo;
  tipoUsuarioPaciente: TipoUsuario;
  codPaisResidencia: string;
  codMunicipioResidencia: string;
  codZonaTerritorialResidencia: ZonaTerritorial;
  incapacidad: Incapacidad;

  // Datos clínicos de la IA (ya validados contra DB)
  diagnosticos: DiagnosticoIA[];
  procedimientos: ProcedimientoIA[];

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
  };
}
