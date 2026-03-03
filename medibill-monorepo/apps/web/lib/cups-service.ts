import { createClient } from "@/lib/supabase-server";

export interface CupsResultado {
  codigo: string;
  descripcion: string;
  seccion: string;
  seccion_nombre: string;
  relevancia: number;
  contexto_jerarquico?: string | null;
}

/**
 * Búsqueda en la tabla cups_alias por coincidencia de texto.
 * Devuelve resultados de cups_maestro cuyos alias coinciden con el término.
 */
async function buscarEnCupsAlias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  termino: string,
  limite: number = 10
): Promise<CupsResultado[]> {
  try {
    const patron = `%${termino}%`;
    const { data, error } = await supabase
      .from("cups_alias")
      .select("cups_codigo, alias")
      .ilike("alias", patron)
      .limit(limite);

    if (error || !data || data.length === 0) return [];

    // Obtener descripciones completas de cups_maestro para los códigos encontrados
    const codigos = [...new Set(data.map((r: any) => r.cups_codigo))];
    const { data: maestroData, error: maestroError } = await supabase
      .from("cups_maestro")
      .select("codigo, descripcion, seccion, seccion_nombre")
      .in("codigo", codigos)
      .eq("vigente", true);

    if (maestroError || !maestroData) return [];

    const maestroMap = new Map<string, any>();
    for (const m of maestroData) {
      maestroMap.set(m.codigo, m);
    }

    // Calcular relevancia básica: coincidencia más exacta = mayor score
    const termNorm = termino.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return data
      .filter((r: any) => maestroMap.has(r.cups_codigo))
      .map((r: any) => {
        const m = maestroMap.get(r.cups_codigo)!;
        const aliasNorm = (r.alias as string).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Score: 1.0 si exacto, menor según diferencia de longitud
        const score = aliasNorm === termNorm ? 1.0 : Math.max(0.3, 1 - Math.abs(aliasNorm.length - termNorm.length) / Math.max(aliasNorm.length, termNorm.length));
        return {
          codigo: m.codigo,
          descripcion: m.descripcion,
          seccion: m.seccion ?? "",
          seccion_nombre: m.seccion_nombre ?? "",
          relevancia: score,
        } as CupsResultado;
      });
  } catch (e) {
    console.warn("⚠️  Búsqueda en cups_alias falló:", e);
    return [];
  }
}

/**
 * Mezcla resultados de cups_maestro con cups_alias, deduplicando por código.
 * Los resultados de maestro tienen prioridad (mayor relevancia).
 */
function mergeConAlias(
  resultadosMaestro: CupsResultado[],
  resultadosAlias: CupsResultado[]
): CupsResultado[] {
  const codigosExistentes = new Set(resultadosMaestro.map(r => r.codigo));
  const merged = [...resultadosMaestro];
  for (const alias of resultadosAlias) {
    if (!codigosExistentes.has(alias.codigo)) {
      merged.push(alias);
      codigosExistentes.add(alias.codigo);
    }
  }
  return merged.sort((a, b) => b.relevancia - a.relevancia);
}

/**
 * Búsqueda en la tabla cups_maestro usando full-text search + trigramas,
 * complementada con búsqueda en cups_alias para capturar sinónimos.
 * Fuente de verdad: Excel CUPS Resolución 2706 de 2025.
 */
export async function buscarCupsPorTexto(
  termino: string,
  limite: number = 10
): Promise<CupsResultado[]> {
  const supabase = await createClient();

  // Buscar en paralelo: cups_maestro (RPC) + cups_alias
  const [rpcResult, aliasResult] = await Promise.all([
    supabase.rpc("buscar_cups", { termino, limite }),
    buscarEnCupsAlias(supabase, termino, limite),
  ]);

  if (rpcResult.error) {
    console.error("Error buscando CUPS:", rpcResult.error.message);
    // Si falló la RPC, al menos devolver los alias
    if (aliasResult.length > 0) {
      await enriquecerConJerarquia(supabase, aliasResult);
      return aliasResult.slice(0, limite);
    }
    return [];
  }

  const resultadosMaestro = (rpcResult.data ?? []) as CupsResultado[];
  const resultados = mergeConAlias(resultadosMaestro, aliasResult).slice(0, limite);

  // Enriquecer con contexto jerárquico si existe
  if (resultados.length > 0) {
    await enriquecerConJerarquia(supabase, resultados);
  }
  return resultados;
}

/**
 * Búsqueda HÍBRIDA en cups_maestro: combina trigramas (lexical) + embeddings (semántica).
 * Requiere que las columnas embedding estén pobladas (ver generar-embeddings.ts).
 * Si los embeddings no están disponibles, hace fallback a búsqueda lexical.
 */
export async function buscarCupsHibrido(
  termino: string,
  embedding: number[],
  limite: number = 10
): Promise<CupsResultado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("buscar_cups_hibrido", {
    termino_busqueda: termino,
    vector_busqueda: JSON.stringify(embedding),
    limite,
    peso_semantico: 0.6,
  });

  if (error) {
    // Fallback a búsqueda lexical si la función híbrida no existe o falla
    console.warn("⚠️  Búsqueda híbrida CUPS falló, usando lexical:", error.message);
    return buscarCupsPorTexto(termino, limite);
  }

  const resultadosMaestro = (data ?? []).map((r: any) => ({
    codigo: r.codigo,
    descripcion: r.descripcion,
    seccion: r.seccion,
    seccion_nombre: r.seccion_nombre,
    relevancia: r.relevancia_hibrida ?? r.relevancia ?? 0,
  })) as CupsResultado[];

  // Complementar con búsqueda en cups_alias
  const aliasResult = await buscarEnCupsAlias(supabase, termino, limite);
  const resultados = mergeConAlias(resultadosMaestro, aliasResult).slice(0, limite);

  // Enriquecer con contexto jerárquico
  if (resultados.length > 0) {
    await enriquecerConJerarquia(supabase, resultados);
  }
  return resultados;
}

/**
 * Enriquece resultados CUPS con contexto jerárquico precalculado en cups_maestro.
 * La columna contexto_jerarquico se llena con importar-cups-jerarquia.ts.
 */
async function enriquecerConJerarquia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resultados: CupsResultado[]
): Promise<void> {
  const codigos = resultados.map(r => r.codigo);
  const { data, error } = await supabase
    .from("cups_maestro")
    .select("codigo, contexto_jerarquico")
    .in("codigo", codigos);

  if (error || !data) return;

  const mapaContexto = new Map<string, string>();
  for (const row of data) {
    if (row.contexto_jerarquico) {
      mapaContexto.set(row.codigo, row.contexto_jerarquico);
    }
  }

  for (const r of resultados) {
    r.contexto_jerarquico = mapaContexto.get(r.codigo) ?? null;
  }
}

/**
 * Búsqueda exacta por código CUPS.
 */
export async function buscarCupsPorCodigo(
  codigo: string
): Promise<CupsResultado | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cups_maestro")
    .select("codigo, descripcion, seccion, seccion_nombre, contexto_jerarquico")
    .eq("codigo", codigo)
    .eq("vigente", true)
    .limit(1)
    .single();

  if (error || !data) return null;

  return { ...data, relevancia: 1 } as CupsResultado;
}

/**
 * Validar que un código CUPS existe y está vigente.
 */
export async function validarCodigoCups(codigo: string): Promise<boolean> {
  const resultado = await buscarCupsPorCodigo(codigo);
  return resultado !== null;
}
