import { z } from "zod/v4";

/** Schema para guardarTarifaUsuario — whitelist de campos permitidos */
export const GuardarTarifaSchema = z.object({
  codigo: z.string().min(1, "Código requerido").max(10),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  valor: z.number().positive("El valor debe ser positivo").max(999_999_999),
});

export type GuardarTarifaInput = z.infer<typeof GuardarTarifaSchema>;
