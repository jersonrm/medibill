/**
 * Catálogo de grupo de servicios y código de servicio — Resolución 2275 de 2023
 * Tabla de referencia para grupoServicios + codServicio
 *
 * grupoServicios: "01" Consulta Externa, "02" Apoyo Diagnóstico y Terapéutico,
 *                 "03" Internación, "04" Quirúrgico, "05" Atención Inmediata
 *
 * codServicio: código numérico del servicio dentro del grupo (tabla 6.2 Lineamientos v3.2)
 */

// Mapeo de tipo_servicio (UI/IA) → grupoServicios + codServicio por defecto
// Fuente: Lineamientos v3.2 Mayo 2025, Tabla 6.2

interface GrupoServicio {
  grupoServicios: string;
  codServicio: number;
  descripcion: string;
}

const MAPA_TIPO_SERVICIO: Record<string, GrupoServicio> = {
  consulta: { grupoServicios: "01", codServicio: 100, descripcion: "Consulta externa general" },
  urgencias: { grupoServicios: "05", codServicio: 500, descripcion: "Urgencias" },
  cirugia_ambulatoria: { grupoServicios: "04", codServicio: 401, descripcion: "Cirugía ambulatoria" },
  procedimiento_menor: { grupoServicios: "02", codServicio: 202, descripcion: "Procedimiento menor diagnóstico/terapéutico" },
  odontologia: { grupoServicios: "01", codServicio: 106, descripcion: "Odontología" },
};

/**
 * Devuelve grupoServicios y codServicio dinámicos según el tipo de servicio.
 * Si no hay mapeo, defaults a consulta externa ("01", 100).
 */
export function obtenerGrupoServicio(tipoServicio: string): GrupoServicio {
  return MAPA_TIPO_SERVICIO[tipoServicio] || MAPA_TIPO_SERVICIO.consulta!;
}

/**
 * Para procedimientos individuales, determina grupo según el rango CUPS.
 * Rango quirúrgico: códigos que inician con ciertos prefijos.
 * Esto permite que si el servicio principal es "consulta", los procedimientos
 * quirúrgicos dentro igualmente se marquen como grupo "04".
 */
export function obtenerGrupoServicioProcedimiento(
  cupsCodigo: string,
  tipoServicioBase: string
): GrupoServicio {
  const cups = cupsCodigo.replace(/[.\s-]/g, "").toUpperCase();

  // Rangos quirúrgicos CUPS colombianos (Res. 2275 / SOAT)
  // Grupo 4 (Quirúrgico): procedimientos invasivos, cirugías, endoscopias operativas
  // Se identifica por los primeros 2-3 dígitos del CUPS
  const prefijo2 = cups.substring(0, 2);

  // Procedimientos diagnósticos → grupo 02
  const esDiagnostico = ["87", "88", "89", "90", "91", "92", "93"].includes(prefijo2);
  if (esDiagnostico) {
    return { grupoServicios: "02", codServicio: 202, descripcion: "Apoyo diagnóstico/terapéutico" };
  }

  // Procedimientos dentales (CUPS 23xxxx-29xxxx) → grupo 01, codServicio 106
  const prefijo2Num = parseInt(prefijo2, 10);
  if (prefijo2Num >= 23 && prefijo2Num <= 29) {
    return { grupoServicios: "01", codServicio: 106, descripcion: "Odontología" };
  }

  // Si el tipo base ya es cirugía ambulatoria o procedimiento mayor → grupo 04
  if (tipoServicioBase === "cirugia_ambulatoria") {
    return { grupoServicios: "04", codServicio: 401, descripcion: "Cirugía ambulatoria" };
  }

  // Para urgencias, los procedimientos se reportan con grupo 05
  if (tipoServicioBase === "urgencias") {
    return { grupoServicios: "05", codServicio: 500, descripcion: "Urgencias" };
  }

  // Default: usar el grupo del tipo de servicio base
  return obtenerGrupoServicio(tipoServicioBase);
}
