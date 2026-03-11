/**
 * Zod schemas para validar respuestas de Matias API en runtime.
 * Evita type casts inseguros (`as MatiasXxxResponse`) que silencian
 * campos faltantes o tipos incorrectos en la respuesta.
 */

import { z } from "zod";

// =====================================================================
// AUTH
// =====================================================================

export const MatiasAuthResponseSchema = z.object({
  token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

// =====================================================================
// FACTURA — RESPONSE
// =====================================================================

export const MatiasInvoiceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  document: z
    .object({
      id: z.number(),
      uuid: z.string(),
      document_number: z.string(),
      document_key: z.string(),
      is_valid: z.boolean(),
      invoice_date: z.string(),
      qr: z.string().optional(),
      status: z.string(),
      xml: z.string().optional(),
    })
    .optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

// =====================================================================
// ESTADO — RESPONSE
// =====================================================================

export const MatiasStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  document: z
    .object({
      uuid: z.string(),
      document_number: z.string(),
      document_key: z.string(),
      is_valid: z.boolean(),
      status: z.string(),
      qr: z.string().optional(),
    })
    .optional(),
});
