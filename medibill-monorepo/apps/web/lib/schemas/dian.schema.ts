import { z } from "zod/v4";

export const EnviarDianSchema = z.object({
  facturaId: z.string().min(1, "ID de factura requerido"),
});

export const ConsultarEstadoDianSchema = z.object({
  facturaId: z.string().min(1, "ID de factura requerido"),
});
