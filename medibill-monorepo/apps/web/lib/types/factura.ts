/**
 * Tipos TypeScript para Facturas formales del MVP v1.0
 * Extiende los tipos existentes de FacturaDB en glosas.ts
 */

import type { DiagnosticoUI, ProcedimientoUI, AtencionUI } from "./ui";
import type { EstadoMuv } from "./muv";

// =====================================================================
// ESTADOS MVP v1.0
// =====================================================================

/** Estados de factura en el MVP v1.0 */
export type EstadoFacturaMVP =
  | "borrador"
  | "aprobada"
  | "descargada"
  | "radicada"
  | "pagada_parcial"
  | "pagada"
  | "anulada";

/** Estados de la factura ante la DIAN (vía Matias API) */
export type EstadoDian =
  | "pendiente"
  | "enviada"
  | "aceptada"
  | "rechazada";

// Re-export EstadoMuv for convenience
export type { EstadoMuv } from "./muv";

// =====================================================================
// FACTURA COMPLETA
// =====================================================================

/** Diagnóstico persistido en la factura (con flag manual) */
export interface DiagnosticoFactura extends DiagnosticoUI {
  manual?: boolean;
}

/** Procedimiento persistido en la factura (con tarifa y fuente) */
export interface ProcedimientoFactura extends ProcedimientoUI {
  manual?: boolean;
  valor_unitario: number;
  fuente_tarifa: "pactada" | "propia" | "manual";
}

/** Factura completa tal como se persiste en Supabase */
export interface FacturaCompleta {
  id: string;
  user_id: string;
  num_factura: string;
  num_fev: string | null;
  nit_prestador: string;
  nit_erp: string;
  fecha_expedicion: string;
  fecha_radicacion: string | null;
  valor_total: number;
  subtotal: number;
  descuentos: number;
  copago: number;
  cuota_moderadora: number;
  estado: EstadoFacturaMVP;
  // Relaciones
  paciente_id: string | null;
  resolucion_id: string | null;
  // Datos clínicos
  diagnosticos: DiagnosticoFactura[];
  procedimientos: ProcedimientoFactura[];
  atencion: AtencionUI;
  nota_clinica_original: string | null;
  // Snapshots
  perfil_prestador_snapshot: Record<string, unknown> | null;
  fev_rips_json: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Campos DIAN (Matias API)
  cufe: string | null;
  estado_dian: EstadoDian | null;
  track_id_dian: string | null;
  fecha_envio_dian: string | null;
  respuesta_dian_json: Record<string, unknown> | null;
  // Campos MUV (MinSalud)
  cuv: string | null;
  estado_muv: EstadoMuv | null;
  fecha_envio_muv: string | null;
  respuesta_muv_json: Record<string, unknown> | null;
}

/** Datos para crear una factura borrador */
export interface CrearFacturaInput {
  nit_erp: string;
  eps_nombre: string;
  paciente_tipo_documento: string;
  paciente_numero_documento: string;
  paciente_nombre: string;
  diagnosticos: DiagnosticoFactura[];
  procedimientos: ProcedimientoFactura[];
  atencion: AtencionUI;
  nota_clinica_original: string;
  subtotal: number;
  copago: number;
  cuota_moderadora: number;
  descuentos: number;
  valor_total: number;
  // Datos de paciente para upsert
  datos_paciente: {
    tipo_documento: string;
    numero_documento: string;
    primer_nombre: string;
    segundo_nombre?: string;
    primer_apellido: string;
    segundo_apellido?: string;
    fecha_nacimiento?: string;
    sexo?: string;
    tipo_usuario?: string;
    eps_codigo?: string;
    eps_nombre?: string;
    municipio_residencia_codigo?: string;
    zona_territorial?: string;
    pais_origen?: string;
    incapacidad?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  };
}

/** Factura con datos del paciente para la lista */
export interface FacturaConPaciente extends FacturaCompleta {
  paciente_nombre?: string;
  paciente_documento?: string;
  eps_nombre?: string;
}
