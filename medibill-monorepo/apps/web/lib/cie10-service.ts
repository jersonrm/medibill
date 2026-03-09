import { createClient } from "@/lib/supabase-server";

export interface Cie10Resultado {
  codigo: string;
  descripcion: string;
  codigo_3: string;
  descripcion_3: string;
  capitulo: number;
  nombre_capitulo: string;
  relevancia: number;
}

/**
 * Búsqueda en la tabla cie10_maestro usando full-text search + trigramas.
 * Fuente de verdad: Excel CIE-10 Colombia 2026.
 */
export async function buscarCie10PorTexto(
  termino: string,
  limite: number = 10
): Promise<Cie10Resultado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("buscar_cie10", {
    termino,
    limite,
  });

  if (error) {
    console.error("Error buscando CIE-10:", error.message);
    return [];
  }

  return (data ?? []) as Cie10Resultado[];
}

/**
 * Búsqueda HÍBRIDA en cie10_maestro: combina trigramas (lexical) + embeddings (semántica).
 * Requiere que las columnas embedding estén pobladas (ver generar-embeddings.ts).
 * Si los embeddings no están disponibles, hace fallback a búsqueda lexical.
 */
export async function buscarCie10Hibrido(
  termino: string,
  embedding: number[],
  limite: number = 10
): Promise<Cie10Resultado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("buscar_cie10_hibrido", {
    termino_busqueda: termino,
    vector_busqueda: JSON.stringify(embedding),
    limite,
    peso_semantico: 0.6,
  });

  if (error) {
    // Fallback a búsqueda lexical si la función híbrida no existe o falla
    console.warn("⚠️  Búsqueda híbrida CIE-10 falló, usando lexical:", error.message);
    return buscarCie10PorTexto(termino, limite);
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    codigo: r.codigo as string,
    descripcion: r.descripcion as string,
    codigo_3: r.codigo_3 as string,
    descripcion_3: r.descripcion_3 as string,
    capitulo: r.capitulo as number,
    nombre_capitulo: r.nombre_capitulo as string,
    relevancia: (r.relevancia_hibrida ?? r.relevancia ?? 0) as number,
  })) as Cie10Resultado[];
}

/**
 * Búsqueda exacta por código CIE-10 (ej: "S420", "A000").
 * Acepta formatos con punto: "S42.0" → "S420"
 */
export async function buscarCie10PorCodigo(
  codigo: string
): Promise<Cie10Resultado | null> {
  // Normalizar: quitar puntos, espacios
  const codigoLimpio = codigo.replace(/[.\s-]/g, "").toUpperCase().trim();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cie10_maestro")
    .select("codigo, descripcion, codigo_3, descripcion_3, capitulo, nombre_capitulo")
    .eq("codigo", codigoLimpio)
    .eq("vigente", true)
    .limit(1)
    .single();

  if (error || !data) return null;

  return { ...data, relevancia: 1 } as Cie10Resultado;
}

/**
 * Validar que un código CIE-10 existe y está vigente.
 */
export async function validarCodigoCie10(codigo: string): Promise<boolean> {
  const resultado = await buscarCie10PorCodigo(codigo);
  return resultado !== null;
}
