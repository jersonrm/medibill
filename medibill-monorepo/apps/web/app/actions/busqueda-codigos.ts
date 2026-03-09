"use server";

import { createClient } from "@/lib/supabase-server";
import { buscarCie10PorTexto, buscarCie10PorCodigo } from "@/lib/cie10-service";
import { buscarCupsPorTexto, buscarCupsPorCodigo } from "@/lib/cups-service";

async function verificarAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export async function buscarCie10Action(termino: string, limite: number = 10) {
  if (!termino || termino.trim().length < 2) return [];
  if (!(await verificarAuth())) return [];
  return buscarCie10PorTexto(termino.trim(), limite);
}

export async function buscarCie10PorCodigoAction(codigo: string) {
  if (!codigo || codigo.trim().length < 2) return null;
  if (!(await verificarAuth())) return null;
  return buscarCie10PorCodigo(codigo.trim());
}

export async function buscarCupsAction(termino: string, limite: number = 10) {
  if (!termino || termino.trim().length < 2) return [];
  if (!(await verificarAuth())) return [];
  return buscarCupsPorTexto(termino.trim(), limite);
}

export async function buscarCupsPorCodigoAction(codigo: string) {
  if (!codigo || codigo.trim().length < 2) return null;
  if (!(await verificarAuth())) return null;
  return buscarCupsPorCodigo(codigo.trim());
}
