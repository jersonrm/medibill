"use server";

import { createClient } from "@/lib/supabase-server";
import { devError } from "@/lib/logger";

// ==========================================
// TARIFAS PERSONALIZADAS — Server Actions
// ==========================================

export async function guardarTarifaUsuario(codigo: string, descripcion: string, valor: number) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "Usuario no autenticado" };

  const { error } = await supabase
    .from('servicios_medico')
    .insert({
      user_id: user.id,
      codigo_cups: codigo,
      descripcion: descripcion,
      tarifa: valor
    });

  if (error) {
    devError("Error guardando tarifa", error);
    return { exito: false, error: error.message };
  }
  return { exito: true };
}

export async function obtenerTarifasUsuario() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('servicios_medico')
    .select('*')
    .eq('user_id', user.id)
    .order('creado_en', { ascending: false });

  if (error) {
    devError("Error obteniendo tarifas", error);
    return [];
  }
  return data;
}

export async function eliminarTarifaUsuario(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "Usuario no autenticado" };

  const { error } = await supabase
    .from('servicios_medico')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { exito: false, error: error.message };
  return { exito: true };
}

/** Buscar CUPS para el selector de tarifas */
export async function buscarCupsParaTarifa(termino: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { valor: null, fuente: null };

  // 1. Buscar en acuerdo_tarifas si hay EPS
  if (epsNit) {
    const { data: pactada } = await supabase
      .from("acuerdo_tarifas")
      .select("valor")
      .eq("user_id", user.id)
      .eq("codigo_cups", cupsCodigo)
      .eq("eps_nit", epsNit)
      .single();
    if (pactada) return { valor: pactada.valor, fuente: "pactada" };
  }

  // 2. Buscar en servicios_medico (tarifas propias)
  const { data: propia } = await supabase
    .from("servicios_medico")
    .select("tarifa")
    .eq("user_id", user.id)
    .eq("codigo_cups", cupsCodigo)
    .single();
  if (propia) return { valor: propia.tarifa, fuente: "propia" };

  return { valor: null, fuente: null };
}
