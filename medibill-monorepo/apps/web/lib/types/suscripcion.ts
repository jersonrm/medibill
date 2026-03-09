/**
 * Tipos TypeScript para Suscripciones, Organizaciones y Multi-Tenancy
 * Alineados con schema-suscripciones.sql
 */

// =====================================================================
// ORGANIZACIÓN
// =====================================================================

export type TipoOrganizacion = "independiente" | "clinica";

export interface Organizacion {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: TipoOrganizacion;
  logo_url: string | null;
  email_billing: string;
  wompi_customer_id: string | null;
  wompi_payment_source: string | null;
  max_usuarios: number;
  max_clasificaciones: number | null; // null = ilimitado
  max_facturas_dian: number | null;   // null = ilimitado
  storage_gb: number;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// PLANES
// =====================================================================

export type PlanId = "starter" | "profesional" | "clinica";

export type SoporteNivel = "email" | "email_chat" | "prioritario" | "dedicado";

export interface Plan {
  id: PlanId;
  nombre: string;
  precio_cop_mensual: number;
  precio_cop_anual: number | null;
  max_usuarios: number;
  max_clasificaciones: number | null;
  max_facturas_dian: number | null;
  storage_gb: number;
  ia_sugerencias_glosas: boolean;
  importacion_sabana: boolean;
  importacion_masiva: boolean;
  soporte_nivel: SoporteNivel;
  activo: boolean;
}

// =====================================================================
// SUSCRIPCIÓN
// =====================================================================

export type EstadoSuscripcion =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused"
  | "incomplete";

export type PeriodoSuscripcion = "mensual" | "anual";

export interface Suscripcion {
  id: string;
  organizacion_id: string;
  plan_id: PlanId;
  estado: EstadoSuscripcion;
  periodo: PeriodoSuscripcion;
  wompi_subscription_id: string | null;
  trial_inicio: string | null;
  trial_fin: string | null;
  periodo_actual_inicio: string | null;
  periodo_actual_fin: string | null;
  cancelada_al_final: boolean;
  cantidad_seats: number;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// USUARIOS DE ORGANIZACIÓN
// =====================================================================

export type RolOrganizacion = "owner" | "admin" | "doctor" | "facturador" | "auditor";

export interface UsuarioOrganizacion {
  id: string;
  organizacion_id: string;
  user_id: string;
  rol: RolOrganizacion;
  activo: boolean;
  invitado_por: string | null;
  invitado_email: string | null;
  accepted_at: string | null;
  created_at: string;
}

// =====================================================================
// INVITACIONES
// =====================================================================

export interface Invitacion {
  id: string;
  organizacion_id: string;
  email: string;
  rol: RolOrganizacion;
  token: string;
  invitado_por: string;
  expira_at: string;
  usado: boolean;
  created_at: string;
}

// =====================================================================
// USO MENSUAL
// =====================================================================

export interface UsoMensual {
  id: string;
  organizacion_id: string;
  periodo: string; // 'YYYY-MM'
  clasificaciones_ia: number;
  facturas_dian: number;
  storage_usado_mb: number;
  usuarios_activos: number;
  facturas_adicionales: number;
  costo_adicional_cop: number;
}

// =====================================================================
// HISTORIAL DE PAGOS
// =====================================================================

export type EstadoPago = "paid" | "pending" | "declined" | "voided" | "error";
export type MetodoPago = "card" | "pse" | "nequi";

export interface HistorialPago {
  id: string;
  organizacion_id: string;
  wompi_transaction_id: string | null;
  monto_cop: number;
  estado: EstadoPago;
  descripcion: string | null;
  periodo: string | null;
  fecha_pago: string | null;
  metodo_pago: MetodoPago | null;
  created_at: string;
}

// =====================================================================
// CONTEXTO ORG (usado en server actions)
// =====================================================================

export interface ContextoOrg {
  userId: string;
  orgId: string;
  orgNombre: string;
  orgTipo: TipoOrganizacion;
  rol: RolOrganizacion;
  suscripcion: {
    plan_id: PlanId;
    estado: EstadoSuscripcion;
    trial_fin: string | null;
    periodo_actual_fin: string | null;
  } | null;
}

// =====================================================================
// LÍMITES Y FEATURES
// =====================================================================

export interface LimitesOrg {
  plan: PlanId;
  planNombre: string;
  precioCopMensual: number;
  estado: EstadoSuscripcion;
  finPeriodo: string | null;
  maxClasificaciones: number | null;
  maxFacturasDian: number | null;
  maxUsuarios: number;
  storageGb: number;
  features: {
    iaSugerenciasGlosas: boolean;
    importacionSabana: boolean;
    importacionMasiva: boolean;
  };
  uso: {
    clasificaciones: number;
    facturasDian: number;
    usuarios: number;
    storageMb: number;
  };
}

export interface ResultadoVerificacion {
  permitido: boolean;
  restante: number | null; // null = ilimitado
  mensaje?: string;
}

export type TipoUso = "clasificacion" | "factura_dian";

export type FeatureFlag = "ia_sugerencias_glosas" | "importacion_sabana" | "importacion_masiva";
