/**
 * Script: Importar jerarquía CUPS a cups_maestro.contexto_jerarquico
 * 
 * Lee el Excel cups_vigentes.xlsx, extrae códigos padre (2-5 dígitos),
 * construye la cadena jerárquica en memoria, y actualiza cups_maestro
 * directamente. NO requiere tablas ni funciones SQL adicionales.
 * 
 * Requisito previo (una sola vez en Supabase SQL Editor):
 *   ALTER TABLE cups_maestro ADD COLUMN IF NOT EXISTS contexto_jerarquico TEXT;
 * 
 * Ejecución:
 *   npx tsx apps/web/scripts/importar-cups-jerarquia.ts
 * 
 * Requiere:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local desde la raíz de la app web
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { createClient } from "@supabase/supabase-js";

const EXCEL_PATH = path.resolve(__dirname, "../data/cups_vigentes.xlsx");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Regex para detectar códigos padre (2-5 dígitos numéricos)
const REGEX_CODIGO_PADRE = /^\d{2,5}$/;

// Palabras clave que NO son códigos
const PALABRAS_EXCLUIR = [
  "incluye", "excluye", "nota", "sección", "seccion",
  "capítulo", "capitulo", "código", "codigo", "descripción",
  "descripcion", "simultáneo", "simultaneo",
];

/**
 * Construye la cadena jerárquica para un código CUPS de 6 dígitos.
 * Ej: "862603" → "PROCEDIMIENTOS EN PIEL > ESCISIÓN O ABLACIÓN > OTROS DESBRIDAMIENTOS"
 */
function construirJerarquia(codigo: string, mapaCategoria: Map<string, string>): string | null {
  const partes: string[] = [];

  for (let len = 2; len <= Math.min(codigo.length - 1, 5); len++) {
    const prefijo = codigo.substring(0, len);
    const desc = mapaCategoria.get(prefijo);
    if (desc) {
      partes.push(desc);
    }
  }

  return partes.length > 0 ? partes.join(" > ") : null;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   IMPORTADOR DE JERARQUÍA CUPS (in-memory → update)    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`📂 Archivo: ${EXCEL_PATH}\n`);

  // --- Paso 1: Leer Excel y extraer códigos padre ---
  let workbook: any;
  try {
    workbook = XLSX.readFile(EXCEL_PATH);
  } catch (err) {
    console.error("❌ No se pudo leer el archivo Excel:", err);
    process.exit(1);
  }

  const sheet = workbook.Sheets["ANEXO 2"];
  if (!sheet) {
    console.error("❌ No se encontró la pestaña 'ANEXO 2'");
    process.exit(1);
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`📋 Total filas en ANEXO 2: ${rows.length}`);

  const codCol = Object.keys(rows[0]!)[0]!;
  const descCol = Object.keys(rows[0]!)[1]!;

  // Construir mapa de categorías en memoria
  const mapaCategoria = new Map<string, string>();

  for (const row of rows) {
    const rawCodigo = String(row[codCol] ?? "").trim().replace(/\s+/g, "");
    const rawDescripcion = String(row[descCol] ?? "").trim();

    if (!rawCodigo || !rawDescripcion || rawDescripcion.length < 3) continue;

    const codigoLower = rawCodigo.toLowerCase().replace(":", "");
    if (PALABRAS_EXCLUIR.some((p) => codigoLower.startsWith(p))) continue;

    if (!REGEX_CODIGO_PADRE.test(rawCodigo)) continue;

    if (!mapaCategoria.has(rawCodigo)) {
      mapaCategoria.set(rawCodigo, rawDescripcion.toUpperCase());
    }
  }

  const nivel2 = Array.from(mapaCategoria.keys()).filter(k => k.length === 2).length;
  const nivel3 = Array.from(mapaCategoria.keys()).filter(k => k.length === 3).length;
  const nivel4 = Array.from(mapaCategoria.keys()).filter(k => k.length === 4).length;

  console.log(`\n📊 Categorías en memoria: ${mapaCategoria.size}`);
  console.log(`   Nivel 2 (sección):    ${nivel2}`);
  console.log(`   Nivel 3 (grupo):      ${nivel3}`);
  console.log(`   Nivel 4 (subgrupo):   ${nivel4}`);

  // Muestra
  console.log("\n📋 Muestra de jerarquía:");
  const codigosPrueba = ["862603", "993107", "902213", "965901", "869501"];
  for (const cod of codigosPrueba) {
    const jerarquia = construirJerarquia(cod, mapaCategoria);
    console.log(`   ${cod} → ${jerarquia || "(sin jerarquía)"}`);
  }

  // --- Paso 2: Obtener todos los CUPS de 6 dígitos de cups_maestro ---
  console.log("\n🔄 Obteniendo CUPS de Supabase...");

  const { data: cupsMaestro, error: fetchError } = await supabase
    .from("cups_maestro")
    .select("codigo")
    .eq("vigente", true)
    .order("codigo");

  if (fetchError) {
    console.error("❌ Error obteniendo cups_maestro:", fetchError.message);
    process.exit(1);
  }

  if (!cupsMaestro || cupsMaestro.length === 0) {
    console.error("❌ cups_maestro está vacía");
    process.exit(1);
  }

  console.log(`📋 CUPS en base de datos: ${cupsMaestro.length}`);

  // --- Paso 3: Calcular y actualizar contexto jerárquico ---
  console.log("🚀 Actualizando contexto_jerarquico...\n");

  const BATCH_SIZE = 100;
  let actualizados = 0;
  let sinContexto = 0;
  let errores = 0;

  for (let i = 0; i < cupsMaestro.length; i += BATCH_SIZE) {
    const batch = cupsMaestro.slice(i, i + BATCH_SIZE);

    // Calcular jerarquía para cada CUPS del batch
    const updates = batch
      .map((row) => ({
        codigo: row.codigo,
        contexto_jerarquico: construirJerarquia(row.codigo, mapaCategoria),
      }))
      .filter((u) => u.contexto_jerarquico !== null);

    sinContexto += batch.length - updates.length;

    if (updates.length === 0) continue;

    // Actualizar en paralelo (Promise.all con updates individuales)
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("cups_maestro")
          .update({ contexto_jerarquico: u.contexto_jerarquico })
          .eq("codigo", u.codigo)
      )
    );

    const batchErrors = results.filter((r) => r.error);
    if (batchErrors.length > 0) {
      errores += batchErrors.length;
      console.error(`   ⚠️  ${batchErrors.length} errores en batch ${i}`);
      // Si el error es que la columna no existe, abortar con instrucciones
      const firstError = batchErrors[0]!.error!;
      if (firstError.message.includes("contexto_jerarquico")) {
        console.error("\n❌ La columna 'contexto_jerarquico' no existe en cups_maestro.");
        console.error("   Ejecuta primero en Supabase SQL Editor:");
        console.error("   ALTER TABLE cups_maestro ADD COLUMN IF NOT EXISTS contexto_jerarquico TEXT;\n");
        process.exit(1);
      }
    }

    actualizados += updates.length - batchErrors.length;

    const pct = Math.round(((i + batch.length) / cupsMaestro.length) * 100);
    if (pct % 10 === 0 || i + batch.length >= cupsMaestro.length) {
      console.log(`   ✅ ${actualizados} actualizados [${pct}%]`);
    }
  }

  // --- Resultado final ---
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  RESULTADO FINAL                        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  ✅ Actualizados:     ${String(actualizados).padEnd(35)}║`);
  console.log(`║  ⏭️  Sin contexto:     ${String(sinContexto).padEnd(35)}║`);
  console.log(`║  ❌ Errores:          ${String(errores).padEnd(35)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Verificación final
  console.log("\n📋 Verificación — CUPS con contexto jerárquico:");
  for (const cod of codigosPrueba) {
    const { data } = await supabase
      .from("cups_maestro")
      .select("codigo, descripcion, contexto_jerarquico")
      .eq("codigo", cod)
      .limit(1)
      .single();

    if (data) {
      console.log(`   ${data.codigo} | ${(data.descripcion as string).substring(0, 50)}`);
      console.log(`           ↳ ${data.contexto_jerarquico || "(sin contexto)"}`);
    }
  }

  console.log("\n✅ ¡Listo! Los CUPS ahora tienen contexto jerárquico.");
}

main().catch((err) => {
  console.error("💥 Error fatal:", err);
  process.exit(1);
});
