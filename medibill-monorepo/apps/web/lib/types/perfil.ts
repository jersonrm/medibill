/**
 * Tipos TypeScript para Perfil del Prestador y Resoluciones de Facturación
 * Alineados con tabla `perfiles` y `resoluciones_facturacion` en Supabase
 */

// =====================================================================
// PERFIL DEL PRESTADOR
// =====================================================================

export type TipoPrestador =
  | "profesional_independiente"
  | "clinica";

export type RegimenFiscal = "simplificado" | "comun" | "no_responsable";

export interface PerfilPrestador {
  id: string;
  user_id: string;
  organizacion_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  digito_verificacion: string;
  razon_social: string;
  nombre_comercial: string;
  codigo_habilitacion: string;
  tipo_prestador: TipoPrestador;
  direccion: string;
  municipio_codigo: string;
  municipio_nombre: string;
  departamento_codigo: string;
  departamento_nombre: string;
  telefono: string;
  email_facturacion: string;
  responsable_iva: boolean;
  regimen_fiscal: RegimenFiscal;
  especialidad_principal: string;
  registro_medico: string;
  logo_url: string | null;
  onboarding_completo: boolean;
  created_at: string;
  updated_at: string;
}

/** Datos parciales para guardar/actualizar perfil */
export type PerfilPrestadorInput = Omit<
  PerfilPrestador,
  "id" | "user_id" | "created_at" | "updated_at"
>;

// =====================================================================
// RESOLUCIÓN DE FACTURACIÓN DIAN
// =====================================================================

export interface ResolucionFacturacion {
  id: string;
  user_id: string;
  numero_resolucion: string;
  fecha_resolucion: string;
  prefijo: string;
  rango_desde: number;
  rango_hasta: number;
  consecutivo_actual: number;
  fecha_vigencia_desde: string;
  fecha_vigencia_hasta: string;
  clave_tecnica: string | null;
  activa: boolean;
  created_at: string;
}

/** Datos parciales para guardar/actualizar resolución */
export type ResolucionFacturacionInput = Omit<
  ResolucionFacturacion,
  "id" | "user_id" | "consecutivo_actual" | "created_at"
>;
