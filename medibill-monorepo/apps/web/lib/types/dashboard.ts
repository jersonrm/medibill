/**
 * Tipos TypeScript para el Dashboard Principal
 */

export interface KPIDashboard {
  facturas_mes: number;
  valor_facturado_mes: number;
  pendientes_descarga: number;
  glosas_activas: number;
  valor_glosado_activo: number;
  tasa_recuperacion: number; // 0-100
  cartera_pendiente: number;
  facturas_en_cartera: number;
}

export interface FacturacionMensual {
  mes: string; // "2026-01", "2026-02", etc.
  mes_label: string; // "Ene", "Feb", etc.
  cantidad: number;
  valor_total: number;
}

export interface DistribucionEPS {
  eps_nombre: string;
  nit_erp: string;
  valor_total: number;
  cantidad: number;
}

export interface ItemAtencion {
  id: string;
  tipo: "glosa_por_vencer" | "factura_borrador_antigua" | "cartera_vencida" | "acuerdo_por_vencer" | "numeracion_agotandose";
  titulo: string;
  descripcion: string;
  fecha_limite: string | null;
  dias_restantes: number | null;
  url: string;
  urgencia: "alta" | "media" | "baja";
}
