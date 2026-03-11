"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { generarJsonRipsMVP } from "@/app/actions/rips";
import * as matiasClient from "@/lib/providers/matias-client";
import * as muvClient from "@/lib/providers/muv-client";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import type { EstadoMuv, MuvError, CredencialesMuvInput, CredencialesMuv } from "@/lib/types/muv";
import { encrypt, decrypt } from "@/lib/muv-crypto";

// ==========================================
// MUV — Server Actions (MinSalud Docker)
// ==========================================

/**
 * Valida los RIPS de una factura ante el MUV (MinSalud) y obtiene el CUV.
 *
 * Prerequisitos:
 *   - Factura con estado_dian = "aceptada" (CUFE válido)
 *   - Docker MUV corriendo en MUV_DOCKER_URL
 *
 * Flujo:
 *   1. Obtener XML firmado desde Matias API (DIAN)
 *   2. Generar JSON RIPS (Resolución 2275)
 *   3. Enviar ambos al Docker MUV
 *   4. Almacenar CUV o errores en la factura
 */
export async function validarRipsYObtenerCuv(
  facturaId: string,
): Promise<
  | { success: true; cuv: string }
  | { success: false; error: string; errores?: MuvError[] }
> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");
  const supabase = await createClient();

  // 1. Obtener factura con paciente
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (errFactura || !factura) {
    return { success: false, error: "Factura no encontrada" };
  }

  // 2. Validar prerequisitos
  if (factura.estado_dian !== "aceptada") {
    return {
      success: false,
      error: "La factura debe estar aceptada por la DIAN antes de validar con el MUV. Envíe primero a la DIAN.",
    };
  }

  if (!factura.cufe || !factura.track_id_dian) {
    return {
      success: false,
      error: "La factura no tiene CUFE o Track ID de la DIAN. Envíe primero a la DIAN.",
    };
  }

  if (factura.cuv) {
    return {
      success: false,
      error: `La factura ya tiene CUV asignado: ${factura.cuv}`,
    };
  }

  // 3. Verificar que el Docker MUV esté disponible
  const muvDisponible = await muvClient.healthCheck();
  if (!muvDisponible) {
    return {
      success: false,
      error: "El servicio MUV no está disponible. Verifique que el Docker esté corriendo.",
    };
  }

  // 4. Obtener XML firmado desde DIAN (Matias API)
  let xmlFirmado: string;
  try {
    xmlFirmado = await matiasClient.descargarXml(factura.track_id_dian);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error descargando XML de la DIAN";
    return { success: false, error: `No se pudo obtener el XML firmado: ${message}` };
  }

  // 5. Generar JSON RIPS (Resolución 2275) — carga datos desde la factura aprobada
  let ripsJson;
  try {
    ripsJson = await generarJsonRipsMVP(facturaId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando RIPS";
    return { success: false, error: `Error al generar JSON RIPS: ${message}` };
  }

  // 6. Marcar como pendiente
  await supabase
    .from("facturas")
    .update({
      estado_muv: "validando" as EstadoMuv,
      fecha_envio_muv: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId);

  // 7. Obtener credenciales MUV del prestador (si existen)
  let muvCredenciales: import("@/lib/types/muv").MuvCredencialesRequest | undefined;
  const { data: creds } = await supabase
    .from("credenciales_muv")
    .select("tipo_usuario, tipo_identificacion, numero_identificacion, contrasena_encrypted, nit_prestador")
    .eq("user_id", ctx.userId)
    .eq("activo", true)
    .single();

  if (creds?.contrasena_encrypted) {
    try {
      muvCredenciales = {
        tipoUsuario: creds.tipo_usuario,
        tipoIdentificacion: creds.tipo_identificacion,
        numeroIdentificacion: creds.numero_identificacion,
        contrasena: decrypt(creds.contrasena_encrypted),
        nitPrestador: creds.nit_prestador,
      };
    } catch (err) {
      devError("Error desencriptando credenciales MUV", err);
    }
  }

  // 8. Enviar al Docker MUV
  try {
    const resultado = await muvClient.validarEnMuv({
      xml: xmlFirmado,
      ripsJson,
      credenciales: muvCredenciales,
    });

    if (resultado.valido && resultado.cuv) {
      // Éxito — almacenar CUV
      const { error: errUpdate } = await supabase
        .from("facturas")
        .update({
          cuv: resultado.cuv,
          estado_muv: "validado" as EstadoMuv,
          respuesta_muv_json: resultado as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", facturaId)
        .eq("organizacion_id", ctx.orgId);

      if (errUpdate) {
        devError("Error actualizando factura post-MUV", errUpdate);
      }

      return { success: true, cuv: resultado.cuv };
    } else {
      // Rechazado — almacenar errores
      await supabase
        .from("facturas")
        .update({
          estado_muv: "rechazado" as EstadoMuv,
          respuesta_muv_json: resultado as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", facturaId)
        .eq("organizacion_id", ctx.orgId);

      const resumen = resultado.errores
        .filter(e => e.severidad === "error")
        .map(e => `[${e.codigo}] ${e.mensaje}`)
        .join("; ");

      return {
        success: false,
        error: resumen || "El MUV rechazó la validación",
        errores: resultado.errores,
      };
    }
  } catch (err) {
    // Error de conexión — regresar a estado anterior
    await supabase
      .from("facturas")
      .update({
        estado_muv: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId);

    const message = err instanceof Error ? err.message : "Error de conexión con el MUV";
    return { success: false, error: message };
  }
}

// ==========================================
// CREDENCIALES MUV — CRUD
// ==========================================

/** Guardar o actualizar credenciales MUV del usuario */
export async function guardarCredencialesMuv(
  input: CredencialesMuvInput,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "enviar_dian");
  const supabase = await createClient();

  let contrasenaEncrypted: string;
  try {
    contrasenaEncrypted = encrypt(input.contrasena);
  } catch (err) {
    devError("Error encriptando contraseña MUV", err);
    return { success: false, error: "Error de configuración del servidor. Contacte soporte." };
  }

  const payload = {
    user_id: ctx.userId,
    organizacion_id: ctx.orgId,
    tipo_usuario: input.tipo_usuario,
    tipo_identificacion: input.tipo_identificacion,
    numero_identificacion: input.numero_identificacion,
    contrasena_encrypted: contrasenaEncrypted,
    nit_prestador: input.nit_prestador,
    activo: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("credenciales_muv")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    devError("Error guardando credenciales MUV", error);
    return { success: false, error: safeError("guardarCredencialesMuv", error) };
  }

  return { success: true };
}

/** Obtener credenciales MUV del usuario (sin contraseña) */
export async function obtenerCredencialesMuv(): Promise<CredencialesMuv | null> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("credenciales_muv")
    .select("id, user_id, organizacion_id, tipo_usuario, tipo_identificacion, numero_identificacion, nit_prestador, activo, created_at, updated_at")
    .eq("user_id", ctx.userId)
    .single();

  if (error || !data) return null;
  return data as CredencialesMuv;
}

/** Verificar si el usuario tiene credenciales MUV configuradas */
export async function tieneCredencialesMuv(): Promise<boolean> {
  const creds = await obtenerCredencialesMuv();
  return creds !== null && creds.activo;
}
