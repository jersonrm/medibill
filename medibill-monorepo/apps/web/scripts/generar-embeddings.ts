/**
 * Script: Generar embeddings para cups_maestro y cie10_maestro
 *
 * Modelo: gemini-embedding-001 de Google (3072d nativo, truncado a 768d)
 * Task type: RETRIEVAL_DOCUMENT
 *
 * Ejecutar:
 *   npx tsx apps/web/scripts/generar-embeddings.ts
 *   npx tsx apps/web/scripts/generar-embeddings.ts --force  (regenerar todos)
 *
 * Respeta límites Tier 1:
 *   - 1,000 RPM (requests por minuto)
 *   - 250,000 TPM (tokens por minuto)
 *   - Delay de 100ms entre requests
 *   - Backoff exponencial para errores 429 (inicio 30s)
 *
 * Idempotente: detecta registros con embedding existente y procesa solo los faltantes.
 * Texto para embedding: "código - descripción"
 *
 * Requiere:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - GOOGLE_GENERATIVE_AI_API_KEY
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error("❌ Variables requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══ Configuración del modelo ═══
const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768; // Truncar de 3072 a 768 para compatibilidad con Supabase
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// ═══ Configuración Tier 1 ═══
const BATCH_SIZE = 100;             // Textos por request (máximo API)
const DELAY_MS = 100;               // 100ms entre requests → ~600 RPM (bajo el límite de 1,000 RPM)
const INITIAL_BACKOFF_MS = 30_000;  // Backoff inicial para errores 429: 30 segundos
const MAX_BACKOFF_MS = 300_000;     // Backoff máximo: 5 minutos
const UPDATE_BATCH_SIZE = 50;       // Filas por update a Supabase

// Flag --force: limpiar embeddings existentes y regenerar desde cero
const FORCE_REGENERATE = process.argv.includes("--force");

// ═══ Utilidades ═══

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ═══ Embedding via REST API (evita problemas del SDK con modelos nuevos) ═══

interface GeminiEmbedding {
  values: number[];
}

interface GeminiBatchResponse {
  embeddings: GeminiEmbedding[];
}

/**
 * Genera embeddings en batch usando la REST API de Gemini directamente.
 * Usa gemini-embedding-001 con outputDimensionality=768 y taskType=RETRIEVAL_DOCUMENT.
 */
async function generarEmbeddingsBatch(textos: string[]): Promise<number[][]> {
  const url = `${GEMINI_BASE_URL}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`;

  const body = {
    requests: textos.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: text.toLowerCase().trim() }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Gemini API error ${response.status}: ${errorText}`) as any;
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as GeminiBatchResponse;
  return data.embeddings.map((e) => e.values);
}

/**
 * Prueba de conectividad: embede un solo texto y valida dimensiones.
 * Si falla, el script se detiene antes de procesar miles de registros.
 */
async function testEmbedding(): Promise<void> {
  console.log("\n🧪 Prueba de conectividad con Gemini...");
  const textoTest = "890101 - Consulta de primera vez por medicina general";

  try {
    const embeddings = await generarEmbeddingsBatch([textoTest]);
    const embedding = embeddings[0]!;
    const dims = embedding.length;
    console.log(`   ✅ Modelo: ${EMBEDDING_MODEL}`);
    console.log(`   ✅ Dimensiones: ${dims}`);
    console.log(`   ✅ Primeros 5 valores: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(", ")}]`);

    if (dims !== OUTPUT_DIMENSIONALITY) {
      console.error(`   ❌ Se esperaban ${OUTPUT_DIMENSIONALITY} dimensiones pero se obtuvieron ${dims}`);
      console.error(`      La columna embedding en Supabase es vector(${OUTPUT_DIMENSIONALITY}), no coincide.`);
      process.exit(1);
    }

    console.log(`   ✅ Prueba exitosa — compatible con vector(${OUTPUT_DIMENSIONALITY})\n`);
  } catch (err: any) {
    console.error(`   ❌ Prueba falló: ${err.message}`);
    console.error(`   Verifica que GOOGLE_GENERATIVE_AI_API_KEY sea válida y tenga acceso a ${EMBEDDING_MODEL}`);
    process.exit(1);
  }
}

// ═══ Procesamiento por tabla ═══

async function procesarTabla(tabla: "cups_maestro" | "cie10_maestro") {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`📊 Procesando: ${tabla}`);
  console.log(`═══════════════════════════════════════`);

  // 1. Contar totales y con embedding para mostrar progreso global
  const { count: totalCount } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .eq("vigente", true);

  const { count: conEmbedding } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .eq("vigente", true)
    .not("embedding", "is", null);

  const total = totalCount ?? 0;
  const existentes = conEmbedding ?? 0;
  const pendientesTotal = total - existentes;

  console.log(`📋 Total vigentes: ${total}`);
  console.log(`✅ Con embedding:  ${existentes}`);
  console.log(`⏳ Sin embedding:  ${pendientesTotal}`);

  if (pendientesTotal === 0) {
    console.log(`✅ Todos los registros ya tienen embedding — nada que hacer`);
    return;
  }

  // 2. Obtener TODAS las filas SIN embedding con paginación
  //    (Supabase limita a 1000 filas por query por defecto)
  const PAGE_SIZE = 1000;
  const data: { codigo: string; descripcion: string }[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from(tabla)
      .select("codigo, descripcion")
      .eq("vigente", true)
      .is("embedding", null)
      .order("codigo")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`❌ Error consultando ${tabla} (offset ${offset}):`, error.message);
      return;
    }

    if (!page || page.length === 0) break;
    data.push(...page);

    if (page.length < PAGE_SIZE) break; // Última página
  }

  if (data.length === 0) {
    console.log(`✅ Todos los registros ya tienen embedding — nada que hacer`);
    return;
  }

  console.log(`\n🔄 Generando embeddings para ${data.length} registros...\n`);

  let procesados = 0;
  let errores = 0;
  let backoffMs = INITIAL_BACKOFF_MS;
  const inicio = Date.now();

  for (let i = 0; i < data.length; ) {
    const batch = data.slice(i, i + BATCH_SIZE);

    // Formato: "código - descripción"
    const textos = batch.map((row: any) => {
      const desc = String(row.descripcion || row.codigo);
      return `${row.codigo} - ${desc}`;
    });

    try {
      const embeddings = await generarEmbeddingsBatch(textos);

      // Guardar en Supabase en sub-batches
      for (let j = 0; j < batch.length; j += UPDATE_BATCH_SIZE) {
        const subBatch = batch.slice(j, j + UPDATE_BATCH_SIZE);
        const subEmbeddings = embeddings.slice(j, j + UPDATE_BATCH_SIZE);

        const promises = subBatch.map((row: any, idx: number) =>
          supabase
            .from(tabla)
            .update({ embedding: JSON.stringify(subEmbeddings[idx]) })
            .eq("codigo", row.codigo)
        );

        const results = await Promise.all(promises);
        const updateErrors = results.filter((r) => r.error);
        if (updateErrors.length > 0) {
          console.warn(`  ⚠️  ${updateErrors.length} errores actualizando Supabase`);
          errores += updateErrors.length;
        }
      }

      procesados += batch.length;
      backoffMs = INITIAL_BACKOFF_MS; // Reset backoff tras éxito
      i += BATCH_SIZE; // Avanzar al siguiente batch

      // Progreso detallado
      const pct = ((procesados / data.length) * 100).toFixed(1);
      const elapsed = Date.now() - inicio;
      const rate = procesados / (elapsed / 1000);
      const remaining = data.length - procesados;
      const eta = rate > 0 ? (remaining / rate) * 1000 : 0;

      console.log(
        `  ✅ ${procesados}/${data.length} (${pct}%) | ` +
        `Pendientes: ${remaining} | ` +
        `${rate.toFixed(1)} reg/s | ` +
        `ETA: ${formatDuration(eta)}`
      );

      // Delay entre requests para respetar rate limits Tier 1
      if (i < data.length) {
        await sleep(DELAY_MS);
      }
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes("429") ||
        err.message?.includes("RESOURCE_EXHAUSTED") ||
        err.status === 429;

      if (isRateLimit) {
        console.warn(
          `  ⏳ Rate limit (429) — esperando ${formatDuration(backoffMs)} ` +
          `(backoff exponencial)...`
        );
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        // NO avanzar i → reintentar mismo batch
      } else {
        console.error(`  ❌ Error en batch ${i}-${i + batch.length}: ${err.message}`);
        errores += batch.length;
        i += BATCH_SIZE; // Avanzar para no quedar en loop infinito
      }
    }
  }

  const duracion = Date.now() - inicio;
  console.log(`\n📊 ${tabla} completado:`);
  console.log(`   ✅ Procesados exitosamente: ${procesados}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   ⏱️  Duración: ${formatDuration(duracion)}`);
}

// ═══ Limpieza ═══

async function limpiarEmbeddings(tabla: "cups_maestro" | "cie10_maestro") {
  console.log(`🗑️  Limpiando embeddings de ${tabla}...`);
  const { error, count } = await supabase
    .from(tabla)
    .update({ embedding: null })
    .eq("vigente", true)
    .not("embedding", "is", null);

  if (error) {
    console.error(`❌ Error limpiando ${tabla}:`, error.message);
    return;
  }
  console.log(`   ✅ ${count ?? "?"} embeddings limpiados`);
}

// ═══ Main ═══

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Generador de Embeddings — gemini-embedding-001 (768d)     ║");
  console.log("║  Task type: RETRIEVAL_DOCUMENT | REST API directa          ║");
  console.log("║  Tier 1: 1,000 RPM / 250,000 TPM | Delay: 100ms           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n   Supabase: ${SUPABASE_URL}`);
  console.log(`   API Key: ${GEMINI_KEY!.slice(0, 10)}...${GEMINI_KEY!.slice(-4)}`);

  // Prueba con un solo texto antes de procesar todo
  await testEmbedding();

  if (FORCE_REGENERATE) {
    console.log("⚠️  Modo --force: Se limpiarán y regenerarán TODOS los embeddings\n");
    await limpiarEmbeddings("cups_maestro");
    await limpiarEmbeddings("cie10_maestro");
  }

  const inicio = Date.now();

  await procesarTabla("cups_maestro");
  await procesarTabla("cie10_maestro");

  const duracion = Date.now() - inicio;
  console.log(`\n🏁 Todo completado en ${formatDuration(duracion)}`);
}

main().catch(console.error);
