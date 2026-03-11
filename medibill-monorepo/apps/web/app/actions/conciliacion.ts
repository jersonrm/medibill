"use server";

import { createClient } from "@/lib/supabase-server";
import { tieneFeature } from "@/lib/suscripcion";
import { devError } from "@/lib/logger";
import { parsearArchivoSabana } from "@/lib/sabana-parser";
import { mapearColumnasSabana, aplicarMapeo } from "@/lib/sabana-mapper";
import { conciliarConFacturas } from "@/lib/conciliacion-service";
import { registrarPago } from "@/app/actions/pagos";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { validateFileMagicBytes } from "@/lib/file-validation";
import type {
  ResultadoParseo,
  ResultadoMapeoIA,
  FilaNormalizada,
  ResultadoConciliacion,
  ItemConfirmacion,
  MetaImportacion,
  MapeoColumnas,
  FilaSabana,
  ImportacionSabanaDB,
} from "@/lib/types/sabana";

// ==========================================
// CONCILIACIÓN DE SÁBANAS EPS — Server Actions
// ==========================================

/** Paso 1: Parsea el archivo subido y devuelve headers + muestra de datos */
export async function parsearSabana(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  data?: ResultadoParseo;
}> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "importar_sabana");
  const supabase = await createClient();

  // Feature gate: requiere importacion_sabana
  if (!await tieneFeature(ctx.orgId, "importacion_sabana")) {
    return { success: false, error: "Tu plan no incluye importación de sábana. Actualiza tu plan para usar esta funcionalidad." };
  }

  const file = formData.get("archivo") as File | null;
  if (!file) return { success: false, error: "No se recibió archivo" };

  // Validar tamaño (5MB máx)
  if (file.size > 5 * 1024 * 1024) {
    return {
      success: false,
      error: "El archivo excede el tamaño máximo de 5MB",
    };
  }

  // Validar extensión
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
    return {
      success: false,
      error: "Formato no soportado. Use archivos .xlsx, .xls o .csv",
    };
  }

  // Validar magic bytes del contenido (previene spoofeo de extensión)
  const buffer = await file.arrayBuffer();
  const allowedMimes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  // CSV no tiene magic bytes — solo validar magic bytes para archivos binarios
  if (ext !== "csv") {
    const detectedMime = validateFileMagicBytes(buffer, allowedMimes);
    if (!detectedMime) {
      return { success: false, error: "El contenido del archivo no corresponde a un archivo Excel válido." };
    }
  }

  try {
    const resultado = parsearArchivoSabana(buffer, file.name);
    return { success: true, data: resultado };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al parsear archivo";
    devError("Error parseando sábana", err);
    return { success: false, error: msg };
  }
}

/** Paso 2: Mapea las columnas con IA y concilia contra facturas */
export async function mapearYConciliar(
  headers: string[],
  filas: FilaSabana[],
  nitEps?: string,
  epsNombre?: string
): Promise<{
  success: boolean;
  error?: string;
  mapeo?: ResultadoMapeoIA & { mapeo_id?: string; desde_cache: boolean };
  filasNormalizadas?: FilaNormalizada[];
  conciliacion?: ResultadoConciliacion;
}> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "importar_sabana");
  const supabase = await createClient();

  // Feature gate: requiere importacion_sabana
  if (!await tieneFeature(ctx.orgId, "importacion_sabana")) {
    return { success: false, error: "Tu plan no incluye importación de sábana." };
  }

  try {
    // 1. Mapear columnas (con cache o IA)
    const muestra = filas.slice(0, 5);
    const mapeo = await mapearColumnasSabana(
      headers,
      muestra,
      ctx.orgId,
      nitEps,
      epsNombre
    );

    // Validar que al menos num_factura y valor_pagado estén mapeados
    if (!mapeo.mapeo.num_factura) {
      return {
        success: false,
        error:
          'No se pudo identificar la columna de "Número de factura" en el archivo. Revise el mapeo manualmente.',
      };
    }
    if (!mapeo.mapeo.valor_pagado) {
      return {
        success: false,
        error:
          'No se pudo identificar la columna de "Valor pagado" en el archivo. Revise el mapeo manualmente.',
      };
    }

    // 2. Aplicar mapeo
    const filasNormalizadas = aplicarMapeo(filas, mapeo.mapeo);

    if (filasNormalizadas.length === 0) {
      return {
        success: false,
        error:
          "No se encontraron filas válidas después de aplicar el mapeo. Verifique que las columnas estén correctamente mapeadas.",
      };
    }

    // 3. Conciliar contra facturas en BD
    const conciliacion = await conciliarConFacturas(
      filasNormalizadas,
      ctx.orgId
    );

    return {
      success: true,
      mapeo,
      filasNormalizadas,
      conciliacion,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Error al mapear y conciliar";
    devError("Error en mapearYConciliar", err);
    return { success: false, error: msg };
  }
}

/** Paso 2b: Re-conciliar con un mapeo manual (sin llamar al LLM) */
export async function reconciliarConMapeoManual(
  filas: FilaSabana[],
  mapeo: MapeoColumnas
): Promise<{
  success: boolean;
  error?: string;
  filasNormalizadas?: FilaNormalizada[];
  conciliacion?: ResultadoConciliacion;
}> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "importar_sabana");

  // Feature gate: requiere importacion_sabana
  if (!await tieneFeature(ctx.orgId, "importacion_sabana")) {
    return { success: false, error: "Tu plan no incluye importación de sábana." };
  }

  try {
    const filasNormalizadas = aplicarMapeo(filas, mapeo);

    if (filasNormalizadas.length === 0) {
      return {
        success: false,
        error:
          "No se encontraron filas válidas. Verifique que las columnas estén correctamente mapeadas.",
      };
    }

    const conciliacion = await conciliarConFacturas(
      filasNormalizadas,
      ctx.orgId
    );

    return { success: true, filasNormalizadas, conciliacion };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al reconciliar";
    devError("Error en reconciliarConMapeoManual", err);
    return { success: false, error: msg };
  }
}

/** Paso 3: Confirma la conciliación y registra los pagos en lote */
export async function confirmarConciliacion(
  items: ItemConfirmacion[],
  meta: MetaImportacion
): Promise<{
  success: boolean;
  error?: string;
  pagos_registrados: number;
  errores: string[];
}> {
  const ctx = await getContextoOrg();
  verificarPermisoOError(ctx.rol, "importar_sabana");

  // Feature gate: requiere importacion_sabana
  if (!await tieneFeature(ctx.orgId, "importacion_sabana")) {
    return { success: false, error: "Tu plan no incluye importación de sábana.", pagos_registrados: 0, errores: [] };
  }

  if (items.length === 0) {
    return {
      success: false,
      error: "No hay pagos para registrar",
      pagos_registrados: 0,
      errores: [],
    };
  }

  let registrados = 0;
  const errores: string[] = [];

  // Registrar cada pago usando la función existente
  for (const item of items) {
    const result = await registrarPago({
      factura_id: item.factura_id,
      monto: item.monto,
      fecha_pago: item.fecha_pago,
      metodo_pago: "transferencia", // Default para pagos de EPS
      referencia: item.referencia,
      notas: item.notas || `Importado de sábana EPS: ${meta.nombre_archivo}`,
    });

    if (result.success) {
      registrados++;
    } else {
      errores.push(`Factura ${item.factura_id}: ${result.error}`);
    }
  }

  // Crear registro de importación
  try {
    const supabase = await createClient();
    await supabase.from("importaciones_sabana").insert({
      user_id: ctx.userId,
      nit_eps: meta.nit_eps,
      eps_nombre: meta.eps_nombre,
      nombre_archivo: meta.nombre_archivo,
      total_filas: items.length + errores.length,
      filas_conciliadas: registrados,
      filas_sin_match: errores.length,
      monto_total_importado: items.reduce((sum, i) => sum + i.monto, 0),
      monto_total_glosado: 0,
      estado: "confirmada",
      mapeo_usado_id: meta.mapeo_usado_id || null,
      resumen_json: {
        pagos_registrados: registrados,
        errores: errores.slice(0, 10),
      },
    });
  } catch (err) {
    devError("Error guardando registro de importación", err);
  }

  return {
    success: errores.length === 0,
    error:
      errores.length > 0
        ? `${errores.length} pagos fallaron: ${errores[0]}`
        : undefined,
    pagos_registrados: registrados,
    errores,
  };
}

/** Lista historial de importaciones del usuario */
export async function listarImportaciones(): Promise<ImportacionSabanaDB[]> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  const { data } = await supabase
    .from("importaciones_sabana")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data as ImportacionSabanaDB[]) || [];
}
