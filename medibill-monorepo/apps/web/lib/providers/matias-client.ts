/**
 * Cliente HTTP para Matias API v3.0.0
 *
 * Maneja autenticación (OAuth2 login o PAT), envío de facturas,
 * consulta de estado, descarga de XML/PDF.
 *
 * Variables de entorno requeridas:
 *   MATIAS_API_URL      — URL base (proporcionada por Matias al contratar)
 *   MATIAS_API_EMAIL    — Email de acceso (auth login)
 *   MATIAS_API_PASSWORD — Password de acceso (auth login)
 *   MATIAS_PAT_TOKEN    — Alternativa: Personal Access Token
 */

import type {
  MatiasAuthResponse,
  MatiasInvoiceRequest,
  MatiasInvoiceResponse,
  MatiasStatusResponse,
} from "./matias-types";

// =====================================================================
// CONFIGURACIÓN
// =====================================================================

function getConfig() {
  const url = process.env.MATIAS_API_URL;
  if (!url) throw new Error("MATIAS_API_URL no configurada");

  return {
    baseUrl: url.replace(/\/$/, ""),
    email: process.env.MATIAS_API_EMAIL || "",
    password: process.env.MATIAS_API_PASSWORD || "",
    pat: process.env.MATIAS_PAT_TOKEN || "",
  };
}

// =====================================================================
// TOKEN CACHE (en memoria del proceso)
// =====================================================================

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// =====================================================================
// CLIENTE
// =====================================================================

/**
 * Autentica con Matias API (login OAuth2).
 * Si hay un PAT configurado, lo usa directamente sin login.
 * Cachea el token en memoria para reutilizar entre requests.
 */
export async function autenticar(): Promise<string> {
  const config = getConfig();

  // Si hay PAT configurado, usarlo directamente
  if (config.pat) {
    return config.pat;
  }

  // Si el token cacheado aún es válido (con margen de 5 minutos)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const res = await fetch(`${config.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Matias auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as MatiasAuthResponse;
  cachedToken = data.token;
  // expires_in is in seconds; Matias tokens default to 90 days
  tokenExpiresAt = Date.now() + (data.expires_in || 7776000) * 1000;

  return data.token;
}

/**
 * Envía una factura a la DIAN a través de Matias API.
 * POST /invoice
 */
export async function enviarFactura(
  invoiceJson: MatiasInvoiceRequest,
): Promise<MatiasInvoiceResponse> {
  const token = await autenticar();
  const config = getConfig();

  const res = await fetch(`${config.baseUrl}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(invoiceJson),
  });

  // Si 401, intentar re-autenticar una vez
  if (res.status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    const newToken = await autenticar();

    const retry = await fetch(`${config.baseUrl}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      body: JSON.stringify(invoiceJson),
    });

    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Matias enviarFactura failed (${retry.status}): ${text}`);
    }

    return (await retry.json()) as MatiasInvoiceResponse;
  }

  if (res.status === 402) {
    throw new Error("Límite de consumo de Matias API alcanzado. Verifique su membresía.");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Matias enviarFactura failed (${res.status}): ${text}`);
  }

  return (await res.json()) as MatiasInvoiceResponse;
}

/**
 * Consulta el estado de un documento en la DIAN (producción).
 * GET /status/document/{trackId}
 */
export async function consultarEstado(
  trackId: string,
): Promise<MatiasStatusResponse> {
  const token = await autenticar();
  const config = getConfig();

  const res = await fetch(
    `${config.baseUrl}/status/document/${encodeURIComponent(trackId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Matias consultarEstado failed (${res.status}): ${text}`);
  }

  return (await res.json()) as MatiasStatusResponse;
}

/**
 * Descarga el XML firmado de un documento ya enviado a la DIAN.
 * GET /documents/xml/{trackId}
 */
export async function descargarXml(trackId: string): Promise<string> {
  const token = await autenticar();
  const config = getConfig();

  const res = await fetch(
    `${config.baseUrl}/documents/xml/${encodeURIComponent(trackId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Matias descargarXml failed (${res.status})`);
  }

  return await res.text();
}

/**
 * Descarga el PDF (representación gráfica) de un documento.
 * GET /documents/pdf/{trackId}
 */
export async function descargarPdf(trackId: string): Promise<ArrayBuffer> {
  const token = await autenticar();
  const config = getConfig();

  const res = await fetch(
    `${config.baseUrl}/documents/pdf/${encodeURIComponent(trackId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Matias descargarPdf failed (${res.status})`);
  }

  return await res.arrayBuffer();
}

/**
 * Consulta el consumo actual de la membresía de Matias.
 * GET /ubl2.1/memberships/consumption
 */
export async function consultarConsumo(): Promise<Record<string, unknown>> {
  const token = await autenticar();
  const config = getConfig();

  const res = await fetch(`${config.baseUrl}/ubl2.1/memberships/consumption`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Matias consultarConsumo failed (${res.status})`);
  }

  return (await res.json()) as Record<string, unknown>;
}

/**
 * Limpia el token cacheado (útil para testing o logout).
 */
export function limpiarTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
