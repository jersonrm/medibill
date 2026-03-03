import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import { fileURLToPath } from "url";

// --- Configuración ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_PATH = path.resolve(__dirname, "../data/CIE10 2026.xlsx");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variables de entorno requeridas:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Nombres de columnas del Excel ---
const COL = {
  CAPITULO: "Capitulo",
  NOMBRE_CAPITULO: "Nombre Capitulo",
  CODIGO_3: "Código de la CIE-10 tres caracteres",
  DESC_3: "Descripcion  de codigos a tres caracteres",
  CODIGO_4: "Código de la CIE-10 cuatro caracteres",
  DESC_4: "Descripcion  de códigos a cuatro caracteres",
};

// --- Validación: código CIE-10 válido (3 o 4 caracteres alfanuméricos) ---
function esCodigoCie10Valido(codigo: string): boolean {
  // Patrón: 1 letra + 2 dígitos (3 chars) o 1 letra + 2 dígitos + 1 alfanumérico (4 chars)
  return /^[A-Z]\d{2}[0-9A-Z]?$/i.test(codigo);
}

interface Cie10Row {
  codigo: string;
  descripcion: string;
  codigo_3: string;
  descripcion_3: string;
  capitulo: number;
  nombre_capitulo: string;
}

async function importarCie10() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   IMPORTADOR CIE-10 - Colombia 2026                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`📂 Archivo: ${EXCEL_PATH}\n`);

  let workbook: any;
  try {
    workbook = XLSX.readFile(EXCEL_PATH);
  } catch (err) {
    console.error("❌ No se pudo leer el archivo Excel.");
    console.error(`   Ruta esperada: ${EXCEL_PATH}`);
    console.error(err);
    process.exit(1);
  }

  // Solo nos interesa la pestaña "Final"
  const SHEET_NAME = "Final";
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`❌ No se encontró la pestaña "${SHEET_NAME}"`);
    console.error(`   Pestañas disponibles: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`📄 Pestaña "${SHEET_NAME}": ${rows.length} filas\n`);

  if (rows.length === 0) {
    console.error("❌ La pestaña está vacía.");
    process.exit(1);
  }

  // Verificar columnas esperadas
  const primeraFila = rows[0]!;
  const columnasPresentes = Object.keys(primeraFila);
  const columnasRequeridas = [COL.CODIGO_4, COL.DESC_4];
  for (const col of columnasRequeridas) {
    if (!columnasPresentes.some((c) => c.includes(col.substring(0, 20)))) {
      console.error(`❌ No se encontró la columna "${col}"`);
      console.error(`   Columnas disponibles: ${columnasPresentes.join(", ")}`);
      process.exit(1);
    }
  }

  console.log("📌 Columnas detectadas correctamente\n");

  // Procesar filas
  const todosLosCie10: Cie10Row[] = [];
  let descartados = 0;
  const muestraDescartados: string[] = [];

  for (const row of rows) {
    const codigo4 = String(row[COL.CODIGO_4] ?? "").trim().replace(/\s+/g, "");
    const desc4 = String(row[COL.DESC_4] ?? "").trim();
    const codigo3 = String(row[COL.CODIGO_3] ?? "").trim().replace(/\s+/g, "");
    const desc3 = String(row[COL.DESC_3] ?? "").trim();
    const capitulo = Number(row[COL.CAPITULO]) || 0;
    const nombreCapitulo = String(row[COL.NOMBRE_CAPITULO] ?? "").trim();

    // Saltar filas sin código de 4 caracteres
    if (!codigo4 || !desc4 || desc4.length < 3) {
      descartados++;
      continue;
    }

    // Validar formato del código
    if (!esCodigoCie10Valido(codigo4)) {
      descartados++;
      if (muestraDescartados.length < 5) {
        muestraDescartados.push(`${codigo4} → ${desc4.substring(0, 50)}`);
      }
      continue;
    }

    todosLosCie10.push({
      codigo: codigo4.toUpperCase(),
      descripcion: desc4,
      codigo_3: codigo3.toUpperCase(),
      descripcion_3: desc3,
      capitulo,
      nombre_capitulo: nombreCapitulo,
    });
  }

  // Resumen pre-importación
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 Total CIE-10 a importar: ${todosLosCie10.length}`);
  console.log(`⏭️  Filas descartadas: ${descartados}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (muestraDescartados.length > 0) {
    console.log("📝 Ejemplos descartados:");
    for (const m of muestraDescartados) {
      console.log(`   - ${m}`);
    }
    console.log("");
  }

  if (todosLosCie10.length === 0) {
    console.error("❌ No se encontraron códigos CIE-10 válidos.");
    process.exit(1);
  }

  // Muestra por capítulo
  console.log("📋 Muestra de registros por capítulo:");
  const capitulosVistos = new Set<number>();
  for (const cie of todosLosCie10) {
    if (!capitulosVistos.has(cie.capitulo) && capitulosVistos.size < 10) {
      capitulosVistos.add(cie.capitulo);
      console.log(`   Cap ${String(cie.capitulo).padStart(2)} | ${cie.codigo} | ${cie.descripcion.substring(0, 60)}`);
    }
  }
  console.log("");

  // Insertar en lotes
  const BATCH_SIZE = 500;
  let insertados = 0;
  let errores = 0;

  console.log("🚀 Importando a Supabase...\n");

  for (let i = 0; i < todosLosCie10.length; i += BATCH_SIZE) {
    const batch = todosLosCie10.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(todosLosCie10.length / BATCH_SIZE);

    const { error } = await supabase
      .from("cie10_maestro")
      .upsert(batch, {
        onConflict: "codigo",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`   ❌ Lote ${batchNum}/${totalBatches}: ${error.message}`);
      errores += batch.length;
    } else {
      insertados += batch.length;
      const pct = Math.round((insertados / todosLosCie10.length) * 100);
      console.log(`   ✅ Lote ${batchNum}/${totalBatches}: ${batch.length} registros [${pct}%]`);
    }
  }

  // Resultado final
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  RESULTADO FINAL                        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  ✅ Insertados/actualizados: ${String(insertados).padEnd(28)}║`);
  console.log(`║  ❌ Errores:                 ${String(errores).padEnd(28)}║`);
  console.log(`║  ⏭️  Descartados:             ${String(descartados).padEnd(28)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
}

importarCie10().catch((err) => {
  console.error("💥 Error fatal:", err);
  process.exit(1);
});
