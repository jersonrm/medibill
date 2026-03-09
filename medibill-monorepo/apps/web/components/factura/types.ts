export const ESTADO_INFO: Record<string, { label: string; className: string; step: number }> = {
  borrador: { label: "Borrador", className: "bg-amber-100 text-amber-800 border-amber-300", step: 0 },
  aprobada: { label: "Aprobada", className: "bg-green-100 text-green-800 border-green-300", step: 1 },
  descargada: { label: "Descargada", className: "bg-blue-100 text-blue-800 border-blue-300", step: 2 },
  radicada: { label: "Radicada", className: "bg-purple-100 text-purple-800 border-purple-300", step: 3 },
  pagada_parcial: { label: "Pago Parcial", className: "bg-cyan-100 text-cyan-800 border-cyan-300", step: 4 },
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-800 border-emerald-300", step: 5 },
  anulada: { label: "Anulada", className: "bg-red-100 text-red-700 border-red-300", step: -1 },
};

export interface FacturaData {
  id: string;
  num_factura: string;
  fecha_expedicion: string;
  nit_prestador: string;
  nit_erp: string;
  estado: string;
  valor_total: number;
  subtotal: number;
  copago: number;
  cuota_moderadora: number;
  descuentos: number;
  diagnosticos: { codigo_cie10: string; descripcion: string; rol: string; manual?: boolean }[];
  procedimientos: { codigo_cups: string; descripcion: string; cantidad: number; valor_unitario?: number; fuente_tarifa?: string; manual?: boolean }[];
  atencion?: { modalidad: string; causa: string; tipo_diagnostico: string; valor_consulta: number };
  nota_clinica_original?: string | null;
  perfil_prestador_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  cufe?: string | null;
  estado_dian?: string | null;
  track_id_dian?: string | null;
  fecha_envio_dian?: string | null;
  cuv?: string | null;
  estado_muv?: string | null;
  fecha_envio_muv?: string | null;
  pacientes: {
    primer_nombre: string;
    segundo_nombre?: string;
    primer_apellido: string;
    segundo_apellido?: string;
    numero_documento: string;
    tipo_documento: string;
    fecha_nacimiento?: string;
    sexo?: string;
    eps_nombre?: string;
    tipo_usuario?: string;
    municipio_residencia_codigo?: string;
    zona_territorial?: string;
  } | null;
}
