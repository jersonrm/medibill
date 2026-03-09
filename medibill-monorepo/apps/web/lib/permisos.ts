import type { RolOrganizacion } from "@/lib/types/suscripcion";

/**
 * Permisos por rol para cada acción del sistema.
 * Para verificar: PERMISOS_ROL[accion].includes(rol)
 */
export const PERMISOS_ROL: Record<string, RolOrganizacion[]> = {
  // Dashboard
  ver_dashboard:       ["owner", "admin", "doctor", "facturador", "auditor"],

  // Clasificación IA
  clasificar_ia:       ["owner", "admin", "doctor"],

  // Facturas
  ver_facturas:        ["owner", "admin", "doctor", "facturador", "auditor"],
  crear_factura:       ["owner", "admin", "doctor", "facturador"],
  aprobar_factura:     ["owner", "admin", "doctor"],
  enviar_dian:         ["owner", "admin", "facturador"],
  anular_factura:      ["owner", "admin"],

  // Glosas
  ver_glosas:          ["owner", "admin", "doctor", "facturador", "auditor"],
  responder_glosa:     ["owner", "admin", "doctor", "facturador", "auditor"],

  // Acuerdos de voluntades
  gestionar_acuerdos:  ["owner", "admin"],

  // Configuración de la organización
  config_organizacion: ["owner", "admin"],

  // Gestión de equipo (invitar, cambiar roles)
  gestionar_equipo:    ["owner", "admin"],

  // Suscripción y billing
  gestionar_billing:   ["owner"],

  // Importaciones masivas
  importar_sabana:     ["owner", "admin", "facturador"],
  importar_rips:       ["owner", "admin", "facturador"],
};

/**
 * Verifica si un rol tiene permiso para realizar una acción.
 */
export function tienePermiso(rol: RolOrganizacion, accion: string): boolean {
  const rolesPermitidos = PERMISOS_ROL[accion];
  if (!rolesPermitidos) return false;
  return rolesPermitidos.includes(rol);
}

/**
 * Verifica permiso y lanza error si no se tiene.
 * Uso en server actions: verificarPermisoOError(ctx.rol, "aprobar_factura")
 */
export function verificarPermisoOError(rol: RolOrganizacion, accion: string): void {
  if (!tienePermiso(rol, accion)) {
    throw new Error(`No tienes permiso para: ${accion}`);
  }
}
