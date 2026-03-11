import { z } from "zod/v4";

export const DatosPacienteSchema = z.object({
  tipo_documento: z.string().min(1, "Tipo documento requerido"),
  numero_documento: z.string().min(1, "Número documento requerido"),
  primer_nombre: z.string().min(1, "Nombre requerido"),
  segundo_nombre: z.string().optional(),
  primer_apellido: z.string().min(1, "Apellido requerido"),
  segundo_apellido: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  sexo: z.string().optional(),
  tipo_usuario: z.string().optional(),
  eps_codigo: z.string().optional(),
  eps_nombre: z.string().optional(),
  municipio_residencia_codigo: z.string().optional(),
  zona_territorial: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  direccion: z.string().optional(),
  incapacidad: z.string().optional(),
});

export const CrearFacturaSchema = z.object({
  datos_paciente: DatosPacienteSchema,
  nit_erp: z.string().min(1, "NIT ERP requerido"),
  eps_nombre: z.string().optional(),
  valor_total: z.number().min(0, "Valor total no puede ser negativo"),
  subtotal: z.number().min(0, "Subtotal no puede ser negativo"),
  descuentos: z.number().min(0, "Descuentos no puede ser negativo"),
  copago: z.number().min(0, "Copago no puede ser negativo"),
  cuota_moderadora: z.number().min(0, "Cuota moderadora no puede ser negativa"),
  diagnosticos: z.array(z.record(z.string(), z.unknown())),
  procedimientos: z.array(z.record(z.string(), z.unknown())),
  atencion: z.record(z.string(), z.unknown()).optional(),
  nota_clinica_original: z.string().optional(),
});

export type CrearFacturaValidated = z.infer<typeof CrearFacturaSchema>;

export const EditarFacturaSchema = z.object({
  diagnosticos: z.array(z.record(z.string(), z.unknown())).optional(),
  procedimientos: z.array(z.record(z.string(), z.unknown())).optional(),
  atencion: z.record(z.string(), z.unknown()).optional(),
  subtotal: z.number().min(0, "Subtotal no puede ser negativo").optional(),
  copago: z.number().min(0, "Copago no puede ser negativo").optional(),
  cuota_moderadora: z.number().min(0, "Cuota moderadora no puede ser negativa").optional(),
  valor_total: z.number().min(0, "Valor total no puede ser negativo").optional(),
  datos_paciente: z.object({
    tipo_documento: z.string(),
    numero_documento: z.string(),
    primer_nombre: z.string(),
    segundo_nombre: z.string().optional(),
    primer_apellido: z.string(),
    segundo_apellido: z.string().optional(),
    fecha_nacimiento: z.string().optional(),
    sexo: z.string().optional(),
    tipo_usuario: z.string().optional(),
    eps_codigo: z.string().optional(),
    eps_nombre: z.string().optional(),
    municipio_residencia_codigo: z.string().optional(),
    zona_territorial: z.string().optional(),
  }).optional(),
});

export type EditarFacturaValidated = z.infer<typeof EditarFacturaSchema>;
