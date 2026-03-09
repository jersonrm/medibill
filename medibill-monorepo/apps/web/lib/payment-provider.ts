/**
 * Interfaz abstracta para proveedores de pagos.
 * Permite cambiar de Wompi a Stripe (u otra) sin reescribir lógica de negocio.
 */

export interface CheckoutSession {
  /** URL a donde redirigir al usuario para pagar */
  redirectUrl: string;
  /** ID de la sesión/transacción en el proveedor */
  sessionId: string;
}

export interface ChargeResult {
  success: boolean;
  transactionId: string | null;
  estado: "paid" | "pending" | "declined" | "error";
  mensaje?: string;
}

export interface PaymentProvider {
  /**
   * Crea una sesión de checkout para que el usuario pague.
   * Redirige al usuario a la página de pago del proveedor.
   */
  crearCheckout(params: {
    orgId: string;
    emailCliente: string;
    montoCop: number;
    descripcion: string;
    referencia: string;           // ID interno (ej: sub_xxxxx)
    returnUrl: string;            // URL de retorno después del pago
  }): Promise<CheckoutSession>;

  /**
   * Cobra a un token/fuente de pago guardada (para cobros recurrentes).
   */
  cobrarConToken(params: {
    paymentSourceToken: string;
    montoCop: number;
    descripcion: string;
    referencia: string;
    emailCliente: string;
  }): Promise<ChargeResult>;

  /**
   * Verifica la firma de un webhook entrante.
   * Retorna true si la firma es válida.
   */
  verificarWebhookFirma(params: {
    body: string;
    signature: string;
    timestamp?: string;
  }): boolean;

  /**
   * Parsea el payload de un webhook a un evento normalizado.
   */
  parsearEvento(body: string): WebhookEvent;
}

export type WebhookEventType =
  | "transaction.approved"
  | "transaction.declined"
  | "transaction.voided"
  | "payment_source.created"
  | "unknown";

export interface WebhookEvent {
  tipo: WebhookEventType;
  transactionId: string | null;
  referencia: string | null;
  estado: "paid" | "pending" | "declined" | "voided" | "error";
  montoCop: number | null;
  metodoPago: "card" | "pse" | "nequi" | null;
  paymentSourceToken: string | null;
  raw: unknown;
}
