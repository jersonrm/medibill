/**
 * Cliente HTTP para MUV (Mecanismo Único de Validación) — MinSalud
 *
 * Comunica con el Docker local del MUV para validar el paquete
 * FEV XML (DIAN) + JSON RIPS (Res. 2275) y obtener el CUV.
 *
 * Variables de entorno:
 *   MUV_DOCKER_URL — URL base del Docker MUV (default: http://localhost:8080)
 */

import type { MuvValidationRequest, MuvValidationResponse, MuvError } from "@/lib/types/muv";
import { devError } from "@/lib/logger";

// =====================================================================
// CONFIGURACIÓN
// =====================================================================

const MUV_TIMEOUT_MS = 30_000; // 30 segundos

function getBaseUrl(): string {
  return (process.env.MUV_DOCKER_URL || "http://localhost:8080").replace(/\/$/, "");
}

// =====================================================================
// CLIENTE
// =====================================================================

/**
 * Verifica que el Docker MUV esté disponible.
 * Retorna true si responde, false si no.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch (e) {
    devError("MUV health check failed", e);
    return false;
  }
}

/**
 * Envía el paquete FEV XML + JSON RIPS al MUV para validación.
 * Retorna el CUV si es válido, o la lista de errores si no.
 */
export async function validarEnMuv(
  request: MuvValidationRequest,
): Promise<MuvValidationResponse> {
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      xml: request.xml,
      rips: request.ripsJson,
      ...(request.credenciales && { credenciales: request.credenciales }),
    }),
    signal: AbortSignal.timeout(MUV_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();

    // Intentar parsear errores estructurados
    try {
      const errorBody = JSON.parse(text) as { errores?: MuvError[]; mensaje?: string };
      if (errorBody.errores) {
        return {
          valido: false,
          cuv: null,
          errores: errorBody.errores,
        };
      }
    } catch (e) {
      devError("MUV error response not JSON", e);
      // No es JSON — retornar como error genérico
    }

    return {
      valido: false,
      cuv: null,
      errores: [{
        codigo: `HTTP-${res.status}`,
        mensaje: text || `Error del servidor MUV (${res.status})`,
        severidad: "error",
      }],
    };
  }

  return (await res.json()) as MuvValidationResponse;
}
