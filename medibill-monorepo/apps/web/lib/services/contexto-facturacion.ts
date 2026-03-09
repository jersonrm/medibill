import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PerfilFevInput,
  ResolucionFevInput,
  ClienteFevInput,
  PacienteFevInput,
} from "@/lib/types/fev-xml";
import type { FacturaCompleta } from "@/lib/types/factura";

// ==========================================
// Contexto de facturación — capa compartida
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>;

export interface ContextoFacturacion {
  factura: FacturaCompleta;
  perfilInput: PerfilFevInput;
  resolucionInput: ResolucionFevInput;
  clienteInput: ClienteFevInput;
  pacienteInput: PacienteFevInput | undefined;
}

type ResultadoContexto =
  | { ok: true; data: ContextoFacturacion }
  | { ok: false; error: string };

// =====================================================================
// Funciones de mapeo puras
// =====================================================================

export function mapPerfilToFevInput(perfil: SupabaseRow): PerfilFevInput {
  return {
    tipo_documento: perfil.tipo_documento || "CC",
    numero_documento: perfil.numero_documento || "",
    digito_verificacion: perfil.digito_verificacion || "0",
    razon_social: perfil.razon_social || "",
    nombre_comercial: perfil.nombre_comercial || perfil.razon_social || "",
    codigo_habilitacion: perfil.codigo_habilitacion || "",
    tipo_prestador: perfil.tipo_prestador || "profesional_independiente",
    direccion: perfil.direccion || "",
    municipio_codigo: perfil.municipio_codigo || "",
    municipio_nombre: perfil.municipio_nombre || "",
    departamento_codigo: perfil.departamento_codigo || "",
    departamento_nombre: perfil.departamento_nombre || "",
    telefono: perfil.telefono || "",
    email_facturacion: perfil.email_facturacion || "",
    responsable_iva: perfil.responsable_iva || false,
    regimen_fiscal: perfil.regimen_fiscal || "no_responsable",
  };
}

export function mapResolucionToFevInput(resolucion: SupabaseRow): ResolucionFevInput {
  return {
    numero_resolucion: resolucion.numero_resolucion || "",
    fecha_resolucion: resolucion.fecha_resolucion || "",
    prefijo: resolucion.prefijo || "",
    rango_desde: resolucion.rango_desde || resolucion.rango_inicio || 0,
    rango_hasta: resolucion.rango_hasta || resolucion.rango_fin || 0,
    fecha_vigencia_desde: resolucion.fecha_vigencia_desde || resolucion.fecha_resolucion || "",
    fecha_vigencia_hasta: resolucion.fecha_vigencia_hasta || "",
    clave_tecnica: resolucion.clave_tecnica || "",
  };
}

export function mapFacturaToClienteInput(factura: SupabaseRow): ClienteFevInput {
  const metadata = (factura.metadata || {}) as Record<string, string>;
  return {
    tipo_documento: "31", // EPS siempre es NIT
    numero_documento: factura.nit_erp || "",
    razon_social: metadata.eps_nombre || `EPS ${factura.nit_erp || ""}`,
    nombre_comercial: metadata.eps_nombre,
    responsable_iva: true,
  };
}

export function mapPacienteToFevInput(
  pacienteData: SupabaseRow | null | undefined,
): PacienteFevInput | undefined {
  if (!pacienteData) return undefined;
  return {
    tipo_documento: pacienteData.tipo_documento || "CC",
    numero_documento: pacienteData.numero_documento || "",
    primer_nombre: pacienteData.primer_nombre || "",
    segundo_nombre: pacienteData.segundo_nombre || undefined,
    primer_apellido: pacienteData.primer_apellido || "",
    segundo_apellido: pacienteData.segundo_apellido || undefined,
    tipo_usuario: pacienteData.tipo_usuario || "01",
    sexo: pacienteData.sexo || undefined,
    fecha_nacimiento: pacienteData.fecha_nacimiento || undefined,
    municipio_residencia_codigo: pacienteData.municipio_residencia_codigo || undefined,
    zona_territorial: pacienteData.zona_territorial || undefined,
    eps_codigo: pacienteData.eps_codigo || undefined,
    eps_nombre: pacienteData.eps_nombre || undefined,
  };
}

// =====================================================================
// Orquestador: obtiene perfil + resolución y mapea todo (factura ya obtenida)
// =====================================================================

export async function obtenerContextoFacturacion(
  supabase: SupabaseClient,
  userId: string,
  facturaRow: SupabaseRow,
): Promise<ResultadoContexto> {
  const factura = facturaRow as unknown as FacturaCompleta;

  // 1. Obtener perfil del prestador
  const { data: perfil, error: errPerfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (errPerfil || !perfil) {
    return { ok: false, error: "Perfil del prestador no encontrado. Complete el onboarding." };
  }

  // 2. Obtener resolución activa
  const { data: resolucion, error: errResolucion } = await supabase
    .from("resoluciones_facturacion")
    .select("*")
    .eq("user_id", userId)
    .eq("activa", true)
    .single();

  if (errResolucion || !resolucion) {
    return { ok: false, error: "No hay resolución de facturación activa. Configure una en Configuración." };
  }

  // 3. Mapear a inputs FEV
  const pacienteData = Array.isArray(facturaRow.pacientes) ? facturaRow.pacientes[0] : facturaRow.pacientes;

  return {
    ok: true,
    data: {
      factura,
      perfilInput: mapPerfilToFevInput(perfil),
      resolucionInput: mapResolucionToFevInput(resolucion),
      clienteInput: mapFacturaToClienteInput(facturaRow),
      pacienteInput: mapPacienteToFevInput(pacienteData),
    },
  };
}
