/**
 * Tipos TypeScript para el módulo de Pagos
 */

// =====================================================================
// MÉTODOS DE PAGO
// =====================================================================

export type MetodoPago =
  | "transferencia"
  | "cheque"
  | "efectivo"
  | "consignacion"
  | "compensacion"
  | "otro";

// =====================================================================
// PAGO
// =====================================================================

/** Pago registrado en la base de datos */
export interface PagoDB {
  id: string;
  factura_id: string;
  user_id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: MetodoPago;
  referencia: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

/** Input para registrar un nuevo pago */
export interface RegistrarPagoInput {
  factura_id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: MetodoPago;
  referencia?: string;
  notas?: string;
}

// =====================================================================
// CARTERA PENDIENTE
// =====================================================================

/** Item de cartera pendiente (factura radicada sin pago completo) */
export interface ItemCartera {
  factura_id: string;
  num_factura: string;
  fecha_expedicion: string;
  fecha_radicacion: string | null;
  nit_erp: string;
  eps_nombre: string;
  valor_total: number;
  total_pagado: number;
  saldo_pendiente: number;
  estado: string;
  dias_antiguedad: number;
  paciente_nombre: string;
}

/** Filtros para la vista de cartera */
export interface FiltrosCartera {
  eps?: string;
  estado?: "pendiente" | "parcial" | "todas";
  antiguedad_min?: number;
  antiguedad_max?: number;
  desde?: string;
  hasta?: string;
}

/** Resumen de cartera */
export interface ResumenCartera {
  total_pendiente: number;
  total_facturas: number;
  promedio_dias: number;
}

/** Métodos de pago disponibles con sus labels */
export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "cheque", label: "Cheque" },
  { value: "efectivo", label: "Efectivo" },
  { value: "consignacion", label: "Consignación" },
  { value: "compensacion", label: "Compensación" },
  { value: "otro", label: "Otro" },
];
