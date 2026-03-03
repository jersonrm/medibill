"use server";

import { createClient } from "@/lib/supabase-server";

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
      usuario_id: user.id,
      codigo_cups: codigo,
      descripcion: descripcion,
      tarifa: valor
    });

  if (error) {
    console.error("Error guardando tarifa:", error);
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
    console.error("Error obteniendo tarifas:", error);
    return [];
  }
  return data;
}

export async function eliminarTarifaUsuario(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('servicios_medico')
    .delete()
    .eq('id', id);

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
