/**
 * Tipos para la API FEV-RIPS Docker v4.3 (MinSalud)
 *
 * Basado en: FEVRM001 v2.0 — Noviembre 2025
 * Endpoints: LoginSISPRO, CargarFevRips, ConsultarCUV, etc.
 */

import type { FevRips } from "./rips";

// =====================================================================
// LOGIN
// =====================================================================

/** Tipo de usuario para LoginSISPRO */
export type TipoUsuarioSISPRO = "RE" | "PIN" | "PINx" | "PIE";

export interface LoginSISPRORequest {
  persona: {
    identificacion: {
      tipo: string; // "CC", "CE", etc.
      numero: string;
    };
  };
  clave: string;
  nit: string;
  tipoUsuario?: TipoUsuarioSISPRO;
}

export interface LoginSISPROResponse {
  token: string;
  login: boolean;
  registrado: boolean;
  errors: string | null;
}

// =====================================================================
// CARGA DE DOCUMENTOS
// =====================================================================

/** Body para todos los endpoints de carga (CargarFevRips, CargarNC, etc.) */
export interface CargarDocumentoRequest {
  /** JSON RIPS conforme a Res. 2275/2023, o null para ciertos endpoints */
  rips: FevRips | null;
  /** AttachedDocument UBL 2.1 codificado en Base64, o vacío ("") */
  xmlFevFile: string;
}

// =====================================================================
// RESPONSE ESTÁNDAR (sección 8 del manual)
// =====================================================================

/** Resultado individual de validación */
export interface ResultadoValidacion {
  /** "RECHAZADO" o "NOTIFICACION" */
  Clase: "RECHAZADO" | "NOTIFICACION";
  /** Código de la regla de validación (ej: "RVC017", "RHNM", "FVAL6") */
  Codigo: string;
  /** Descripción de la regla */
  Descripcion: string;
  /** Mensaje detallado */
  Observaciones: string;
  /** JSONPath donde está la incidencia (ej: "usuarios[0].servicios.consultas[0].codConsulta") */
  PathFuente: string;
  /** Fuente: "Rips", "FacturaElectronica", "NotaCredito", etc. */
  Fuente: string;
}

/** Response estándar de todos los métodos de transmisión */
export interface FevRipsApiResponse {
  /** true = validación exitosa, false = RECHAZADO */
  ResultState: boolean;
  /** Consecutivo de envíos del PSS/PTS */
  ProcesoId: number;
  /** Número factura enviado en RIPS campo numFactura */
  NumFactura: string;
  /** CUV (96 hex chars) si ResultState=true, o mensaje de rechazo si false */
  CodigoUnicoValidacion: string;
  /** Fecha validación del MUV (ISO 8601 con timezone) */
  FechaRadicacion: string;
  /** Siempre null en la solución API RESTful */
  RutaArchivos: string | null;
  /** Ambiente: DockerTest / DockerStage / DockerProd */
  Ambiente: string;
  /** Módulo del documento procesado */
  Modulo: FevRipsModulo;
  /** Modalidad de pago informada en XML */
  ModalidadPago: string;
  /** Período de atención del XML */
  PeriodoAtencion: {
    FechaInicio: string | null;
    FechaFin: string | null;
  };
  /** Resultados de validación (errores y notificaciones) */
  ResultadosValidacion: ResultadoValidacion[];
}

/** Módulos de documento */
export type FevRipsModulo =
  | "FacturaElectronica"
  | "NotaCredito"
  | "NotaCreditoTotal"
  | "NotaDebito"
  | "NotaAjuste"
  | "RipsSinFactura"
  | "CapitaInicial"
  | "CapitaPeriodo"
  | "CapitaFinal"
  | "NotaCreditoAcuerdoVoluntades"
  | "NCCapita";

// =====================================================================
// CONSULTAR CUV
// =====================================================================

export interface ConsultarCUVRequest {
  codigoUnicoValidacion: string;
}

export interface ConsultarCUVResponse {
  ProcesoId: number;
  EsValido: boolean;
  CodigoUnicoValidacion: string;
  FechaValidacion: string;
  TipoDocumento: string;
  NumDocumentoIdObligado: string;
  NumeroDocumento: string;
  FechaEmision: string;
  TotalFactura: number;
  CantidadUsuarios: number;
  CantidadAtenciones: number;
  TotalValorServicios: number;
  IdentificacionAdquiriente: string;
  CodigoPrestador: string;
  ModalidadPago: string;
  NumDocumentoReferenciado: string | null;
  UrlJson: string | null;
  UrlXml: string | null;
  JsonFile: string | null;
  XmlFileBase64: string | null;
  ResultadosValidacion: ResultadoValidacion[];
  CantidadTotalAtenciones: {
    Consultas: number;
    Procedimientos: number;
    Medicamentos: number;
    OtrosServicios: number;
    RecienNacidos: number;
    Hospitalizaciones: number;
    Urgencias: number;
  };
}

// =====================================================================
// RECUPERAR CUV
// =====================================================================

export interface RecuperarCUVRequest {
  codigoUnicoValidacion: string;
}

// =====================================================================
// AMBIENTES
// =====================================================================

export type AmbienteFevRips = "DockerTest" | "DockerStage" | "DockerProd";
