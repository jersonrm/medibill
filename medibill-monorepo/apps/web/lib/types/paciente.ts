/**
 * Tipos TypeScript para Gestión de Pacientes
 * Alineados con tabla `pacientes` en Supabase
 */

export interface PacienteDB {
  id: string;
  user_id: string;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  fecha_nacimiento: string | null;
  sexo: "M" | "F" | "I" | null;
  tipo_usuario: string | null;
  eps_codigo: string | null;
  eps_nombre: string | null;
  zona_territorial: string;
  municipio_residencia_codigo: string | null;
  municipio_residencia_nombre: string | null;
  departamento_residencia_codigo: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Datos para crear/actualizar un paciente */
export type PacienteInput = Omit<
  PacienteDB,
  "id" | "user_id" | "activo" | "created_at" | "updated_at"
>;

/** Paciente con datos enriquecidos para la lista */
export interface PacienteConHistorial extends PacienteDB {
  total_consultas: number;
  ultima_consulta: string | null;
}
