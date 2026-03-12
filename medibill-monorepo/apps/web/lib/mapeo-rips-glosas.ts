/**
 * Servicio de consulta del Mapeo Inverso RIPS → Glosas — Medibill
 *
 * Carga el archivo mapeo_inverso_campo_rips_glosas.json (Res. 2275/2023)
 * y expone funciones para consultar qué glosas puede disparar cada campo RIPS,
 * qué campos son susceptibles a una glosa determinada, y estadísticas de cobertura.
 *
 * Fuente normativa: Anexo Resolución 2275/2023 — Relacionamiento Glosas vs RIPS
 */

import mapeoJson from "@/data/mapeo_inverso_campo_rips_glosas.json";

// =====================================================================
// TIPOS
// =====================================================================

export interface GlosaAsociada {
  codigo_glosa: string;
  nivel: string;
  descripcion: string;
}

export interface CampoRipsMapeo {
  id: string;
  nombre_campo: string;
  categoria_rips: string;
  total_glosas_asociadas: number;
  glosas: GlosaAsociada[];
}

export interface EstadisticaCategoria {
  campos: number;
  total_glosas: number;
  campos_sin_glosas: number;
}

export interface ReporteCobertura {
  total_codigos_mapeo: number;
  codigos_cubiertos: string[];
  codigos_no_cubiertos: string[];
  porcentaje_cobertura: number;
  por_categoria: Record<string, {
    campos_total: number;
    glosas_total: number;
    codigos_unicos: string[];
    codigos_cubiertos: string[];
    porcentaje: number;
  }>;
}

// =====================================================================
// MAPEO FEV-RIPS FIELD PATH → CÓDIGO CAMPO MAPEO
//
// Relaciona los paths del JSON FEV-RIPS (Res. 2275) con los códigos
// de campo del mapeo inverso (T01-T04, U01-U11, C01-C21, etc.)
// =====================================================================

export const CAMPO_FEVRIPS_A_MAPEO: Record<string, string> = {
  // Transacción (T)
  "numDocumentoIdObligado": "T01",
  "numFactura": "T02",
  "tipoNota": "T03",
  "numNota": "T04",

  // Usuarios (U)
  "tipoDocumentoIdentificacion": "U01",
  "numDocumentoIdentificacion": "U02",
  "tipoUsuario": "U03",
  "fechaNacimiento": "U04",
  "codSexo": "U05",
  "codPaisResidencia": "U06",
  "codMunicipioResidencia": "U07",
  "codZonaTerritorialResidencia": "U08",
  "incapacidad": "U09",
  "consecutivo_usuario": "U10",
  "codPaisOrigen": "U11",

  // Consultas (C)
  "consultas.codPrestador": "C01",
  "consultas.fechaInicioAtencion": "C02",
  "consultas.numAutorizacion": "C03",
  "consultas.codConsulta": "C04",
  "consultas.modalidadGrupoServicioTecSal": "C05",
  "consultas.grupoServicios": "C06",
  "consultas.codServicio": "C07",
  "consultas.finalidadTecnologiaSalud": "C08",
  "consultas.causaMotivoAtencion": "C09",
  "consultas.codDiagnosticoPrincipal": "C10",
  "consultas.codDiagnosticoRelacionado1": "C11",
  "consultas.codDiagnosticoRelacionado2": "C12",
  "consultas.codDiagnosticoRelacionado3": "C13",
  "consultas.tipoDiagnosticoPrincipal": "C14",
  "consultas.tipoDocumentoIdentificacion": "C15",
  "consultas.numDocumentoIdentificacion": "C16",
  "consultas.vrServicio": "C17",
  "consultas.conceptoRecaudo": "C18",
  "consultas.valorPagoModerador": "C19",
  "consultas.numFEVPagoModerador": "C20",
  "consultas.consecutivo": "C21",

  // Procedimientos (P)
  "procedimientos.codPrestador": "P01",
  "procedimientos.fechaInicioAtencion": "P02",
  "procedimientos.idMIPRES": "P03",
  "procedimientos.numAutorizacion": "P04",
  "procedimientos.codProcedimiento": "P05",
  "procedimientos.viaIngresoServicioSalud": "P06",
  "procedimientos.modalidadGrupoServicioTecSal": "P07",
  "procedimientos.grupoServicios": "P08",
  "procedimientos.codServicio": "P09",
  "procedimientos.finalidadTecnologiaSalud": "P10",
  "procedimientos.tipoDocumentoIdentificacion": "P11",
  "procedimientos.numDocumentoIdentificacion": "P12",
  "procedimientos.codDiagnosticoPrincipal": "P13",
  "procedimientos.codDiagnosticoRelacionado": "P14",
  "procedimientos.codComplicacion": "P15",
  "procedimientos.vrServicio": "P16",
  "procedimientos.conceptoRecaudo": "P17",
  "procedimientos.valorPagoModerador": "P18",
  "procedimientos.numFEVPagoModerador": "P19",
  "procedimientos.consecutivo": "P20",

  // Urgencias (E)
  "urgencias.codPrestador": "E01",
  "urgencias.fechaInicioAtencion": "E02",
  "urgencias.causaMotivoAtencion": "E03",
  "urgencias.codDiagnosticoPrincipal_ingreso": "E04",
  "urgencias.codDiagnosticoPrincipal_egreso": "E05",
  "urgencias.codDiagnosticoRelacionado1": "E06",
  "urgencias.codDiagnosticoRelacionado2": "E07",
  "urgencias.codDiagnosticoRelacionado3": "E08",
  "urgencias.condicionDestinoUsuarioEgreso": "E09",
  "urgencias.codDiagnosticoCausaMuerte": "E10",
  "urgencias.fechaEgreso": "E11",
  "urgencias.consecutivo": "E12",

  // Hospitalización (H)
  "hospitalizacion.codPrestador": "H01",
  "hospitalizacion.viaIngresoServicioSalud": "H02",
  "hospitalizacion.fechaInicioAtencion": "H03",
  "hospitalizacion.numAutorizacion": "H04",
  "hospitalizacion.causaMotivoAtencion": "H05",
  "hospitalizacion.codDiagnosticoPrincipal_ingreso": "H06",
  "hospitalizacion.codDiagnosticoPrincipal_egreso": "H07",
  "hospitalizacion.codDiagnosticoRelacionado1": "H08",
  "hospitalizacion.codDiagnosticoRelacionado2": "H09",
  "hospitalizacion.codDiagnosticoRelacionado3": "H10",
  "hospitalizacion.codComplicacion": "H11",
  "hospitalizacion.condicionDestinoUsuarioEgreso": "H12",
  "hospitalizacion.codDiagnosticoCausaMuerte": "H13",
  "hospitalizacion.fechaEgreso": "H14",
  "hospitalizacion.consecutivo": "H15",

  // Recién Nacidos (N)
  "recienNacidos.codPrestador": "N01",
  "recienNacidos.tipoDocumentoIdentificacion": "N02",
  "recienNacidos.numDocumentoIdentificacion": "N03",
  "recienNacidos.fechaNacimiento": "N04",
  "recienNacidos.edadGestacional": "N05",
  "recienNacidos.numConsultasCPN": "N06",
  "recienNacidos.codSexo": "N07",
  "recienNacidos.peso": "N08",
  "recienNacidos.codDiagnosticoPrincipal": "N09",
  "recienNacidos.condicionDestinoUsuarioEgreso": "N10",
  "recienNacidos.codDiagnosticoCausaMuerte": "N11",
  "recienNacidos.fechaEgreso": "N12",
  "recienNacidos.consecutivo": "N13",

  // Medicamentos (M)
  "medicamentos.codPrestador": "M01",
  "medicamentos.numAutorizacion": "M02",
  "medicamentos.idMIPRES": "M03",
  "medicamentos.fechaDispensAdmon": "M04",
  "medicamentos.codDiagnosticoPrincipal": "M05",
  "medicamentos.codDiagnosticoRelacionado": "M06",
  "medicamentos.tipoMedicamento": "M07",
  "medicamentos.codTecnologiaSalud": "M08",
  "medicamentos.nomTecnologiaSalud": "M09",
  "medicamentos.concentracionMedicamento": "M10",
  "medicamentos.unidadMedida": "M11",
  "medicamentos.formaFarmaceutica": "M12",
  "medicamentos.unidadMinDispensa": "M13",
  "medicamentos.cantidadMedicamento": "M14",
  "medicamentos.diasTratamiento": "M15",
  "medicamentos.tipoDocumentoIdentificacion": "M16",
  "medicamentos.numDocumentoIdentificacion": "M17",
  "medicamentos.vrUnitMedicamento": "M18",
  "medicamentos.vrServicio": "M19",
  "medicamentos.conceptoRecaudo": "M20",
  "medicamentos.valorPagoModerador": "M21",
  "medicamentos.numFEVPagoModerador": "M22",
  "medicamentos.consecutivo": "M23",

  // Otros Servicios (S)
  "otrosServicios.codPrestador": "S01",
  "otrosServicios.numAutorizacion": "S02",
  "otrosServicios.idMIPRES": "S03",
  "otrosServicios.fechaSuministroTecnologia": "S04",
  "otrosServicios.tipoOtrosServicios": "S05",
  "otrosServicios.codTecnologiaSalud": "S06",
  "otrosServicios.nomTecnologiaSalud": "S07",
  "otrosServicios.cantidad": "S08",
  "otrosServicios.tipoDocumentoIdentificacion": "S09",
  "otrosServicios.numDocumentoIdentificacion": "S10",
  "otrosServicios.vrUnitTecnologia": "S11",
  "otrosServicios.vrServicio": "S12",
  "otrosServicios.conceptoRecaudo": "S13",
  "otrosServicios.valorPagoModerador": "S14",
  "otrosServicios.numFEVPagoModerador": "S15",
  "otrosServicios.consecutivo": "S16",
};

// Índice inverso: código mapeo → path FEV-RIPS
const MAPEO_A_CAMPO_FEVRIPS: Record<string, string> = {};
for (const [path, codigo] of Object.entries(CAMPO_FEVRIPS_A_MAPEO)) {
  MAPEO_A_CAMPO_FEVRIPS[codigo] = path;
}

// =====================================================================
// CARGA Y PARSEO DEL JSON
// =====================================================================

type MapeoRawEntry = {
  nombre_campo: string;
  categoria_rips: string;
  total_glosas_asociadas: number;
  glosas: GlosaAsociada[];
};

const mapeoRaw = mapeoJson.mapeo_campo_glosas as Record<string, MapeoRawEntry>;
const estadisticasRaw = mapeoJson.estadisticas_por_categoria as Record<string, EstadisticaCategoria>;

const todosLosCampos: CampoRipsMapeo[] = Object.entries(mapeoRaw).map(
  ([id, entry]) => ({
    id,
    nombre_campo: entry.nombre_campo,
    categoria_rips: entry.categoria_rips,
    total_glosas_asociadas: entry.total_glosas_asociadas,
    glosas: entry.glosas,
  })
);

// Índice invertido: código glosa → campos que la pueden disparar
const indicePorGlosa = new Map<string, CampoRipsMapeo[]>();
for (const campo of todosLosCampos) {
  for (const g of campo.glosas) {
    const list = indicePorGlosa.get(g.codigo_glosa) ?? [];
    list.push(campo);
    indicePorGlosa.set(g.codigo_glosa, list);
  }
}

// Todos los códigos de glosa únicos presentes en el mapeo
const todosLosCodigosGlosa = [...indicePorGlosa.keys()].sort();

// =====================================================================
// FUNCIONES DE CONSULTA
// =====================================================================

/** Obtiene las glosas asociadas a un campo RIPS dado su código (ej: "C03") */
export function obtenerGlosasPorCampo(campoId: string): GlosaAsociada[] {
  return mapeoRaw[campoId]?.glosas ?? [];
}

/** Obtiene el detalle completo de un campo RIPS dado su código */
export function obtenerCampoRips(campoId: string): CampoRipsMapeo | null {
  const entry = mapeoRaw[campoId];
  if (!entry) return null;
  return { id: campoId, ...entry };
}

/** Obtiene todos los campos que pueden disparar una glosa específica */
export function obtenerCamposPorGlosa(codigoGlosa: string): CampoRipsMapeo[] {
  return indicePorGlosa.get(codigoGlosa) ?? [];
}

/** Obtiene campos filtrados por categoría RIPS */
export function obtenerCamposPorCategoria(categoria: string): CampoRipsMapeo[] {
  return todosLosCampos.filter((c) => c.categoria_rips === categoria);
}

/** Obtiene las estadísticas por categoría del mapeo original */
export function obtenerEstadisticasPorCategoria(): Record<string, EstadisticaCategoria> {
  return estadisticasRaw;
}

/** Obtiene todos los campos del mapeo */
export function obtenerTodosLosCampos(): CampoRipsMapeo[] {
  return todosLosCampos;
}

/** Obtiene todos los códigos de glosa únicos presentes en el mapeo */
export function obtenerTodosLosCodigosGlosa(): string[] {
  return todosLosCodigosGlosa;
}

/**
 * Traduce un path de campo FEV-RIPS al código del mapeo.
 * Ej: "consultas.numAutorizacion" → "C03"
 */
export function campoFevRipsACodigo(pathCampo: string): string | null {
  return CAMPO_FEVRIPS_A_MAPEO[pathCampo] ?? null;
}

/**
 * Traduce un código del mapeo al path de campo FEV-RIPS.
 * Ej: "C03" → "consultas.numAutorizacion"
 */
export function codigoAcampoFevRips(codigo: string): string | null {
  return MAPEO_A_CAMPO_FEVRIPS[codigo] ?? null;
}

/**
 * Dado un path de campo FEV-RIPS, retorna las glosas asociadas.
 * Combina la traducción del path con la consulta al mapeo.
 */
export function obtenerGlosasPorCampoFevRips(pathCampo: string): GlosaAsociada[] {
  const codigo = campoFevRipsACodigo(pathCampo);
  if (!codigo) return [];
  return obtenerGlosasPorCampo(codigo);
}

// =====================================================================
// REPORTE DE COBERTURA
// =====================================================================

/**
 * Genera un reporte de cobertura cruzando los códigos de glosa del mapeo
 * contra los códigos que el validador actual puede detectar.
 */
export function generarReporteCobertura(codigosCubiertosValidador: string[]): ReporteCobertura {
  const setCubiertos = new Set(codigosCubiertosValidador);

  const cubiertos = todosLosCodigosGlosa.filter((c) => setCubiertos.has(c));
  const noCubiertos = todosLosCodigosGlosa.filter((c) => !setCubiertos.has(c));

  // Por categoría
  const categorias = new Set(todosLosCampos.map((c) => c.categoria_rips));
  const porCategoria: ReporteCobertura["por_categoria"] = {};

  for (const cat of categorias) {
    const camposCat = todosLosCampos.filter((c) => c.categoria_rips === cat);
    const codigosUnicos = new Set<string>();
    for (const campo of camposCat) {
      for (const g of campo.glosas) {
        codigosUnicos.add(g.codigo_glosa);
      }
    }
    const codigosArr = [...codigosUnicos];
    const cubiertosEnCat = codigosArr.filter((c) => setCubiertos.has(c));

    porCategoria[cat] = {
      campos_total: camposCat.length,
      glosas_total: camposCat.reduce((s, c) => s + c.total_glosas_asociadas, 0),
      codigos_unicos: codigosArr,
      codigos_cubiertos: cubiertosEnCat,
      porcentaje: codigosArr.length > 0
        ? Math.round((cubiertosEnCat.length / codigosArr.length) * 100)
        : 100,
    };
  }

  return {
    total_codigos_mapeo: todosLosCodigosGlosa.length,
    codigos_cubiertos: cubiertos,
    codigos_no_cubiertos: noCubiertos,
    porcentaje_cobertura: todosLosCodigosGlosa.length > 0
      ? Math.round((cubiertos.length / todosLosCodigosGlosa.length) * 100)
      : 100,
    por_categoria: porCategoria,
  };
}

/**
 * Códigos de glosa que el validador actual (ValidadorPreRadicacion) puede emitir.
 * Se mantiene sincronizado manualmente con las reglas del validador.
 */
export const CODIGOS_CUBIERTOS_VALIDADOR: string[] = [
  "DE5601", "DE5001", "DE5002",
  "SO3405", "SO3406", "SO3401", "SO3701", "SO2101",
  "FA0201", "FA5801", "FA0701", "FA2702", "FA5803", "FA1905", "FA2006",
  "FA2301", "FA0301", "FA5401", "DE5401",
  "AU0101", "AU0201",
  "DE4401", "DE4402",
  "TA0201", "TA0801", "TA5801", "TA0701", "TA2901",
  "DE1601", "DE1602", "DE1603", "FA1605",
  "PE0101", "PE0102", "PE0201",
  "SO0301",
];

/** Genera el reporte de cobertura con los códigos conocidos del validador */
export function obtenerReporteCoberturaActual(): ReporteCobertura {
  return generarReporteCobertura(CODIGOS_CUBIERTOS_VALIDADOR);
}

// =====================================================================
// CATEGORÍAS DISPONIBLES
// =====================================================================

export const CATEGORIAS_RIPS = [
  "Datos relativos a la transacción",
  "Datos relativos a los usuarios",
  "Datos de las consultas",
  "Datos de los procedimientos",
  "Datos de la urgencia con observación",
  "Datos de hospitalización",
  "Datos de recién nacido",
  "Registro de datos de medicamentos",
  "Datos de otros servicios",
] as const;

export type CategoriaRips = (typeof CATEGORIAS_RIPS)[number];
