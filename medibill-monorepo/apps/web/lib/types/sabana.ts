/**
 * Tipos TypeScript para importación de sábanas EPS y conciliación de pagos
 */

// =====================================================================
// CAMPOS ESTÁNDAR DE UNA SÁBANA DE PAGOS EPS
// =====================================================================

/** Campos estándar a los que se mapean las columnas de la sábana */
export type CampoEstandar =
  | "num_factura"
  | "valor_facturado"
  | "valor_pagado"
  | "valor_glosado"
  | "fecha_pago"
  | "referencia_pago"
  | "documento_paciente"
  | "nombre_paciente"
  | "observacion";

/** Labels humanos para cada campo estándar */
export const CAMPOS_ESTANDAR_LABELS: Record<CampoEstandar, string> = {
  num_factura: "Número de factura",
  valor_facturado: "Valor facturado",
  valor_pagado: "Valor pagado",
  valor_glosado: "Valor glosado",
  fecha_pago: "Fecha de pago",
  referencia_pago: "Referencia de pago",
  documento_paciente: "Documento del paciente",
  nombre_paciente: "Nombre del paciente",
  observacion: "Observación / Notas",
};

/** Campos obligatorios para poder conciliar */
export const CAMPOS_OBLIGATORIOS: CampoEstandar[] = [
  "num_factura",
  "valor_pagado",
];

// =====================================================================
// MAPEO DE COLUMNAS
// =====================================================================

/** Mapeo: campo estándar → nombre de columna en el archivo original */
export type MapeoColumnas = Partial<Record<CampoEstandar, string>>;

/** Resultado del mapeo automático con IA */
export interface ResultadoMapeoIA {
  mapeo: MapeoColumnas;
  columnas_no_mapeadas: string[];
  confianza: number;
}

// =====================================================================
// FILAS DE DATOS
// =====================================================================

/** Fila cruda del Excel/CSV (antes de mapeo) */
export type FilaSabana = Record<string, string | number | null>;

/** Fila normalizada después de aplicar el mapeo */
export interface FilaNormalizada {
  num_factura: string;
  valor_facturado: number | null;
  valor_pagado: number;
  valor_glosado: number | null;
  fecha_pago: string | null;
  referencia_pago: string | null;
  documento_paciente: string | null;
  nombre_paciente: string | null;
  observacion: string | null;
  /** Índice de la fila original (para referencia) */
  fila_original: number;
}

// =====================================================================
// CONCILIACIÓN
// =====================================================================

/** Tipo de resultado de conciliación para una fila */
export type TipoConciliacion =
  | "pago_total"
  | "pago_parcial"
  | "con_glosa"
  | "sin_match_factura"
  | "ya_pagada"
  | "excede_saldo";

/** Item de conciliación: una fila de la sábana cruzada con factura en BD */
export interface ItemConciliacion {
  fila: FilaNormalizada;
  factura: {
    id: string;
    num_factura: string;
    valor_total: number;
    estado: string;
    saldo_pendiente: number;
    eps_nombre: string;
    paciente_nombre: string;
  } | null;
  tipo: TipoConciliacion;
  seleccionado: boolean;
  advertencia?: string;
}

/** Resumen de la conciliación */
export interface ResumenConciliacion {
  total_filas: number;
  conciliadas: number;
  sin_match: number;
  ya_pagadas: number;
  monto_a_registrar: number;
  monto_glosado: number;
}

/** Resultado completo de la conciliación */
export interface ResultadoConciliacion {
  items: ItemConciliacion[];
  resumen: ResumenConciliacion;
}

// =====================================================================
// RESULTADO DEL PARSEO
// =====================================================================

/** Resultado del parseo de un archivo de sábana */
export interface ResultadoParseo {
  headers: string[];
  filas: FilaSabana[];
  hoja: string;
  total_filas_original: number;
}

// =====================================================================
// INPUT PARA CONFIRMAR CONCILIACIÓN
// =====================================================================

/** Item individual para confirmar un pago de la conciliación */
export interface ItemConfirmacion {
  factura_id: string;
  monto: number;
  fecha_pago: string;
  referencia?: string;
  notas?: string;
}

/** Metadata de la importación */
export interface MetaImportacion {
  nit_eps: string;
  eps_nombre: string;
  nombre_archivo: string;
  mapeo_usado_id?: string;
}

// =====================================================================
// BASE DE DATOS
// =====================================================================

/** Mapeo de sábana por EPS guardado en BD */
export interface MapeoSabanaEpsDB {
  id: string;
  user_id: string;
  nit_eps: string;
  eps_nombre: string;
  headers_hash: string;
  mapeo_json: MapeoColumnas;
  confianza: number;
  veces_usado: number;
  created_at: string;
  updated_at: string;
}

/** Importación de sábana guardada en BD */
export interface ImportacionSabanaDB {
  id: string;
  user_id: string;
  nit_eps: string;
  eps_nombre: string;
  nombre_archivo: string;
  total_filas: number;
  filas_conciliadas: number;
  filas_sin_match: number;
  monto_total_importado: number;
  monto_total_glosado: number;
  estado: "pendiente" | "confirmada" | "cancelada";
  mapeo_usado_id: string | null;
  resumen_json: Record<string, unknown> | null;
  created_at: string;
}
