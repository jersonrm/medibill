import { z } from "zod/v4";

export const GuardarAcuerdoSchema = z.object({
  id: z.string().optional(),
  eps_codigo: z.string().min(1, "Código EPS requerido"),
  nombre_eps: z.string().min(1, "Nombre EPS requerido"),
  email_radicacion: z.email().optional(),
  fecha_inicio: z.string().min(1, "Fecha de inicio requerida"),
  fecha_fin: z.string().min(1, "Fecha de fin requerida"),
  tarifario_base: z.string().min(1, "Tarifario base requerido"),
  porcentaje_sobre_base: z.number().min(0, "Porcentaje no puede ser negativo"),
  requiere_autorizacion: z.boolean(),
  observaciones: z.string().optional(),
});

export type GuardarAcuerdoValidated = z.infer<typeof GuardarAcuerdoSchema>;

export const TarifaAcuerdoSchema = z.object({
  cups_codigo: z.string().min(1),
  valor_pactado: z.number().min(0, "Valor no puede ser negativo"),
  incluye_honorarios: z.boolean(),
  incluye_materiales: z.boolean(),
  es_paquete: z.boolean(),
  servicios_incluidos_paquete: z.array(z.string()).optional(),
  observaciones: z.string().optional(),
});

export const GuardarTarifasSchema = z.object({
  acuerdoId: z.string().min(1),
  tarifas: z.array(TarifaAcuerdoSchema),
});
