const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no está configurada");
}

import { createClient } from "@/lib/supabase-server";

// Configuración del modelo
const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768; // Truncar de 3072 a 768 para pgvector
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Task types para embeddings (asimétricos: documento vs consulta)
export enum TaskType {
  RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT",
  RETRIEVAL_QUERY = "RETRIEVAL_QUERY",
}

// Cache en memoria para evitar llamadas repetidas durante una misma request
const embeddingCache = new Map<string, number[]>();

interface GeminiEmbedding {
  values: number[];
}

interface GeminiEmbedResponse {
  embedding: GeminiEmbedding;
}

interface GeminiBatchResponse {
  embeddings: GeminiEmbedding[];
}

/**
 * Genera un embedding de 768 dimensiones para un texto médico.
 * Usa gemini-embedding-001 via REST API (outputDimensionality=768).
 *
 * @param texto - Texto a embedir
 * @param taskType - RETRIEVAL_QUERY para búsquedas, RETRIEVAL_DOCUMENT para indexación
 */
export async function generarEmbedding(
  texto: string,
  taskType: TaskType = TaskType.RETRIEVAL_QUERY
): Promise<number[]> {
  const textoNorm = texto.toLowerCase().trim();
  const cacheKey = `${taskType}:${textoNorm}`;

  // Cache hit
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const url = `${GEMINI_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: textoNorm }] },
      taskType,
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiEmbedResponse;
  const embedding = data.embedding.values;

  // Guardar en cache (máximo 200 entradas para evitar memory leak)
  if (embeddingCache.size >= 200) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(cacheKey, embedding);

  return embedding;
}

/**
 * Genera embeddings en batch (máximo 100 textos por llamada).
 * Útil para el script de importación inicial.
 *
 * @param textos - Array de textos a embedir
 * @param taskType - RETRIEVAL_DOCUMENT para indexación, RETRIEVAL_QUERY para búsquedas
 */
export async function generarEmbeddingsBatch(
  textos: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[][]> {
  const url = `${GEMINI_BASE_URL}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: textos.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: text.toLowerCase().trim() }] },
        taskType,
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiBatchResponse;
  return data.embeddings.map((e) => e.values);
}

/**
 * Limpia el cache de embeddings (útil entre requests o tests).
 */
export function limpiarCacheEmbeddings(): void {
  embeddingCache.clear();
}

// ==========================================
// BÚSQUEDA SEMÁNTICA POR TEXTO
// ==========================================

export interface SearchByTextResult {
  codigo: string;
  descripcion: string;
  similitud: number;
}

/**
 * Búsqueda semántica completa: genera el embedding de la consulta
 * con task_type=RETRIEVAL_QUERY y llama al RPC match_documents
 * para encontrar los códigos más similares por distancia coseno.
 *
 * @param query - Texto de búsqueda (descripción del procedimiento o diagnóstico)
 * @param table - 'cups' o 'cie10' para elegir la tabla de búsqueda
 * @param limit - Número máximo de resultados (default: 10)
 * @returns Resultados ordenados por similitud descendente
 */
export async function searchByText(
  query: string,
  table: "cups" | "cie10",
  limit: number = 10
): Promise<SearchByTextResult[]> {
  // 1. Generar embedding de la consulta con task_type RETRIEVAL_QUERY
  const embedding = await generarEmbedding(query, TaskType.RETRIEVAL_QUERY);

  // 2. Llamar al RPC match_documents con el vector
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: JSON.stringify(embedding),
    match_count: limit,
    tipo: table,
  });

  if (error) {
    console.error(`Error en searchByText (${table}):`, error.message);
    return [];
  }

  // 3. Devolver resultados (ya vienen ordenados por similitud desde la función SQL)
  return (data ?? []).map((r: any) => ({
    codigo: String(r.codigo),
    descripcion: String(r.descripcion),
    similitud: Number(r.similitud),
  }));
}
