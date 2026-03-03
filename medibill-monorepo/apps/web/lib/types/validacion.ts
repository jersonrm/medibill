/**
 * Tipos TypeScript para validación médica — Medibill
 *
 * Interfaces para diagnósticos, procedimientos y servicios
 * usados en lib/validacion-medica.ts y actions/clasificacion.ts
 */

// ==========================================
// INTERFACES DE ENTRADA (desde la IA)
// ==========================================

export interface DiagnosticoIA {
  codigo: string;
  descripcion: string;
  tipo: 'principal' | 'relacionado';
  sexo_aplica?: 'M' | 'F' | 'ambos';
  /** Código CIE-10 asignado por la IA o validación */
  codigo_cie10?: string;
  /** Rol del diagnóstico: principal, relacionado, causa_externa */
  rol?: string;
  /** Indica si el CIE-10 fue validado contra la DB */
  cie10_validado?: boolean;
  /** Indica si el código fue corregido durante validación */
  cie10_corregido?: boolean;
  /** Alternativas encontradas en la DB */
  alternativas?: { codigo: string; descripcion: string }[];
}

export interface ProcedimientoIA {
  codigo_cups: string;
  descripcion: string;
  cantidad: number;
  valor_unitario?: number;
  valor_total?: number;
  ambito?: string;
  finalidad?: string;
  zona_anatomica?: string;
  /** Descripción original generada por la IA antes de validación */
  descripcion_ia_original?: string;
  /** Diagnóstico CIE-10 asociado al procedimiento */
  diagnostico_asociado?: string;
  /** Indica si el diagnóstico asociado fue corregido */
  diagnostico_asociado_corregido?: boolean;
  /** Indica si el CUPS fue validado contra la DB */
  cups_validado?: boolean;
  /** Indica si el código fue corregido durante validación */
  cups_corregido?: boolean;
  /** Indica si fue corregido por incoherencia anatómica */
  cups_corregido_anatomia?: boolean;
  /** Alternativas encontradas en la DB */
  alternativas?: { codigo: string; descripcion: string }[];
  /** Tarifa personalizada del médico */
  valor_procedimiento?: number;
}

export interface ServicioFactura {
  cups_codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  fecha_prestacion: string;
  diagnostico_principal: string;
  tipo_servicio: 'consulta' | 'apoyo_dx' | 'procedimiento_qx' | 'procedimiento_no_qx' | 'medicamento' | 'dispositivo' | 'estancia' | 'urgencia' | 'traslado' | 'terapia';
  numero_autorizacion?: string | null;
}
