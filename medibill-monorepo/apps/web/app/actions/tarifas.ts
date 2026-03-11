"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { getContextoOrg } from "@/lib/organizacion";
import { verificarPermisoOError } from "@/lib/permisos";
import { GuardarTarifaSchema } from "@/lib/schemas/tarifas.schema";
import { z } from "zod/v4";

// ==========================================
// TARIFAS PERSONALIZADAS — Server Actions
// ==========================================

export async function guardarTarifaUsuario(datos: {
  codigo: string;
  descripcion: string;
  valor: number;
}): Promise<{ success: boolean; error?: string }> {
  // Validar input con Zod — whitelist de campos (previene mass assignment)
  const parsed = GuardarTarifaSchema.safeParse(datos);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "crear_factura");

    const supabase = await createClient();
    const { error } = await supabase
      .from('servicios_medico')
      .insert({
        user_id: ctx.userId,
        codigo_cups: parsed.data.codigo,
        descripcion: parsed.data.descripcion,
        tarifa: parsed.data.valor,
      });

    if (error) {
      devError("Error guardando tarifa", error);
      return { success: false, error: safeError("guardarTarifa", error) };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function obtenerTarifasUsuario() {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('servicios_medico')
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('activo', true)
      .order('creado_en', { ascending: false });

    if (error) {
      devError("Error obteniendo tarifas", error);
      return [];
    }
    return data;
  } catch {
    return [];
  }
}

export async function eliminarTarifaUsuario(id: string) {
  // Validar UUID para prevenir inyección
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  try {
    const ctx = await getContextoOrg();
    verificarPermisoOError(ctx.rol, "crear_factura");

    const supabase = await createClient();
    const { error } = await supabase
      .from('servicios_medico')
      .update({ activo: false })
      .eq('id', idParsed.data)
      .eq('user_id', ctx.userId);

    if (error) return { success: false, error: safeError("eliminarTarifaUsuario", error) };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

/** Buscar CUPS para el selector de tarifas */
export async function buscarCupsParaTarifa(termino: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("buscar_cups", {
    termino,
    limite: 10,
  });
  if (error) return [];
  return (data ?? []).map((c: { codigo: string; descripcion: string }) => ({
    codigo: c.codigo,
    descripcion: c.descripcion,
  }));
}

/** Busca tarifa de un procedimiento: primero en acuerdos, luego en tarifas propias */
export async function buscarTarifaProcedimiento(cupsCodigo: string, epsNit?: string): Promise<{
  valor: number | null;
  fuente: "pactada" | "propia" | null;
}> {
  try {
    const ctx = await getContextoOrg();
    const supabase = await createClient();

    // 1. Buscar en acuerdo_tarifas si hay EPS
    if (epsNit) {
      const { data: pactada } = await supabase
        .from("acuerdo_tarifas")
        .select("valor")
        .eq("user_id", ctx.userId)
        .eq("codigo_cups", cupsCodigo)
        .eq("eps_nit", epsNit)
        .single();
      if (pactada) return { valor: pactada.valor, fuente: "pactada" };
    }

    // 2. Buscar en servicios_medico (tarifas propias)
    const { data: propia } = await supabase
      .from("servicios_medico")
      .select("tarifa")
      .eq("user_id", ctx.userId)
      .eq("codigo_cups", cupsCodigo)
      .eq("activo", true)
      .single();
    if (propia) return { valor: propia.tarifa, fuente: "propia" };

    return { valor: null, fuente: null };
  } catch {
    return { valor: null, fuente: null };
  }
}
