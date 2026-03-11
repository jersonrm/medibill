import { devError } from "@/lib/logger";

/**
 * Convierte errores de Supabase/DB en mensajes seguros para el cliente.
 * Evita exponer detalles internos (constraint names, SQL errors, etc.).
 */
export function safeError(contexto: string, error: { message?: string; code?: string } | null): string {
  if (!error?.message) return "Error inesperado. Intenta de nuevo.";

  const msg = error.message;

  // Log del error real para debugging (solo server-side)
  devError(contexto, msg);

  // Duplicados (unique constraint)
  if (msg.includes("duplicate key") || msg.includes("unique constraint") || error.code === "23505") {
    return "Este registro ya existe.";
  }

  // FK violations
  if (msg.includes("foreign key") || error.code === "23503") {
    return "No se puede completar: hay datos relacionados.";
  }

  // NOT NULL violations
  if (msg.includes("not-null") || error.code === "23502") {
    return "Faltan campos obligatorios.";
  }

  // RLS / permisos
  if (msg.includes("row-level security") || msg.includes("new row violates") || error.code === "42501") {
    return "No tienes permisos para esta operación.";
  }

  // Check constraint
  if (msg.includes("check constraint") || error.code === "23514") {
    return "Los datos ingresados no son válidos.";
  }

  return "Error al guardar. Intenta de nuevo.";
}
