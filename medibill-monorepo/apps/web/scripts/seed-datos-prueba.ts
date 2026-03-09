/**
 * Seed Script — Datos de Prueba para el Sistema Anti-Glosas → Supabase
 *
 * Inserta prestador (acuerdos), pacientes (inline en facturas) y 7 facturas
 * con escenarios diseñados para probar cada regla del validador pre-radicación.
 *
 * Uso:
 *   npx tsx scripts/seed-datos-prueba.ts          # Limpiar + insertar
 *   npx tsx scripts/seed-datos-prueba.ts --clean   # Solo limpiar
 *
 * Requiere:
 *   - Variables de entorno en .env.local
 *   - Tablas creadas (ver schema-glosas.sql)
 *   - Catálogo de causales poblado (ver seed-catalogo-glosas.ts)
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

// Cargar .env.local
dotenv.config({ path: resolve(import.meta.dirname ?? __dirname, "../.env.local") });

// =====================================================================
// CONFIG
// =====================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Marca para identificar datos de prueba en metadata/observaciones */
const MARCA_PRUEBA = "es_dato_prueba";

// =====================================================================
// UTILIDADES DE FECHA
// =====================================================================

/** Resta N días hábiles (lun-vie) a una fecha */
function restarDiasHabiles(fecha: Date, n: number): Date {
  const result = new Date(fecha);
  let conteo = 0;
  while (conteo < n) {
    result.setDate(result.getDate() - 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) conteo++;
  }
  return result;
}

/** Formatea fecha como YYYY-MM-DD */
function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Formatea fecha como YYYY-MM-DD HH:MM */
function fechaHoraRips(d: Date, hora = "08:00"): string {
  return `${fechaISO(d)} ${hora}`;
}

// =====================================================================
// DATOS DEL PRESTADOR
// =====================================================================

const PRESTADOR = {
  nit: "12345678-9",
  nombre: "Dr. Carlos Andrés Muñoz Rivera",
  tipo: "profesional_independiente",
  ciudad: "Pasto, Nariño",
  especialidad: "Medicina General",
  cod_habilitacion: "520010001", // ficticio
};

// =====================================================================
// PACIENTES
// =====================================================================

interface Paciente {
  nombre: string;
  apellidos: string;
  documento: string;
  tipo_documento: "CC" | "TI" | "RC";
  sexo: "M" | "F";
  fecha_nacimiento: string;
  eps_codigo: string;
  tipo_afiliado: "C" | "S";
  categoria: "A" | "B" | "C";
}

const PACIENTES: Record<string, Paciente> = {
  maria: {
    nombre: "María José",
    apellidos: "López Guerrero",
    documento: "27654321",
    tipo_documento: "CC",
    sexo: "F",
    fecha_nacimiento: "1985-03-15",
    eps_codigo: "EPS-S01",
    tipo_afiliado: "C",
    categoria: "B",
  },
  juan: {
    nombre: "Juan David",
    apellidos: "Martínez Coral",
    documento: "12876543",
    tipo_documento: "CC",
    sexo: "M",
    fecha_nacimiento: "1970-08-22",
    eps_codigo: "EPS-S01",
    tipo_afiliado: "C",
    categoria: "A",
  },
  ana: {
    nombre: "Ana Lucía",
    apellidos: "Pantoja Delgado",
    documento: "59123456",
    tipo_documento: "CC",
    sexo: "F",
    fecha_nacimiento: "1995-11-30",
    eps_codigo: "EPS-S03",
    tipo_afiliado: "S",
    categoria: "A",
  },
  pedro: {
    nombre: "Pedro Nel",
    apellidos: "Castillo Ruiz",
    documento: "87654321",
    tipo_documento: "TI",
    sexo: "M",
    fecha_nacimiento: "2020-02-14",
    eps_codigo: "EPS-S01",
    tipo_afiliado: "S",
    categoria: "A",
  },
  carmen: {
    nombre: "Carmen Rosa",
    apellidos: "Erazo Burbano",
    documento: "31987654",
    tipo_documento: "CC",
    sexo: "F",
    fecha_nacimiento: "1950-06-08",
    eps_codigo: "EPS-S03",
    tipo_afiliado: "C",
    categoria: "C",
  },
};

// =====================================================================
// ACUERDOS DE VOLUNTADES
// =====================================================================

interface AcuerdoSeed {
  eps_codigo: string;
  nombre_eps: string;
  fecha_inicio: string;
  fecha_fin: string;
  requiere_autorizacion: boolean;
  tarifario_base: string;
  porcentaje_sobre_base: number;
  observaciones: string;
  tarifas: { cups_codigo: string; valor_pactado: number }[];
}

const ACUERDOS: AcuerdoSeed[] = [
  {
    eps_codigo: "EPS-S01",
    nombre_eps: "Emssanar EPS-S",
    fecha_inicio: "2025-01-01",
    fecha_fin: "2025-12-31",
    requiere_autorizacion: true,
    tarifario_base: "ISS 2001",
    porcentaje_sobre_base: 130,
    observaciones: `Requiere autorización excepto urgencias y consulta de primera vez. ${MARCA_PRUEBA}`,
    tarifas: [
      { cups_codigo: "890201", valor_pactado: 65_000 },
      { cups_codigo: "890301", valor_pactado: 85_000 },
      { cups_codigo: "902210", valor_pactado: 15_000 },
      { cups_codigo: "903841", valor_pactado: 8_000 },
      { cups_codigo: "890701", valor_pactado: 75_000 },
    ],
  },
  {
    eps_codigo: "EPS-S03",
    nombre_eps: "Nueva EPS",
    fecha_inicio: "2025-03-01",
    fecha_fin: "2026-02-28",
    requiere_autorizacion: false,
    tarifario_base: "SOAT UVB",
    porcentaje_sobre_base: 100,
    observaciones: `No requiere autorización para consultas. Sí para procedimientos. ${MARCA_PRUEBA}`,
    tarifas: [
      { cups_codigo: "890201", valor_pactado: 55_000 },
      { cups_codigo: "890301", valor_pactado: 72_000 },
      { cups_codigo: "902210", valor_pactado: 12_000 },
    ],
  },
];

// =====================================================================
// HELPERS PARA FEV-RIPS
// =====================================================================

function crearUsuarioRips(p: Paciente): any {
  return {
    tipoDocumentoIdentificacion: p.tipo_documento,
    numDocumentoIdentificacion: p.documento,
    tipoUsuario: p.tipo_afiliado === "C" ? "01" : "02",
    fechaNacimiento: p.fecha_nacimiento,
    codSexo: p.sexo,
    codPaisResidencia: "170",
    codMunicipioResidencia: "52001", // Pasto
    codZonaTerritorialResidencia: "U",
    incapacidad: "NO",
    codEntidadAdministradora: "",
    consecutivo: 1,
  };
}

function crearConsultaRips(opts: {
  paciente: Paciente;
  cups: string;
  diagnostico: string;
  valor: number;
  autorizacion?: string | null;
  fecha?: string;
  consecutivo?: number;
}): any {
  return {
    codPrestador: PRESTADOR.cod_habilitacion,
    fechaInicioAtencion: opts.fecha ?? fechaHoraRips(new Date()),
    numAutorizacion: opts.autorizacion ?? null,
    codConsulta: opts.cups,
    modalidadGrupoServicioTecSal: "01",
    grupoServicios: "01",
    codServicio: 1,
    finalidadTecnologiaSalud: "01",
    causaMotivoAtencion: "01",
    codDiagnosticoPrincipal: opts.diagnostico,
    codDiagnosticoRelacionado1: null,
    codDiagnosticoRelacionado2: null,
    codDiagnosticoRelacionado3: null,
    tipoDiagnosticoPrincipal: "01",
    tipoDocumentoIdentificacion: opts.paciente.tipo_documento,
    numDocumentoIdentificacion: opts.paciente.documento,
    vrServicio: opts.valor,
    conceptoRecaudo: opts.paciente.tipo_afiliado === "C" ? "01" : "05",
    valorPagoModerador: 0,
    numFEVPagoModerador: null,
    consecutivo: opts.consecutivo ?? 1,
  };
}

function crearProcedimientoRips(opts: {
  paciente: Paciente;
  cups: string;
  diagnostico: string;
  valor: number;
  autorizacion?: string | null;
  fecha?: string;
  consecutivo?: number;
}): any {
  return {
    codPrestador: PRESTADOR.cod_habilitacion,
    fechaInicioAtencion: opts.fecha ?? fechaHoraRips(new Date()),
    idMIPRES: null,
    numAutorizacion: opts.autorizacion ?? null,
    codProcedimiento: opts.cups,
    viaIngresoServicioSalud: "01",
    modalidadGrupoServicioTecSal: "01",
    grupoServicios: "01",
    codServicio: 1,
    finalidadTecnologiaSalud: "02",
    tipoDocumentoIdentificacion: opts.paciente.tipo_documento,
    numDocumentoIdentificacion: opts.paciente.documento,
    codDiagnosticoPrincipal: opts.diagnostico,
    codDiagnosticoRelacionado: null,
    codComplicacion: null,
    vrServicio: opts.valor,
    conceptoRecaudo: opts.paciente.tipo_afiliado === "C" ? "01" : "05",
    valorPagoModerador: 0,
    numFEVPagoModerador: null,
    consecutivo: opts.consecutivo ?? 1,
  };
}

function crearFevRips(opts: {
  numFactura: string;
  usuarios: any[];
  consultas?: any[];
  procedimientos?: any[];
}): any {
  return {
    numDocumentoIdObligado: PRESTADOR.nit,
    numFactura: opts.numFactura,
    numObligacion: "",
    tipoNota: null,
    numNota: null,
    usuarios: opts.usuarios.map((u: any) => ({
      ...u,
      servicios: {
        consultas: opts.consultas ?? [],
        procedimientos: opts.procedimientos ?? [],
        urgencias: [],
        hospitalizacion: [],
        recienNacidos: [],
        medicamentos: [],
        otrosServicios: [],
      },
    })),
  };
}

function crearSoportesCompletos(): any {
  return {
    tiene_resumen_atencion: true,
    tiene_epicrisis: false,
    tiene_descripcion_qx: false,
    tiene_registro_anestesia: false,
    tiene_hoja_medicamentos: false,
    tiene_comprobante_recibido: true,
    tiene_hoja_traslado: false,
    tiene_orden_prescripcion: true,
    tiene_hoja_urgencias: false,
    tiene_hoja_odontologica: false,
    tiene_lista_precios: false,
    tiene_evidencia_envio_tramite: false,
  };
}

function crearSoportesVacios(): any {
  return {
    tiene_resumen_atencion: false,
    tiene_epicrisis: false,
    tiene_descripcion_qx: false,
    tiene_registro_anestesia: false,
    tiene_hoja_medicamentos: false,
    tiene_comprobante_recibido: false,
    tiene_hoja_traslado: false,
    tiene_orden_prescripcion: false,
    tiene_hoja_urgencias: false,
    tiene_hoja_odontologica: false,
    tiene_lista_precios: false,
    tiene_evidencia_envio_tramite: false,
  };
}

function crearPacienteFactura(p: Paciente): any {
  return {
    tipo_documento: p.tipo_documento,
    numero_documento: p.documento,
    nombres: p.nombre,
    apellidos: p.apellidos,
    fecha_nacimiento: p.fecha_nacimiento,
    sexo: p.sexo,
    tipo_afiliado: p.tipo_afiliado,
    categoria: p.categoria,
  };
}

function crearServicioFactura(opts: {
  cups: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  diagnostico: string;
  autorizacion?: string;
  tipo_servicio?: string;
  fecha?: string;
}): any {
  return {
    cups_codigo: opts.cups,
    descripcion: opts.descripcion,
    cantidad: opts.cantidad,
    valor_unitario: opts.valor_unitario,
    valor_total: opts.cantidad * opts.valor_unitario,
    fecha_prestacion: opts.fecha ?? fechaISO(new Date()),
    diagnostico_principal: opts.diagnostico,
    numero_autorizacion: opts.autorizacion,
    tipo_servicio: opts.tipo_servicio ?? "consulta",
  };
}

// =====================================================================
// GENERACIÓN DE FACTURAS
// =====================================================================

interface FacturaSeed {
  num_factura: string;
  descripcion: string;
  paciente: Paciente;
  eps_codigo: string;
  fecha_expedicion_fev: string;
  valor_total: number;
  fev_rips_json: any;
  metadata: any;
  glosas_esperadas: string[];
}

function generarFacturas(userId: string): FacturaSeed[] {
  const hoy = new Date();
  const facturas: FacturaSeed[] = [];

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 1 — PERFECTA (debe pasar todas las validaciones)
  // ─────────────────────────────────────────────────────────────────
  const f1_fecha = restarDiasHabiles(hoy, 5);
  const f1_paciente = PACIENTES.maria!;
  facturas.push({
    num_factura: "FEV-PRUEBA-001",
    descripcion: "PERFECTA — debe pasar todas las validaciones",
    paciente: f1_paciente,
    eps_codigo: "EPS-S01",
    fecha_expedicion_fev: fechaISO(f1_fecha),
    valor_total: 65_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-001",
      usuarios: [crearUsuarioRips(f1_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f1_paciente,
          cups: "890201",
          diagnostico: "J06",
          valor: 65_000,
          autorizacion: "AUT-2025-001",
          fecha: fechaHoraRips(f1_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "perfecta",
      paciente: crearPacienteFactura(f1_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 65_000,
          diagnostico: "J06",
          autorizacion: "AUT-2025-001",
          fecha: fechaISO(f1_fecha),
        }),
      ],
      soportes: crearSoportesCompletos(),
      fecha_expedicion_fev: fechaISO(f1_fecha),
      fecha_radicacion_prevista: fechaISO(hoy),
      copago_recaudado: 3_500,
      copago_calculado: 3_500,
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: [],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 2 — ERROR DE TARIFA (TA0201)
  // Cobrada $95,000 vs pactada $65,000
  // ─────────────────────────────────────────────────────────────────
  const f2_fecha = restarDiasHabiles(hoy, 5);
  const f2_paciente = PACIENTES.juan!;
  facturas.push({
    num_factura: "FEV-PRUEBA-002",
    descripcion: "ERROR DE TARIFA — debe detectar TA0201",
    paciente: f2_paciente,
    eps_codigo: "EPS-S01",
    fecha_expedicion_fev: fechaISO(f2_fecha),
    valor_total: 95_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-002",
      usuarios: [crearUsuarioRips(f2_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f2_paciente,
          cups: "890201",
          diagnostico: "I10",
          valor: 95_000,
          autorizacion: "AUT-2025-002",
          fecha: fechaHoraRips(f2_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "error_tarifa",
      paciente: crearPacienteFactura(f2_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 95_000, // ← ERROR: pactada es $65,000
          diagnostico: "I10",
          autorizacion: "AUT-2025-002",
          fecha: fechaISO(f2_fecha),
        }),
      ],
      soportes: crearSoportesCompletos(),
      fecha_expedicion_fev: fechaISO(f2_fecha),
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["TA0201"],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 3 — SIN SOPORTES (SO3405, SO3701)
  // ─────────────────────────────────────────────────────────────────
  const f3_fecha = restarDiasHabiles(hoy, 5);
  const f3_paciente = PACIENTES.ana!;
  facturas.push({
    num_factura: "FEV-PRUEBA-003",
    descripcion: "SIN SOPORTES — debe detectar SO3405, SO3701",
    paciente: f3_paciente,
    eps_codigo: "EPS-S03",
    fecha_expedicion_fev: fechaISO(f3_fecha),
    valor_total: 55_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-003",
      usuarios: [crearUsuarioRips(f3_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f3_paciente,
          cups: "890201",
          diagnostico: "J06",
          valor: 55_000,
          autorizacion: null,
          fecha: fechaHoraRips(f3_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "sin_soportes",
      paciente: crearPacienteFactura(f3_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 55_000,
          diagnostico: "J06",
          fecha: fechaISO(f3_fecha),
        }),
      ],
      soportes: {
        ...crearSoportesVacios(),
        // Sin resumen de atención ni orden/prescripción
        tiene_resumen_atencion: false,
        tiene_orden_prescripcion: false,
      },
      fecha_expedicion_fev: fechaISO(f3_fecha),
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["SO3405", "SO3701"],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 4 — DIAGNÓSTICO INCOHERENTE CON SEXO (PE0101)
  // Paciente HOMBRE con diagnóstico N92 (ginecológico)
  // ─────────────────────────────────────────────────────────────────
  const f4_fecha = restarDiasHabiles(hoy, 5);
  const f4_paciente = PACIENTES.juan!;
  facturas.push({
    num_factura: "FEV-PRUEBA-004",
    descripcion: "DX INCOHERENTE CON SEXO — debe detectar PE0101",
    paciente: f4_paciente,
    eps_codigo: "EPS-S01",
    fecha_expedicion_fev: fechaISO(f4_fecha),
    valor_total: 65_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-004",
      usuarios: [crearUsuarioRips(f4_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f4_paciente,
          cups: "890201",
          diagnostico: "N92", // ← ERROR: N92 es ginecológico, paciente es hombre
          valor: 65_000,
          autorizacion: "AUT-2025-004",
          fecha: fechaHoraRips(f4_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "dx_incoherente_sexo",
      paciente: crearPacienteFactura(f4_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 65_000,
          diagnostico: "N92",
          autorizacion: "AUT-2025-004",
          fecha: fechaISO(f4_fecha),
        }),
      ],
      soportes: crearSoportesCompletos(),
      fecha_expedicion_fev: fechaISO(f4_fecha),
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["PE0101"],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 5 — FUERA DE PLAZO (DE5601)
  // Fecha FEV hace 30 días hábiles (límite = 22)
  // ─────────────────────────────────────────────────────────────────
  const f5_fecha = restarDiasHabiles(hoy, 30);
  const f5_paciente = PACIENTES.carmen!;
  facturas.push({
    num_factura: "FEV-PRUEBA-005",
    descripcion: "FUERA DE PLAZO — debe detectar DE5601",
    paciente: f5_paciente,
    eps_codigo: "EPS-S03",
    fecha_expedicion_fev: fechaISO(f5_fecha),
    valor_total: 55_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-005",
      usuarios: [crearUsuarioRips(f5_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f5_paciente,
          cups: "890201",
          diagnostico: "J06",
          valor: 55_000,
          autorizacion: null,
          fecha: fechaHoraRips(f5_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "fuera_de_plazo",
      paciente: crearPacienteFactura(f5_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 55_000,
          diagnostico: "J06",
          fecha: fechaISO(f5_fecha),
        }),
      ],
      soportes: crearSoportesCompletos(),
      fecha_expedicion_fev: fechaISO(f5_fecha), // ← 30 días hábiles atrás
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["DE5601"],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 6 — SIN AUTORIZACIÓN (AU0101, SO2101)
  // Ecografía sin autorización en EPS que la requiere
  // ─────────────────────────────────────────────────────────────────
  const f6_fecha = restarDiasHabiles(hoy, 5);
  const f6_paciente = PACIENTES.maria!;
  facturas.push({
    num_factura: "FEV-PRUEBA-006",
    descripcion: "SIN AUTORIZACIÓN — debe detectar AU0101, SO2101",
    paciente: f6_paciente,
    eps_codigo: "EPS-S01",
    fecha_expedicion_fev: fechaISO(f6_fecha),
    valor_total: 120_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-006",
      usuarios: [crearUsuarioRips(f6_paciente)],
      procedimientos: [
        crearProcedimientoRips({
          paciente: f6_paciente,
          cups: "881302",
          diagnostico: "R10",
          valor: 120_000,
          autorizacion: null, // ← SIN AUTORIZACIÓN
          fecha: fechaHoraRips(f6_fecha),
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "sin_autorizacion",
      paciente: crearPacienteFactura(f6_paciente),
      servicios: [
        crearServicioFactura({
          cups: "881302",
          descripcion: "Ecografía de abdomen total",
          cantidad: 1,
          valor_unitario: 120_000,
          diagnostico: "R10",
          tipo_servicio: "apoyo_dx",
          fecha: fechaISO(f6_fecha),
          // Sin autorización
        }),
      ],
      soportes: crearSoportesCompletos(),
      fecha_expedicion_fev: fechaISO(f6_fecha),
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["AU0101", "SO2101"],
  });

  // ─────────────────────────────────────────────────────────────────
  // FACTURA 7 — MÚLTIPLES ERRORES (peor caso)
  // Pedro Nel (niño 5 años, hombre):
  //   - Consulta $95,000 (pactada $65,000) → TA0201
  //   - Hemograma $25,000 (pactado $15,000) → TA0801
  //   - Dx N92 (ginecológico en hombre) → PE0101
  //   - Sin resumen de atención → SO3405
  //   - Sin autorización → AU0101
  //   - FEV hace 24 días hábiles → DE5601
  // ─────────────────────────────────────────────────────────────────
  const f7_fecha = restarDiasHabiles(hoy, 24);
  const f7_paciente = PACIENTES.pedro!;
  facturas.push({
    num_factura: "FEV-PRUEBA-007",
    descripcion: "MÚLTIPLES ERRORES — debe detectar TA0201, TA0801, PE0101, SO3405, AU0101, DE5601",
    paciente: f7_paciente,
    eps_codigo: "EPS-S01",
    fecha_expedicion_fev: fechaISO(f7_fecha),
    valor_total: 120_000,
    fev_rips_json: crearFevRips({
      numFactura: "FEV-PRUEBA-007",
      usuarios: [crearUsuarioRips(f7_paciente)],
      consultas: [
        crearConsultaRips({
          paciente: f7_paciente,
          cups: "890201",
          diagnostico: "N92", // ← Dx ginecológico en niño hombre
          valor: 95_000,      // ← Tarifa incorrecta ($65,000 pactada)
          autorizacion: null, // ← Sin autorización
          fecha: fechaHoraRips(f7_fecha),
          consecutivo: 1,
        }),
      ],
      procedimientos: [
        crearProcedimientoRips({
          paciente: f7_paciente,
          cups: "902210",
          diagnostico: "N92",
          valor: 25_000,      // ← Tarifa incorrecta ($15,000 pactada)
          autorizacion: null, // ← Sin autorización
          fecha: fechaHoraRips(f7_fecha),
          consecutivo: 2,
        }),
      ],
    }),
    metadata: {
      [MARCA_PRUEBA]: true,
      escenario: "multiples_errores",
      paciente: crearPacienteFactura(f7_paciente),
      servicios: [
        crearServicioFactura({
          cups: "890201",
          descripcion: "Consulta de medicina general",
          cantidad: 1,
          valor_unitario: 95_000, // ← ERROR tarifa
          diagnostico: "N92",     // ← ERROR dx incoherente con sexo
          fecha: fechaISO(f7_fecha),
        }),
        crearServicioFactura({
          cups: "902210",
          descripcion: "Hemograma completo",
          cantidad: 1,
          valor_unitario: 25_000, // ← ERROR tarifa
          diagnostico: "N92",
          tipo_servicio: "apoyo_dx",
          fecha: fechaISO(f7_fecha),
        }),
      ],
      soportes: {
        ...crearSoportesVacios(),
        tiene_resumen_atencion: false, // ← ERROR: falta soporte
        tiene_orden_prescripcion: false,
      },
      fecha_expedicion_fev: fechaISO(f7_fecha), // ← ERROR: 24 días hábiles
      fecha_radicacion_prevista: fechaISO(hoy),
      es_urgencia: false,
      tiene_contrato: true,
    },
    glosas_esperadas: ["TA0201", "TA0801", "PE0101", "SO3405", "AU0101", "DE5601"],
  });

  return facturas;
}

// =====================================================================
// REGLAS DE COHERENCIA SEXO-DIAGNÓSTICO
// =====================================================================

const REGLAS_COHERENCIA = [
  {
    tipo: "sexo_diagnostico",
    codigo_referencia: "N92",
    condicion: { sexo: "F" },
    mensaje_error: "El diagnóstico N92 (Menstruación excesiva, frecuente e irregular) solo aplica a pacientes de sexo femenino",
    severidad: "error",
    activo: true,
  },
  {
    tipo: "sexo_diagnostico",
    codigo_referencia: "N91",
    condicion: { sexo: "F" },
    mensaje_error: "El diagnóstico N91 (Amenorrea) solo aplica a pacientes de sexo femenino",
    severidad: "error",
    activo: true,
  },
  {
    tipo: "sexo_diagnostico",
    codigo_referencia: "N93",
    condicion: { sexo: "F" },
    mensaje_error: "El diagnóstico N93 (Otra hemorragia uterina o vaginal) solo aplica a pacientes de sexo femenino",
    severidad: "error",
    activo: true,
  },
  {
    tipo: "sexo_diagnostico",
    codigo_referencia: "O80",
    condicion: { sexo: "F" },
    mensaje_error: "Diagnóstico obstétrico O80 solo aplica a pacientes femeninas",
    severidad: "error",
    activo: true,
  },
  {
    tipo: "sexo_diagnostico",
    codigo_referencia: "N40",
    condicion: { sexo: "M" },
    mensaje_error: "El diagnóstico N40 (Hipertrofia de próstata) solo aplica a pacientes masculinos",
    severidad: "error",
    activo: true,
  },
];

// =====================================================================
// LIMPIEZA
// =====================================================================

async function limpiarDatosPrueba() {
  console.log("\n🗑️  Limpiando datos de prueba existentes...\n");

  // 1. Eliminar validaciones de facturas de prueba
  const { data: facturasPrueba } = await supabase
    .from("facturas")
    .select("id")
    .contains("metadata", { [MARCA_PRUEBA]: true });

  const idsFacturas = (facturasPrueba ?? []).map((f) => f.id);

  if (idsFacturas.length > 0) {
    // Eliminar validaciones_factura (tabla activa)
    const { error: e1 } = await supabase
      .from("validaciones_factura")
      .delete()
      .in("factura_id", idsFacturas);
    if (e1) console.warn("   ⚠️  validaciones_factura:", e1.message);
    else console.log(`   ✓ validaciones_factura eliminadas`);

    // Eliminar validaciones_pre_radicacion (tabla legacy, graceful)
    try {
      const { error: e1b } = await supabase
        .from("validaciones_pre_radicacion")
        .delete()
        .in("factura_id", idsFacturas);
      if (!e1b) console.log(`   ✓ validaciones_pre_radicacion eliminadas (legacy)`);
    } catch { /* tabla puede no existir */ }

    // Eliminar auditoria_plazos (tabla legacy, graceful)
    try {
      const { error: e2 } = await supabase
        .from("auditoria_plazos")
        .delete()
        .in("entidad_id", idsFacturas);
      if (!e2) console.log(`   ✓ auditoria_plazos eliminadas (legacy)`);
    } catch { /* tabla puede no existir */ }

    // Eliminar respuestas de glosas recibidas (vía glosas_recibidas)
    const { data: glosasRecibidasPrueba } = await supabase
      .from("glosas_recibidas")
      .select("id")
      .in("factura_id", idsFacturas);
    const idsGlosasRecibidas = (glosasRecibidasPrueba ?? []).map((g) => g.id);
    if (idsGlosasRecibidas.length > 0) {
      const { error: e3b } = await supabase
        .from("respuestas_glosas")
        .delete()
        .in("glosa_id", idsGlosasRecibidas);
      if (e3b) console.warn("   ⚠️  respuestas_glosas:", e3b.message);
      else console.log(`   ✓ respuestas_glosas eliminadas`);
    }

    // Eliminar glosas_recibidas
    const { error: e3c } = await supabase
      .from("glosas_recibidas")
      .delete()
      .in("factura_id", idsFacturas);
    if (e3c) console.warn("   ⚠️  glosas_recibidas:", e3c.message);
    else console.log(`   ✓ glosas_recibidas eliminadas`);

    // Eliminar respuestas_glosa legacy (vía glosas)
    const { data: glosasPrueba } = await supabase
      .from("glosas")
      .select("id")
      .in("factura_id", idsFacturas);
    const idsGlosas = (glosasPrueba ?? []).map((g) => g.id);
    if (idsGlosas.length > 0) {
      try {
        const { error: e3 } = await supabase
          .from("respuestas_glosa")
          .delete()
          .in("glosa_id", idsGlosas);
        if (!e3) console.log(`   ✓ respuestas_glosa eliminadas (legacy)`);
      } catch { /* tabla legacy puede no existir */ }
    }

    // Eliminar glosas
    const { error: e4 } = await supabase
      .from("glosas")
      .delete()
      .in("factura_id", idsFacturas);
    if (e4) console.warn("   ⚠️  glosas:", e4.message);
    else console.log(`   ✓ glosas eliminadas`);

    // Eliminar facturas
    const { error: e5 } = await supabase
      .from("facturas")
      .delete()
      .in("id", idsFacturas);
    if (e5) console.warn("   ⚠️  facturas:", e5.message);
    else console.log(`   ✓ ${idsFacturas.length} facturas de prueba eliminadas`);
  } else {
    console.log("   (No hay facturas de prueba previas)");
  }

  // 2. Eliminar acuerdo_tarifas + acuerdos_voluntades de prueba
  const { data: acuerdosPrueba } = await supabase
    .from("acuerdos_voluntades")
    .select("id")
    .like("observaciones", `%${MARCA_PRUEBA}%`);

  const idsAcuerdos = (acuerdosPrueba ?? []).map((a) => a.id);
  if (idsAcuerdos.length > 0) {
    // Las tarifas se eliminan en cascada gracias a ON DELETE CASCADE
    const { error: e6 } = await supabase
      .from("acuerdos_voluntades")
      .delete()
      .in("id", idsAcuerdos);
    if (e6) console.warn("   ⚠️  acuerdos_voluntades:", e6.message);
    else console.log(`   ✓ ${idsAcuerdos.length} acuerdos de prueba eliminados (+ tarifas en cascada)`);
  } else {
    console.log("   (No hay acuerdos de prueba previos)");
  }

  // 3. Eliminar reglas de coherencia de prueba (las que coinciden con nuestros códigos)
  const codigosReglas = REGLAS_COHERENCIA.map((r) => r.codigo_referencia);
  const { error: e7 } = await supabase
    .from("reglas_coherencia")
    .delete()
    .in("codigo_referencia", codigosReglas);
  if (e7) console.warn("   ⚠️  reglas_coherencia:", e7.message);
  else console.log(`   ✓ reglas_coherencia de prueba eliminadas`);

  console.log("\n✅ Limpieza completada.\n");
}

// =====================================================================
// INSERCIÓN
// =====================================================================

async function obtenerUserIdActivo(): Promise<string> {
  // Intentar obtener un usuario existente de la tabla auth.users vía admin API
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.error("❌ No se pudo listar usuarios:", error.message);
    console.log("   Tip: Asegúrate de tener al menos un usuario registrado en Supabase.");
    process.exit(1);
  }
  if (!data.users || data.users.length === 0) {
    console.error("❌ No hay usuarios registrados en Supabase.");
    console.log("   Tip: Registra un usuario en /login primero.");
    process.exit(1);
  }
  const user = data.users[0]!;
  console.log(`👤 Usuario encontrado: ${user.email ?? user.id}`);
  return user.id;
}

async function insertarAcuerdos(userId: string): Promise<Map<string, string>> {
  console.log("\n📋 Insertando acuerdos de voluntades...\n");
  const mapaAcuerdos = new Map<string, string>(); // eps_codigo → acuerdo_id

  for (const acuerdo of ACUERDOS) {
    // Insertar acuerdo
    const { data, error } = await supabase
      .from("acuerdos_voluntades")
      .insert({
        prestador_id: userId,
        eps_codigo: acuerdo.eps_codigo,
        nombre_eps: acuerdo.nombre_eps,
        fecha_inicio: acuerdo.fecha_inicio,
        fecha_fin: acuerdo.fecha_fin,
        requiere_autorizacion: acuerdo.requiere_autorizacion,
        tarifario_base: acuerdo.tarifario_base,
        porcentaje_sobre_base: acuerdo.porcentaje_sobre_base,
        observaciones: acuerdo.observaciones,
        activo: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`   ❌ Acuerdo ${acuerdo.eps_codigo}:`, error.message);
      continue;
    }

    const acuerdoId = data.id;
    mapaAcuerdos.set(acuerdo.eps_codigo, acuerdoId);
    console.log(`   ✅ ${acuerdo.nombre_eps} (${acuerdo.eps_codigo}) → ${acuerdoId}`);

    // Insertar tarifas
    const tarifasConId = acuerdo.tarifas.map((t) => ({
      acuerdo_id: acuerdoId,
      cups_codigo: t.cups_codigo,
      valor_pactado: t.valor_pactado,
      incluye_honorarios: true,
      incluye_materiales: true,
      es_paquete: false,
    }));

    const { error: errTarifa } = await supabase
      .from("acuerdo_tarifas")
      .insert(tarifasConId);

    if (errTarifa) {
      console.error(`   ❌ Tarifas de ${acuerdo.eps_codigo}:`, errTarifa.message);
    } else {
      console.log(`      └─ ${acuerdo.tarifas.length} tarifas insertadas`);
    }
  }

  return mapaAcuerdos;
}

async function insertarReglasCoherencia() {
  console.log("\n📋 Insertando reglas de coherencia sexo-diagnóstico...\n");

  const { error } = await supabase
    .from("reglas_coherencia")
    .insert(REGLAS_COHERENCIA);

  if (error) {
    console.error("   ❌ reglas_coherencia:", error.message);
  } else {
    console.log(`   ✅ ${REGLAS_COHERENCIA.length} reglas insertadas`);
  }
}

async function insertarFacturas(userId: string) {
  console.log("\n📋 Insertando facturas de prueba...\n");

  const facturas = generarFacturas(userId);
  let insertadas = 0;

  for (const f of facturas) {
    const { error } = await supabase
      .from("facturas")
      .insert({
        user_id: userId,
        num_factura: f.num_factura,
        num_fev: f.num_factura,
        nit_prestador: PRESTADOR.nit,
        nit_erp: f.eps_codigo,
        fecha_expedicion: f.fecha_expedicion_fev,
        valor_total: f.valor_total,
        valor_glosado: 0,
        valor_aceptado: 0,
        estado: "borrador",
        fev_rips_json: f.fev_rips_json,
        metadata: f.metadata,
      });

    if (error) {
      console.error(`   ❌ ${f.num_factura}: ${error.message}`);
    } else {
      insertadas++;
      const glosas = f.glosas_esperadas.length > 0
        ? `→ Espera: ${f.glosas_esperadas.join(", ")}`
        : "→ ✓ Sin glosas esperadas";
      console.log(`   ✅ ${f.num_factura} — ${f.descripcion}`);
      console.log(`      ${glosas}`);
    }
  }

  return { total: facturas.length, insertadas };
}

// =====================================================================
// RESUMEN
// =====================================================================

async function mostrarResumen() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(" RESUMEN DE DATOS DE PRUEBA");
  console.log("═══════════════════════════════════════════════════════\n");

  // Acuerdos
  const { data: acuerdos } = await supabase
    .from("acuerdos_voluntades")
    .select("eps_codigo, nombre_eps, fecha_inicio, fecha_fin")
    .like("observaciones", `%${MARCA_PRUEBA}%`);

  console.log(`📄 Acuerdos de voluntades: ${acuerdos?.length ?? 0}`);
  for (const a of acuerdos ?? []) {
    console.log(`   • ${a.nombre_eps} (${a.eps_codigo}) — ${a.fecha_inicio} a ${a.fecha_fin}`);
  }

  // Tarifas
  for (const a of acuerdos ?? []) {
    const { data: acuerdoFull } = await supabase
      .from("acuerdos_voluntades")
      .select("id")
      .eq("eps_codigo", a.eps_codigo)
      .like("observaciones", `%${MARCA_PRUEBA}%`)
      .single();

    if (acuerdoFull) {
      const { data: tarifas } = await supabase
        .from("acuerdo_tarifas")
        .select("cups_codigo, valor_pactado")
        .eq("acuerdo_id", acuerdoFull.id);

      console.log(`   └─ Tarifas: ${tarifas?.length ?? 0}`);
      for (const t of tarifas ?? []) {
        console.log(`      ${t.cups_codigo}: $${Number(t.valor_pactado).toLocaleString("es-CO")}`);
      }
    }
  }

  // Facturas
  const { data: facturas } = await supabase
    .from("facturas")
    .select("num_factura, nit_erp, valor_total, estado, metadata")
    .contains("metadata", { [MARCA_PRUEBA]: true })
    .order("num_factura");

  console.log(`\n📄 Facturas de prueba: ${facturas?.length ?? 0}`);
  for (const f of facturas ?? []) {
    const meta = f.metadata as any;
    const glosas = meta?.escenario ?? "—";
    console.log(`   • ${f.num_factura} | ${f.nit_erp} | $${Number(f.valor_total).toLocaleString("es-CO")} | ${glosas}`);
  }

  // Reglas de coherencia
  const codigosReglas = REGLAS_COHERENCIA.map((r) => r.codigo_referencia);
  const { data: reglas } = await supabase
    .from("reglas_coherencia")
    .select("codigo_referencia, tipo, severidad")
    .in("codigo_referencia", codigosReglas);

  console.log(`\n📄 Reglas de coherencia: ${reglas?.length ?? 0}`);
  for (const r of reglas ?? []) {
    console.log(`   • ${r.tipo} → ${r.codigo_referencia} (${r.severidad})`);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(" USO EN LA UI");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`
  Los 7 escenarios de factura están listos para validar:
  
  1. FEV-PRUEBA-001  PERFECTA — debe pasar todas las validaciones
  2. FEV-PRUEBA-002  ERROR DE TARIFA → TA0201
  3. FEV-PRUEBA-003  SIN SOPORTES → SO3405, SO3701
  4. FEV-PRUEBA-004  DX INCOHERENTE CON SEXO → PE0101
  5. FEV-PRUEBA-005  FUERA DE PLAZO → DE5601
  6. FEV-PRUEBA-006  SIN AUTORIZACIÓN → AU0101, SO2101
  7. FEV-PRUEBA-007  MÚLTIPLES ERRORES → TA0201, TA0801, PE0101, SO3405, AU0101, DE5601
  
  Prestador: ${PRESTADOR.nombre} (NIT ${PRESTADOR.nit})
  EPS: Emssanar (EPS-S01), Nueva EPS (EPS-S03)
  Pacientes: 5 ficticios con datos realistas colombianos
  `);
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  const soloLimpiar = process.argv.includes("--clean");

  console.log("═══════════════════════════════════════════════════════");
  console.log(" Seed: Datos de Prueba Anti-Glosas → Supabase");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`📅 ${new Date().toLocaleDateString("es-CO")} ${new Date().toLocaleTimeString("es-CO")}`);
  console.log(`🔗 ${SUPABASE_URL}`);
  if (soloLimpiar) {
    console.log("🧹 Modo: SOLO LIMPIEZA (--clean)\n");
  }

  // 1. Limpiar datos previos
  await limpiarDatosPrueba();

  if (soloLimpiar) {
    console.log("🏁 Limpieza completada. No se insertaron datos nuevos.");
    return;
  }

  // 2. Obtener user_id del primer usuario registrado
  const userId = await obtenerUserIdActivo();

  // 3. Insertar acuerdos de voluntades + tarifas
  await insertarAcuerdos(userId);

  // 4. Insertar reglas de coherencia
  await insertarReglasCoherencia();

  // 5. Insertar facturas
  const { total, insertadas } = await insertarFacturas(userId);
  console.log(`\n📊 Facturas: ${insertadas}/${total} insertadas correctamente`);

  // 6. Resumen
  await mostrarResumen();

  console.log("\n🏁 Seed de datos de prueba finalizado.");
}

main().catch((e) => {
  console.error("💥 Error fatal:", e);
  process.exit(1);
});
