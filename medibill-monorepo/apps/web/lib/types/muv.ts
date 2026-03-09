/**
 * Tipos para la integración con MUV (Mecanismo Único de Validación) — MinSalud
 *
 * El MUV recibe:
 *   1. XML de la FEV ya validada por DIAN (con CUFE)
 *   2. JSON RIPS (Resolución 2275 de 2023)
 *
 * Retorna: CUV (Código Único de Validación) o errores de validación.
 */

import type { FevRips } from "./rips";

// =====================================================================
// ESTADOS MUV
// =====================================================================

/** Estados de la factura ante el MUV (MinSalud) */
export type EstadoMuv =
  | "pendiente"
  | "validando"
  | "validado"
  | "rechazado";

// =====================================================================
// REQUEST / RESPONSE
// =====================================================================

/** Paquete que se envía al Docker MUV para validación */
export interface MuvValidationRequest {
  /** XML de la FEV firmada y validada por DIAN (string completo) */
  xml: string;
  /** JSON RIPS conforme a Resolución 2275 */
  ripsJson: FevRips;
  /** Credenciales del prestador para autenticación ante MinSalud (Cloud Run) */
  credenciales?: MuvCredencialesRequest;
}

/** Credenciales enviadas al servicio MUV en cada request */
export interface MuvCredencialesRequest {
  tipoUsuario: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  contrasena: string;
  nitPrestador: string;
}

/** Error individual retornado por el MUV */
export interface MuvError {
  /** Código del error MUV (ej. "RIPS-001", "FEV-010") */
  codigo: string;
  /** Descripción legible del error */
  mensaje: string;
  /** Campo o sección que originó el error */
  campo?: string;
  /** Severidad del hallazgo */
  severidad: "error" | "warning";
}

/** Respuesta del Docker MUV tras la validación */
export interface MuvValidationResponse {
  /** true si la validación fue exitosa y se generó CUV */
  valido: boolean;
  /** Código Único de Validación (solo si valido === true) */
  cuv: string | null;
  /** Lista de errores/advertencias encontrados */
  errores: MuvError[];
  /** Fecha/hora de la validación (ISO 8601) */
  fechaValidacion?: string;
}

// =====================================================================
// CREDENCIALES MUV (portal MinSalud)
// =====================================================================

/** Credenciales almacenadas del portal MUV (sin contraseña en claro) */
export interface CredencialesMuv {
  id: string;
  user_id: string;
  organizacion_id: string | null;
  tipo_usuario: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  nit_prestador: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Input del formulario para guardar credenciales MUV */
export interface CredencialesMuvInput {
  tipo_usuario: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  contrasena: string;
  nit_prestador: string;
}
