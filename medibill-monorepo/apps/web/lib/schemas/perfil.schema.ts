import { z } from "zod/v4";

/** Whitelist de campos permitidos para guardarPerfil — previene mass assignment */
export const GuardarPerfilSchema = z.object({
  tipo_documento: z.string().optional(),
  numero_documento: z.string().optional(),
  digito_verificacion: z.string().optional(),
  razon_social: z.string().optional(),
  nombre_comercial: z.string().optional(),
  codigo_habilitacion: z.string().optional(),
  tipo_prestador: z.enum(["profesional_independiente", "clinica"]).optional(),
  direccion: z.string().optional(),
  municipio_codigo: z.string().optional(),
  municipio_nombre: z.string().optional(),
  departamento_codigo: z.string().optional(),
  departamento_nombre: z.string().optional(),
  telefono: z.string().optional(),
  email_facturacion: z.email().optional(),
  responsable_iva: z.boolean().optional(),
  regimen_fiscal: z.enum(["simplificado", "comun", "no_responsable"]).optional(),
  especialidad_principal: z.string().optional(),
  registro_medico: z.string().optional(),
  logo_url: z.string().nullable().optional(),
  onboarding_completo: z.boolean().optional(),
  organizacion_id: z.string().nullable().optional(),
});

export type GuardarPerfilInput = z.infer<typeof GuardarPerfilSchema>;

/** Schema para guardarResolucion */
export const GuardarResolucionSchema = z.object({
  id: z.string().optional(),
  numero_resolucion: z.string().min(1, "Número de resolución requerido"),
  fecha_resolucion: z.string().min(1, "Fecha de resolución requerida"),
  prefijo: z.string(),
  rango_desde: z.number().int().min(1),
  rango_hasta: z.number().int().min(1),
  fecha_vigencia_desde: z.string().min(1),
  fecha_vigencia_hasta: z.string().min(1),
  clave_tecnica: z.string().nullable().optional(),
  activa: z.boolean(),
});

export type GuardarResolucionInput = z.infer<typeof GuardarResolucionSchema>;
