/**
 * Implementación de Wompi como proveedor de pagos.
 * Docs: https://docs.wompi.co/
 *
 * Variables de entorno requeridas:
 *   WOMPI_PUBLIC_KEY     — Llave pública (pub_prod_xxx o pub_test_xxx)
 *   WOMPI_PRIVATE_KEY    — Llave privada (prv_prod_xxx o prv_test_xxx)
 *   WOMPI_EVENTS_SECRET  — Secret para validar webhooks
 *   WOMPI_INTEGRITY_KEY  — Llave de integridad para firmar transacciones
 */

import { createHmac, createHash } from "crypto";
import type {
  PaymentProvider,
  CheckoutSession,
  ChargeResult,
  WebhookEvent,
  WebhookEventType,
} from "@/lib/payment-provider";

const WOMPI_API =
  process.env.WOMPI_ENVIRONMENT === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";

function getPrivateKey(): string {
  const key = process.env.WOMPI_PRIVATE_KEY;
  if (!key) throw new Error("WOMPI_PRIVATE_KEY no configurada");
  return key;
}

function getPublicKey(): string {
  const key = process.env.WOMPI_PUBLIC_KEY;
  if (!key) throw new Error("WOMPI_PUBLIC_KEY no configurada");
  return key;
}

function getEventsSecret(): string {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) throw new Error("WOMPI_EVENTS_SECRET no configurada");
  return secret;
}

function getIntegrityKey(): string {
  const key = process.env.WOMPI_INTEGRITY_KEY;
  if (!key) throw new Error("WOMPI_INTEGRITY_KEY no configurada");
  return key;
}

/**
 * Genera la firma de integridad para el widget de checkout de Wompi.
 * La firma es: SHA256(referencia + montoCentavos + moneda + integrityKey)
 */
export function generarFirmaIntegridad(
  referencia: string,
  montoCentavos: number,
  moneda: string = "COP"
): string {
  const cadena = `${referencia}${montoCentavos}${moneda}${getIntegrityKey()}`;
  return createHash("sha256").update(cadena).digest("hex");
}

export const wompiProvider: PaymentProvider = {
  async crearCheckout({
    orgId,
    emailCliente,
    montoCop,
    descripcion,
    referencia,
    returnUrl,
  }): Promise<CheckoutSession> {
    // Wompi usa centavos
    const montoCentavos = Math.round(montoCop * 100);
    const firma = generarFirmaIntegridad(referencia, montoCentavos);

    // Wompi Checkout se integra vía widget en el frontend.
    // Desde el backend, preparamos los datos que el widget necesita.
    // Retornamos una URL con los parámetros para el widget.
    const params = new URLSearchParams({
      "public-key": getPublicKey(),
      currency: "COP",
      "amount-in-cents": montoCentavos.toString(),
      reference: referencia,
      "signature:integrity": firma,
      "redirect-url": returnUrl,
      "customer-data:email": emailCliente,
      "customer-data:full-name": descripcion,
    });

    // Para Wompi, el "redirect" es al widget embebido o a la URL de checkout
    const redirectUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

    return {
      redirectUrl,
      sessionId: referencia,
    };
  },

  async cobrarConToken({
    paymentSourceToken,
    montoCop,
    descripcion,
    referencia,
    emailCliente,
  }): Promise<ChargeResult> {
    const montoCentavos = Math.round(montoCop * 100);

    const response = await fetch(`${WOMPI_API}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getPrivateKey()}`,
      },
      body: JSON.stringify({
        amount_in_cents: montoCentavos,
        currency: "COP",
        payment_source_id: parseInt(paymentSourceToken, 10),
        reference: referencia,
        customer_email: emailCliente,
        payment_method: { installments: 1 },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        success: false,
        transactionId: null,
        estado: "error",
        mensaje: `Wompi API error: ${response.status}`,
      };
    }

    const result = await response.json();
    const txData = result.data;

    const estadoMap: Record<string, ChargeResult["estado"]> = {
      APPROVED: "paid",
      PENDING: "pending",
      DECLINED: "declined",
      VOIDED: "declined",
      ERROR: "error",
    };

    return {
      success: txData.status === "APPROVED",
      transactionId: txData.id,
      estado: estadoMap[txData.status] || "error",
      mensaje: txData.status_message,
    };
  },

  verificarWebhookFirma({ body, signature, timestamp }): boolean {
    // Wompi firma: SHA256(properties concatenadas + timestamp + events_secret)
    // https://docs.wompi.co/docs/en/eventos
    const secret = getEventsSecret();

    try {
      const parsed = JSON.parse(body);
      const event = parsed.data?.transaction;
      if (!event) return false;

      // Wompi concatena: transaction.id + transaction.status + transaction.amount_in_cents + timestamp + secret
      const cadena = `${event.id}${event.status}${event.amount_in_cents}${timestamp || parsed.timestamp}${secret}`;
      const expectedSignature = createHash("sha256").update(cadena).digest("hex");

      return expectedSignature === (parsed.signature?.checksum || signature);
    } catch (e) {
      console.error("[Wompi] Webhook signature verification failed", e instanceof Error ? e.message : e);
      return false;
    }
  },

  parsearEvento(body: string): WebhookEvent {
    const parsed = JSON.parse(body);
    const tx = parsed.data?.transaction;
    const eventType = parsed.event as string;

    const tipoMap: Record<string, WebhookEventType> = {
      "transaction.updated": tx?.status === "APPROVED" ? "transaction.approved"
        : tx?.status === "DECLINED" ? "transaction.declined"
        : tx?.status === "VOIDED" ? "transaction.voided"
        : "unknown",
      "nequi_token.updated": "payment_source.created",
    };

    const estadoMap: Record<string, WebhookEvent["estado"]> = {
      APPROVED: "paid",
      PENDING: "pending",
      DECLINED: "declined",
      VOIDED: "voided",
      ERROR: "error",
    };

    return {
      tipo: tipoMap[eventType] || "unknown",
      transactionId: tx?.id || null,
      referencia: tx?.reference || null,
      estado: estadoMap[tx?.status] || "error",
      montoCop: tx?.amount_in_cents ? tx.amount_in_cents / 100 : null,
      metodoPago: tx?.payment_method_type === "CARD" ? "card"
        : tx?.payment_method_type === "PSE" ? "pse"
        : tx?.payment_method_type === "NEQUI" ? "nequi"
        : null,
      paymentSourceToken: tx?.payment_source_id?.toString() || null,
      raw: parsed,
    };
  },
};
