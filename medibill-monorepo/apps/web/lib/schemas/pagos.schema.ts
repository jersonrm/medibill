import { z } from "zod/v4";

const MetodoPagoEnum = z.enum([
  "efectivo",
  "transferencia",
  "cheque",
  "consignacion",
  "compensacion",
  "otro",
]);

export const RegistrarPagoSchema = z.object({
  factura_id: z.string().min(1, "ID de factura requerido"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  fecha_pago: z.string().min(1, "Fecha de pago requerida"),
  metodo_pago: MetodoPagoEnum,
  referencia: z.string().optional(),
  notas: z.string().optional(),
});

export type RegistrarPagoValidated = z.infer<typeof RegistrarPagoSchema>;
