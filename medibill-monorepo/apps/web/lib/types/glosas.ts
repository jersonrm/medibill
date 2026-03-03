/**
 * Tipos TypeScript para el módulo de Glosas y Devoluciones — Medibill
 *
 * Alineados con:
 *  - Resolución 2284 de 2023, Anexo Técnico No. 3
 *  - Circular Conjunta 007 de 2025 (MinSalud + SuperSalud)
 *  - Esquema SQL schema-glosas.sql
 */

// =====================================================================
// ENUMS DE DOMINIO
// =====================================================================

/** Tipo de hallazgo de la EPS */
export type TipoHallazgo = "devolucion" | "glosa";

/** Concepto general de glosa (Res. 2284/2023) */
export type ConceptoGlosa = "FA" | "TA" | "SO" | "AU" | "PE" | "SC" | "DE";

/** Capa de prevención Medibill */
export type CapaMedibill = 1 | 2 | 3;

/** Estado de una factura en el ciclo de vida */
export type EstadoFactura =
  | "borrador"
  | "radicada"
  | "devuelta"
  | "glosada"
  | "respondida"
  | "conciliada"
  | "pagada";

/** Estado de una glosa individual */
export type EstadoGlosa =
  | "pendiente"
  | "en_revision"
  | "respondida"
  | "aceptada"
  | "rechazada_erp"
  | "conciliada";

/** Código de respuesta del prestador (Res. 2284/2023) */
export type CodigoRespuesta = "RS01" | "RS02" | "RS03" | "RS04" | "RS05";

/** Decisión de la ERP tras la respuesta */
export type DecisionERP = "pendiente" | "levantada" | "ratificada" | "parcial";

/** Severidad de una validación pre-radicación */
export type SeveridadValidacion = "error" | "advertencia" | "info";

/** Origen de la respuesta */
export type OrigenRespuesta = "manual" | "automatica" | "ia";

/** Tipo de plazo legal rastreado */
export type TipoPlazo =
  | "radicacion_soportes"     // 22 días hábiles desde expedición FEV
  | "devolucion_erp"          // 5 días hábiles desde radicación
  | "formulacion_glosa"       // 20 días hábiles desde radicación
  | "respuesta_prestador"     // 15 días hábiles
  | "decision_erp";           // 15 días hábiles tras respuesta

// =====================================================================
// CATÁLOGO DE CAUSALES
// =====================================================================

/** Subcausal individual del catálogo */
export interface SubcausalCatalogo {
  codigo: string;
  descripcion: string;
  prevenible: boolean;
  accion: string;
}

/** Código específico de glosa (ej: FA01) con sus subcausales */
export interface CodigoGlosaCatalogo {
  codigo: string;
  especifico: string;
  subcausales: SubcausalCatalogo[];
}

/** Concepto general en el catálogo (ej: FA = FACTURACIÓN) */
export interface ConceptoGlosaCatalogo {
  concepto_general: string;
  definicion: string;
  capa_medibill_predominante: CapaMedibill;
  codigos: CodigoGlosaCatalogo[];
  notas?: string;
}

/** Devolución del catálogo */
export interface DevolucionCatalogo {
  codigo: string;
  descripcion: string;
  afecta: "total" | "parcial";
  capa_medibill: CapaMedibill;
  prevenible: boolean;
  accion_medibill: string;
  subcausales: { codigo: string; descripcion: string }[];
  notas?: string;
}

/** Registro en la tabla `catalogo_causales_glosa` */
export interface CausalGlosaDB {
  id: string;
  tipo: TipoHallazgo;
  concepto: string;
  concepto_desc: string;
  codigo: string;
  descripcion: string;
  codigo_padre: string | null;
  afecta: "total" | "parcial" | null;
  capa_medibill: CapaMedibill;
  prevenible: boolean;
  accion_medibill: string | null;
  notas: string | null;
  created_at: string;
}

// =====================================================================
// ACUERDOS DE VOLUNTADES (Spec §1)
// =====================================================================

/** Registro en la tabla `acuerdos_voluntades` */
export interface AcuerdoVoluntadesDB {
  id: string;
  prestador_id: string;
  eps_codigo: string;
  nombre_eps: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  requiere_autorizacion: boolean;
  tarifario_base: string;
  porcentaje_sobre_base: number;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Registro en la tabla `acuerdo_tarifas` */
export interface AcuerdoTarifaDB {
  id: string;
  acuerdo_id: string;
  cups_codigo: string;
  valor_pactado: number;
  incluye_honorarios: boolean;
  incluye_materiales: boolean;
  es_paquete: boolean;
  servicios_incluidos_paquete: string[] | null;
  observaciones: string | null;
  created_at: string;
}

// =====================================================================
// REGLAS DE COHERENCIA (Spec §1)
// =====================================================================

export type TipoReglaCoherencia =
  | "sexo_diagnostico"
  | "sexo_procedimiento"
  | "edad_diagnostico"
  | "diagnostico_procedimiento";

/** Registro en la tabla `reglas_coherencia` */
export interface ReglaCoherenciaDB {
  id: string;
  tipo: TipoReglaCoherencia;
  codigo_referencia: string;
  condicion: Record<string, unknown>;
  mensaje_error: string;
  severidad: "error" | "warning";
  activo: boolean;
  created_at: string;
}

// =====================================================================
// DATOS DE FACTURA — Entrada principal del validador (Spec §2)
// =====================================================================

/** Datos del paciente para validación anti-glosa */
export interface PacienteFactura {
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: "M" | "F";
  tipo_afiliado: "C" | "S"; // contributivo / subsidiado
  categoria: "A" | "B" | "C";
}

/** Servicio individual facturado */
export interface ServicioFactura {
  cups_codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  fecha_prestacion: string;
  diagnostico_principal: string; // CIE-10
  diagnostico_relacionado?: string;
  numero_autorizacion?: string;
  tipo_servicio:
    | "consulta"
    | "procedimiento_qx"
    | "procedimiento_no_qx"
    | "apoyo_dx"
    | "medicamento"
    | "dispositivo"
    | "estancia"
    | "urgencia"
    | "traslado"
    | "terapia";
}

/** Soportes documentales disponibles */
export interface SoportesFactura {
  tiene_resumen_atencion: boolean;
  tiene_epicrisis: boolean;
  tiene_descripcion_qx: boolean;
  tiene_registro_anestesia: boolean;
  tiene_hoja_medicamentos: boolean;
  tiene_comprobante_recibido: boolean;
  tiene_hoja_traslado: boolean;
  tiene_orden_prescripcion: boolean;
  tiene_hoja_urgencias: boolean;
  tiene_hoja_odontologica: boolean;
  tiene_lista_precios: boolean;
  tiene_evidencia_envio_tramite: boolean;
}

/**
 * Interfaz de entrada para el validador anti-glosa.
 * Contiene TODA la información necesaria para ejecutar las validaciones
 * previas a la radicación.
 */
export interface DatosFactura {
  prestador_id: string;
  eps_codigo: string;
  paciente: PacienteFactura;
  servicios: ServicioFactura[];
  soportes: SoportesFactura;
  fecha_expedicion_fev: string;
  fecha_radicacion_prevista: string;
  copago_recaudado?: number;
  copago_calculado?: number;
  es_urgencia: boolean;
  tiene_contrato: boolean;
}

// =====================================================================
// FACTURA
// =====================================================================

export interface FacturaDB {
  id: string;
  user_id: string;
  num_factura: string;
  num_fev: string | null;
  nit_prestador: string;
  nit_erp: string;
  fecha_expedicion: string;
  fecha_radicacion: string | null;
  fecha_limite_rad: string | null;
  valor_total: number;
  valor_glosado: number;
  valor_aceptado: number;
  estado: EstadoFactura;
  fev_rips_json: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// GLOSA RECIBIDA
// =====================================================================

export interface GlosaDB {
  id: string;
  factura_id: string;
  codigo_causal: string;
  tipo: TipoHallazgo;
  descripcion_erp: string | null;
  valor_glosado: number;
  cups_afectado: string | null;
  cie10_afectado: string | null;
  num_autorizacion: string | null;
  fecha_servicio: string | null;
  fecha_formulacion: string;
  fecha_limite_resp: string | null;
  capa_medibill: CapaMedibill | null;
  prevenible: boolean;
  sugerencia_auto: string | null;
  estado: EstadoGlosa;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Glosa con datos enriquecidos del catálogo (para UI) */
export interface GlosaConDetalle extends GlosaDB {
  causal: CausalGlosaDB;
  factura: Pick<FacturaDB, "num_factura" | "nit_erp" | "valor_total">;
  respuestas: RespuestaGlosaDB[];
  plazo: AuditoriaPlazoUI | null;
}

// =====================================================================
// RESPUESTA A GLOSA
// =====================================================================

export interface RespuestaGlosaDB {
  id: string;
  glosa_id: string;
  codigo_respuesta: CodigoRespuesta;
  justificacion: string;
  soporte_url: string | null;
  soporte_nombre: string | null;
  fundamento_legal: string | null;
  valor_nota_credito: number;
  decision_erp: DecisionERP;
  fecha_decision_erp: string | null;
  observacion_erp: string | null;
  generada_por: OrigenRespuesta;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// VALIDACIÓN PRE-RADICACIÓN
// =====================================================================

export interface ValidacionPreRadicacionDB {
  id: string;
  factura_id: string;
  codigo_causal: string;
  severidad: SeveridadValidacion;
  mensaje: string;
  campo_afectado: string | null;
  valor_encontrado: string | null;
  valor_esperado: string | null;
  resuelta: boolean;
  resuelta_en: string | null;
  resuelta_por: string | null;
  created_at: string;
}

/** Validación enriquecida con datos del catálogo */
export interface ValidacionConDetalle extends ValidacionPreRadicacionDB {
  causal: Pick<CausalGlosaDB, "codigo" | "descripcion" | "concepto" | "capa_medibill">;
}

// =====================================================================
// AUDITORÍA DE PLAZOS
// =====================================================================

export interface AuditoriaPlazoUI {
  id: string;
  tipo_plazo: TipoPlazo;
  fecha_inicio: string;
  fecha_limite: string;
  dias_habiles_total: number;
  dias_habiles_rest: number | null;
  alerta_enviada: boolean;
  vencido: boolean;
  silencio_admin: boolean;
  consecuencia_silencio: string | null;
}

// =====================================================================
// ALERTA — Hallazgo del validador (Spec §2)
// =====================================================================

/** Categoría funcional de la alerta */
export type CategoriaAlerta =
  | "devolucion"
  | "facturacion"
  | "tarifa"
  | "soporte"
  | "autorizacion"
  | "pertinencia"
  | "seguimiento";

/**
 * Alerta individual emitida por el validador pre-radicación.
 * Incluye toda la información necesaria para que el usuario corrija el problema.
 */
export interface Alerta {
  codigo_glosa: string;          // ej: "FA0201", "SO3401", "DE5601"
  tipo: "error" | "warning" | "info";
  categoria: CategoriaAlerta;
  mensaje: string;
  detalle: string;
  como_resolver: string;
  servicio_afectado?: string;    // CUPS del servicio
  norma_legal: string;           // referencia normativa
}

// =====================================================================
// RESULTADO DEL VALIDADOR (Spec §2)
// =====================================================================

export interface ResultadoValidacion {
  factura_id: string;
  num_factura: string;
  fecha_validacion: string;
  total_hallazgos: number;
  errores: number;
  advertencias: number;
  informativos: number;
  puede_radicar: boolean;   // false si hay algún error
  hallazgos: ValidacionPreRadicacionDB[];
  /** Alertas con contexto rico (codigo, categoria, como_resolver, norma_legal) */
  alertas: Alerta[];
  /** Puntaje de riesgo de glosa: 0 = sin riesgo, 100 = muy alto riesgo */
  puntaje_riesgo_glosa: number;
  /** Códigos de glosa que esta validación previno */
  glosas_potenciales_prevenidas: string[];
}

// =====================================================================
// RESUMEN PANEL DE GLOSAS
// =====================================================================

export interface ResumenGlosas {
  total_facturas: number;
  total_glosas: number;
  valor_total_glosado: number;
  valor_aceptado: number;
  valor_recuperado: number;
  por_estado: Record<EstadoGlosa, number>;
  por_concepto: Record<string, { cantidad: number; valor: number }>;
  vencen_pronto: GlosaConDetalle[]; // glosas con <3 días hábiles
  tasa_exito: number; // % glosas levantadas / total respondidas
}

// =====================================================================
// DICCIONARIOS UI
// =====================================================================

export const LABELS_ESTADO_GLOSA: Record<EstadoGlosa, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  respondida: "Respondida",
  aceptada: "Aceptada",
  rechazada_erp: "Rechazada por ERP",
  conciliada: "Conciliada",
};

export const LABELS_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  borrador: "Borrador",
  radicada: "Radicada",
  devuelta: "Devuelta",
  glosada: "Glosada",
  respondida: "Respondida",
  conciliada: "Conciliada",
  pagada: "Pagada",
};

export const LABELS_RESPUESTA: Record<CodigoRespuesta, string> = {
  RS01: "Acepta la glosa",
  RS02: "Subsana — aporta soporte",
  RS03: "Rechaza — improcedente",
  RS04: "Rechaza — extemporánea",
  RS05: "Rechaza — excepción aplica",
};

export const LABELS_CONCEPTO: Record<string, string> = {
  FA: "Facturación",
  TA: "Tarifas",
  SO: "Soportes",
  AU: "Autorización",
  PE: "Pertinencia",
  SC: "Seguimiento",
  DE: "Devolución",
};

export const COLORES_SEVERIDAD: Record<SeveridadValidacion, string> = {
  error: "text-red-600 bg-red-50 border-red-200",
  advertencia: "text-amber-700 bg-amber-50 border-amber-200",
  info: "text-blue-600 bg-blue-50 border-blue-200",
};

export const COLORES_ESTADO_GLOSA: Record<EstadoGlosa, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  en_revision: "bg-blue-100 text-blue-800",
  respondida: "bg-indigo-100 text-indigo-800",
  aceptada: "bg-red-100 text-red-800",
  rechazada_erp: "bg-orange-100 text-orange-800",
  conciliada: "bg-green-100 text-green-800",
};

/** Plazos legales en días hábiles */
export const PLAZOS_LEGALES = {
  radicacion_soportes: 22,
  devolucion_erp: 5,
  formulacion_glosa: 20,
  respuesta_prestador: 15,
  decision_erp: 15,
} as const satisfies Record<TipoPlazo, number>;

// =====================================================================
// RESUMEN DE FACTURA — Para listado en validación
// =====================================================================

/** Resumen compacto de factura para listados UI */
export interface FacturaResumen {
  id: string;
  num_factura: string;
  fecha_expedicion: string;
  nit_erp: string;
  valor_total: number;
  estado: EstadoFactura;
  ultima_validacion?: string;
}
