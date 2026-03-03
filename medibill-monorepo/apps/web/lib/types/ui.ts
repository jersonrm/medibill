/**
 * Tipos TypeScript para el estado de la UI de Medibill
 * Reemplazan todos los `any` del page.tsx original.
 * Alineados con la respuesta de la IA y la estructura de Supabase.
 */

// ==========================================
// ALTERNATIVAS (sugerencias de la IA)
// ==========================================

/** Una alternativa sugerida por la IA para un diagnóstico o procedimiento */
export interface AlternativaIA {
  codigo: string;
  descripcion: string;
}

// ==========================================
// DIAGNÓSTICOS
// ==========================================

/** Rol del diagnóstico en la atención */
export type RolDiagnostico = "principal" | "relacionado" | "causa_externa";

/** Diagnóstico CIE-10 tal como lo devuelve el análisis IA */
export interface DiagnosticoUI {
  codigo_cie10: string;
  descripcion: string;
  rol: RolDiagnostico;
  alternativas: AlternativaIA[];
}

// ==========================================
// PROCEDIMIENTOS
// ==========================================

/** Procedimiento CUPS tal como lo devuelve el análisis IA */
export interface ProcedimientoUI {
  codigo_cups: string;
  descripcion: string;
  cantidad: number;
  alternativas: AlternativaIA[];
  /** Código CIE-10 del diagnóstico que justifica este procedimiento */
  diagnostico_asociado?: string;
  /** Valor personalizado del procedimiento (cruce con tarifas del médico) */
  valor_procedimiento?: number;
}

// ==========================================
// ATENCIÓN (metadata de la consulta)
// ==========================================

/** Datos de atención / liquidación que acompañan el análisis IA */
export interface AtencionUI {
  modalidad: string;
  causa: string;
  finalidad: string;
  tipo_diagnostico: string;
  tipo_servicio: string;
  valor_consulta: number;
  valor_cuota: number;
}

// ==========================================
// RESULTADO DEL ANÁLISIS IA
// ==========================================

/** Estructura completa del resultado que devuelve `clasificarTextoMedico` */
export interface ResultadoAnalisis {
  diagnosticos: DiagnosticoUI[];
  procedimientos: ProcedimientoUI[];
  atencion: AtencionUI;
}

// ==========================================
// HISTORIAL DE AUDITORÍAS
// ==========================================

/** Un registro del historial de auditorías almacenado en Supabase */
export interface AuditoriaHistorial {
  id: string;
  user_id: string;
  nombre_paciente: string;
  documento_paciente: string;
  nota_original: string;
  resultado_ia: ResultadoAnalisis;
  creado_en: string;
}

// ==========================================
// DATOS DEL PACIENTE (agrupa 10+ variables)
// ==========================================

/** Agrupa todas las variables de estado del formulario de paciente */
export interface DatosPaciente {
  nombrePaciente: string;
  cedulaPaciente: string;
  tipoDocumento: string;
  fechaNacimiento: string;
  sexoPaciente: string;
  tipoUsuario: string;
  codPaisResidencia: string;
  departamentoSeleccionado: string;
  codMunicipioResidencia: string;
  codZonaTerritorial: string;
  incapacidad: string;
}

// ==========================================
// DICCIONARIOS (Resolución 2275)
// ==========================================

export const DICCIONARIO_CAUSAS: Record<string, string> = {
  "15": "Enfermedad General",
  "01": "Accidente de Trabajo",
  "02": "Accidente de Tránsito",
  "03": "Accidente Rábico",
  "04": "Accidente Ofídico",
  "05": "Otro Accidente",
  "06": "Evento Catastrófico",
  "07": "Lesión por Agresión",
  "08": "Lesión Autoinfligida",
  "09": "Sospecha Maltrato Físico",
  "10": "Sospecha Abuso Sexual",
  "11": "Sospecha Violencia Sexual",
  "12": "Sospecha Maltrato Emocional",
  "13": "Enfermedad Profesional",
};

export const DICCIONARIO_TIPO_DIAG: Record<string, string> = {
  "01": "Impresión Diagnóstica",
  "02": "Confirmado Nuevo",
  "03": "Confirmado Repetido",
};

export const DICCIONARIO_MODALIDAD: Record<string, string> = {
  "01": "Presencial",
  "02": "Extramural",
  "03": "Hogar",
  "04": "Telemedicina",
};

export const DICCIONARIO_TIPO_SERVICIO: Record<string, string> = {
  "consulta": "Consulta Externa",
  "urgencias": "Urgencias",
};

/** Valores por defecto para una atención nueva */
export const ATENCION_DEFAULT: AtencionUI = {
  modalidad: "01",
  causa: "15",
  finalidad: "10",
  tipo_diagnostico: "01",
  tipo_servicio: "consulta",
  valor_consulta: 50000,
  valor_cuota: 0,
};

/** Valores por defecto para datos del paciente */
export const DATOS_PACIENTE_DEFAULT: DatosPaciente = {
  nombrePaciente: "",
  cedulaPaciente: "",
  tipoDocumento: "CC",
  fechaNacimiento: "",
  sexoPaciente: "M",
  tipoUsuario: "01",
  codPaisResidencia: "170",
  departamentoSeleccionado: "",
  codMunicipioResidencia: "",
  codZonaTerritorial: "U",
  incapacidad: "NO",
};
