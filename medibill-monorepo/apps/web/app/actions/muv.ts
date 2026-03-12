"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { generarJsonRipsMVP } from "@/app/actions/rips";
import * as matiasClient from "@/lib/providers/matias-client";
import * as fevRipsClient from "@/lib/providers/fev-rips-client";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import type { EstadoMuv, MuvError, CredencialesMuvInput, CredencialesMuv } from "@/lib/types/muv";
import type { ResultadoValidacion } from "@/lib/types/fev-rips-api";
import { encrypt, decrypt } from "@/lib/muv-crypto";

// ==========================================
// MUV — Server Actions (FEV-RIPS API v4.3)
// ==========================================

/**
 * Valida los RIPS de una factura ante el MUV (FEV-RIPS API v4.3) y obtiene el CUV.
 *
 * Prerequisitos:
 *   - Factura con estado_dian = "aceptada" (CUFE válido)
 *   - Docker FEV-RIPS corriendo en FEV_RIPS_API_URL
 *   - Credenciales SISPRO del prestador configuradas
 *
 * Flujo FEV-RIPS API v4.3:
 *   1. Obtener XML firmado (AttachedDocument) desde Matias API (DIAN)
 *   2. Generar JSON RIPS (Resolución 2275)
 *   3. LoginSISPRO → obtener token JWT
 *   4. CargarFevRips(token, rips, xmlBase64) → CUV o errores
 *   5. Almacenar CUV o errores en la factura
 */
export async function validarRipsYObtenerCuv(
  facturaId: string,
): Promise<
  | { success: true; cuv: string; fechaRadicacion: string }
  | { success: false; error: string; errores?: MuvError[]; resultadosValidacion?: ResultadoValidacion[] }
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

  // 3. Verificar credenciales SISPRO del prestador
  const { data: creds } = await supabase
    .from("credenciales_muv")
    .select("tipo_usuario, tipo_identificacion, numero_identificacion, contrasena_encrypted, nit_prestador")
    .eq("user_id", ctx.userId)
    .eq("activo", true)
    .single();

  if (!creds?.contrasena_encrypted) {
    return {
      success: false,
      error: "No hay credenciales SISPRO configuradas. Configure sus credenciales en Configuración → MUV.",
    };
  }

  let contrasena: string;
  try {
    contrasena = decrypt(creds.contrasena_encrypted);
  } catch (err) {
    devError("Error desencriptando credenciales MUV", err);
    return { success: false, error: "Error al leer las credenciales SISPRO. Reconfigure sus credenciales." };
  }

  // 4. Verificar que el Docker FEV-RIPS API esté disponible
  const apiDisponible = await fevRipsClient.healthCheck();
  if (!apiDisponible) {
    return {
      success: false,
      error: "El servicio FEV-RIPS API no está disponible. Verifique que el Docker esté corriendo.",
    };
  }

  // 5. Obtener XML firmado (AttachedDocument) desde DIAN (Matias API)
  let xmlFirmado: string;
  try {
    xmlFirmado = await matiasClient.descargarXml(factura.track_id_dian);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error descargando XML de la DIAN";
    return { success: false, error: `No se pudo obtener el XML firmado: ${message}` };
  }

  // 6. Generar JSON RIPS (Resolución 2275)
  let ripsJson;
  try {
    ripsJson = await generarJsonRipsMVP(facturaId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando RIPS";
    return { success: false, error: `Error al generar JSON RIPS: ${message}` };
  }

  // 7. Marcar como pendiente (validando)
  await supabase
    .from("facturas")
    .update({
      estado_muv: "validando" as EstadoMuv,
      fecha_envio_muv: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId);

  try {
    // 8. LoginSISPRO → obtener token JWT
    const token = await fevRipsClient.getToken({
      persona: {
        identificacion: {
          tipo: creds.tipo_identificacion,
          numero: creds.numero_identificacion,
        },
      },
      clave: contrasena,
      nit: creds.nit_prestador,
      tipoUsuario: (creds.tipo_usuario as "RE" | "PIN" | "PINx" | "PIE") || "RE",
    });

    // 9. Codificar XML en Base64 para el API
    const xmlBase64 = Buffer.from(xmlFirmado, "utf-8").toString("base64");

    // 10. CargarFevRips → CUV o errores
    const resultado = await fevRipsClient.cargarFevRips(token, ripsJson, xmlBase64);

    if (resultado.ResultState && resultado.CodigoUnicoValidacion) {
      // Éxito — CUV obtenido
      const cuv = resultado.CodigoUnicoValidacion;

      const { error: errUpdate } = await supabase
        .from("facturas")
        .update({
          cuv,
          estado_muv: "validado" as EstadoMuv,
          fecha_radicacion_muv: resultado.FechaRadicacion,
          respuesta_muv_json: resultado as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", facturaId)
        .eq("organizacion_id", ctx.orgId);

      if (errUpdate) {
        devError("Error actualizando factura post-MUV", errUpdate);
      }

      return { success: true, cuv, fechaRadicacion: resultado.FechaRadicacion };
    } else {
      // Rechazado — almacenar errores
      const rechazos = resultado.ResultadosValidacion.filter(r => r.Clase === "RECHAZADO");
      const notificaciones = resultado.ResultadosValidacion.filter(r => r.Clase === "NOTIFICACION");

      await supabase
        .from("facturas")
        .update({
          estado_muv: "rechazado" as EstadoMuv,
          respuesta_muv_json: resultado as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", facturaId)
        .eq("organizacion_id", ctx.orgId);

      // Convertir ResultadosValidacion a MuvError para compatibilidad con la UI
      const erroresMuv: MuvError[] = resultado.ResultadosValidacion.map(r => ({
        codigo: r.Codigo,
        mensaje: r.Observaciones || r.Descripcion,
        campo: r.PathFuente,
        severidad: r.Clase === "RECHAZADO" ? "error" as const : "warning" as const,
      }));

      const resumen = rechazos.length > 0
        ? rechazos.map(e => `[${e.Codigo}] ${e.Observaciones || e.Descripcion}`).join("; ")
        : resultado.CodigoUnicoValidacion || "El MUV rechazó la validación";

      return {
        success: false,
        error: resumen,
        errores: erroresMuv,
        resultadosValidacion: resultado.ResultadosValidacion,
      };
    }
  } catch (err) {
    // Error de conexión/autenticación — regresar a estado anterior
    fevRipsClient.clearTokenCache();

    await supabase
      .from("facturas")
      .update({
        estado_muv: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("organizacion_id", ctx.orgId);

    const message = err instanceof Error ? err.message : "Error de conexión con el servicio FEV-RIPS";
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
