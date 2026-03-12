/**
 * Cliente directo para FEV-RIPS API Docker v4.3 (MinSalud)
 *
 * Implementa la comunicación directa con el contenedor Docker oficial
 * conforme al manual FEVRM001 v2.0 — Noviembre 2025.
 *
 * Características:
 *   - LoginSISPRO para obtener token JWT
 *   - Compresión GZIP del body en todos los endpoints de carga
 *   - CargarFevRips, CargarNC, CargarND, etc.
 *   - ConsultarCUV (sin autenticación, disponible para ERP)
 *
 * Variables de entorno:
 *   FEV_RIPS_API_URL — URL base del Docker FEV-RIPS (default: https://localhost:9443)
 */

import { gzipSync } from "zlib";
import { devError, devLog } from "@/lib/logger";
import type {
  LoginSISPRORequest,
  LoginSISPROResponse,
  CargarDocumentoRequest,
  FevRipsApiResponse,
  ConsultarCUVRequest,
  ConsultarCUVResponse,
  RecuperarCUVRequest,
} from "@/lib/types/fev-rips-api";
import type { FevRips } from "@/lib/types/rips";

// =====================================================================
// CONFIGURACIÓN
// =====================================================================

const FEV_RIPS_TIMEOUT_MS = 60_000; // 60 segundos para carga + validación
const LOGIN_TIMEOUT_MS = 15_000;

function getBaseUrl(): string {
  return (process.env.FEV_RIPS_API_URL || "https://localhost:9443").replace(/\/$/, "");
}

// Cache simple para token JWT (expira con el proceso)
let _cachedToken: { token: string; expiresAt: number } | null = null;

// =====================================================================
// AUTENTICACIÓN
// =====================================================================

/**
 * Autentica ante SISPRO y obtiene un token JWT.
 * El token se usa como Bearer en todos los demás endpoints.
 */
export async function loginSISPRO(
  credentials: LoginSISPRORequest,
): Promise<LoginSISPROResponse> {
  const url = `${getBaseUrl()}/api/Auth/LoginSISPRO`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    // El Docker usa HTTPS con certificado auto-firmado en desarrollo
    ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ? {} : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LoginSISPRO falló (HTTP ${res.status}): ${text}`);
  }

  const data = (await res.json()) as LoginSISPROResponse;

  if (!data.login || !data.token) {
    throw new Error(
      data.errors || "LoginSISPRO: credenciales inválidas o usuario no registrado",
    );
  }

  // Cache del token (30 minutos conservador)
  _cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };

  devLog("FEV-RIPS", "LoginSISPRO exitoso");
  return data;
}

/**
 * Obtiene un token válido, reutilizando el cache si existe.
 */
export async function getToken(
  credentials: LoginSISPRORequest,
): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) {
    return _cachedToken.token;
  }
  const response = await loginSISPRO(credentials);
  return response.token;
}

/** Invalida el token cacheado (para forzar re-login) */
export function clearTokenCache(): void {
  _cachedToken = null;
}

// =====================================================================
// CARGA DE DOCUMENTOS (con GZIP)
// =====================================================================

/**
 * Envía un request con compresión GZIP al endpoint indicado.
 * Todos los endpoints de carga usan este helper.
 */
async function cargarConGzip(
  endpoint: string,
  token: string,
  body: CargarDocumentoRequest,
): Promise<FevRipsApiResponse> {
  const url = `${getBaseUrl()}${endpoint}`;
  const jsonBody = JSON.stringify(body);
  const gzippedBody = gzipSync(Buffer.from(jsonBody, "utf-8"));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: gzippedBody,
    signal: AbortSignal.timeout(FEV_RIPS_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FEV-RIPS API error (HTTP ${res.status}): ${text}`);
  }

  return (await res.json()) as FevRipsApiResponse;
}

/**
 * CargarFevRIPS — Carga Factura Electrónica de Venta con soporte RIPS.
 *
 * @param token - JWT obtenido de LoginSISPRO
 * @param rips - JSON RIPS conforme a Res. 2275/2023
 * @param xmlBase64 - AttachedDocument UBL 2.1 codificado en Base64
 */
export async function cargarFevRips(
  token: string,
  rips: FevRips,
  xmlBase64: string,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarFevRips", token, {
    rips,
    xmlFevFile: xmlBase64,
  });
}

/**
 * CargarNC — Carga Nota Crédito parcial.
 * tipoNota debe ser "NC" en el RIPS.
 */
export async function cargarNC(
  token: string,
  rips: FevRips,
  xmlBase64: string,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarNC", token, {
    rips,
    xmlFevFile: xmlBase64,
  });
}

/**
 * CargarNCTotal — Carga Nota Crédito Total.
 * RIPS debe ser null, solo se envía el XML.
 */
export async function cargarNCTotal(
  token: string,
  xmlBase64: string,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarNCTotal", token, {
    rips: null,
    xmlFevFile: xmlBase64,
  });
}

/**
 * CargarND — Carga Nota Débito.
 * tipoNota debe ser "ND" en el RIPS.
 */
export async function cargarND(
  token: string,
  rips: FevRips,
  xmlBase64: string,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarND", token, {
    rips,
    xmlFevFile: xmlBase64,
  });
}

/**
 * CargarNotaAjuste — Carga Nota de Ajuste.
 * tipoNota debe ser "NA", xmlFevFile debe ser "".
 */
export async function cargarNotaAjuste(
  token: string,
  rips: FevRips,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarNotaAjuste", token, {
    rips,
    xmlFevFile: "",
  });
}

/**
 * CargarRipsSinFactura — Carga RIPS sin factura.
 * tipoNota debe ser "RS", numFactura debe ser null, xmlFevFile "".
 */
export async function cargarRipsSinFactura(
  token: string,
  rips: FevRips,
): Promise<FevRipsApiResponse> {
  return cargarConGzip("/api/PaquetesFevRips/CargarRipsSinFactura", token, {
    rips,
    xmlFevFile: "",
  });
}

// =====================================================================
// CONSULTAS
// =====================================================================

/**
 * ConsultarCUV — Consulta un CUV existente.
 * NO requiere autenticación (disponible para ERP).
 * NO usa compresión GZIP.
 */
export async function consultarCUV(
  cuv: string,
): Promise<ConsultarCUVResponse> {
  const url = `${getBaseUrl()}/api/ConsultasFevRips/ConsultarCUV`;

  const body: ConsultarCUVRequest = {
    codigoUnicoValidacion: cuv,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ConsultarCUV falló (HTTP ${res.status}): ${text}`);
  }

  return (await res.json()) as ConsultarCUVResponse;
}

/**
 * RecuperarCUV — Recupera un CUV previamente generado.
 * SÍ requiere autenticación. USA compresión GZIP.
 */
export async function recuperarCUV(
  token: string,
  cuv: string,
): Promise<FevRipsApiResponse> {
  const url = `${getBaseUrl()}/api/PaquetesFevRips/RecuperarCUV`;
  const body: RecuperarCUVRequest = { codigoUnicoValidacion: cuv };
  const jsonBody = JSON.stringify(body);
  const gzippedBody = gzipSync(Buffer.from(jsonBody, "utf-8"));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: gzippedBody,
    signal: AbortSignal.timeout(FEV_RIPS_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RecuperarCUV falló (HTTP ${res.status}): ${text}`);
  }

  return (await res.json()) as FevRipsApiResponse;
}

// =====================================================================
// HEALTH CHECK
// =====================================================================

/**
 * Verifica que el Docker FEV-RIPS API esté disponible.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const url = `${getBaseUrl()}/api/ConsultasFevRips/ConsultarCUV`;
    // Enviamos un CUV ficticio — si responde (200 o error controlado), el servicio está vivo
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoUnicoValidacion: "0".repeat(96) }),
      signal: AbortSignal.timeout(5_000),
    });
    // Cualquier respuesta HTTP (incluso 400) indica que el servicio responde
    return res.status < 500;
  } catch (e) {
    devError("FEV-RIPS health check failed", e);
    return false;
  }
}
