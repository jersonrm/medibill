/*import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import { fileURLToPath } from "url";

// --- Configuración ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_PATH = path.resolve(__dirname, "../data/cups_vigentes.xlsx");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variables de entorno requeridas:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("   Agrégalas a tu .env.local o pásalas como variables de entorno.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Mapeo de pestañas (Resolución 2706 de 2025) ---
const SECCIONES: Record<string, string> = {
  "ANEXO 2": "Lista tabular de códigos",
  "ANEXO 3": "Códigos especiales para reporte población indígena",
  "ANEXO 4": "Códigos para el reporte de otras prestaciones en salud",
  "ANEXO 5": "Códigos para el reporte de información de intervenciones colectivas",
  "ANEXO 6": "Códigos para el reporte de información de gestión en salud pública",
  "ANEXO 7": "Códigos para el reporte de procedimientos e intervenciones sobre las condiciones y medio ambiente de trabajo",
};

// --- Regex de código CUPS válido por pestaña ---
const REGEX_CUPS: Record<string, RegExp> = {
  "ANEXO 2": /^\d{6}$/,                // 010101, 902210
  "ANEXO 3": /^S\d{5}$/,               // S50001
  "ANEXO 4": /^\d{3}[A-Za-z]\d{2}$/,   // 105M01, 108A01
  "ANEXO 5": /^I\d{5}$/,               // I10001
  "ANEXO 6": /^A\d{5}$/,               // A11001
  "ANEXO 7": /^T\d{5}$/,               // T10001
};

// Palabras clave en columna CÓDIGO que indican filas de notas, no códigos
const PALABRAS_EXCLUIR = [
  "incluye",
  "excluye",
  "nota",
  "sección",
  "seccion",
  "capítulo",
  "capitulo",
  "código",
  "codigo",
  "descripción",
  "descripcion",
];

// --- Detección de columnas ---
const VARIANTES_CODIGO = ["CÓDIGO", "CODIGO", "Código", "Codigo", "codigo", "COD", "Cod"];
const VARIANTES_DESCRIPCION = [
  "DESCRIPCIÓN", "DESCRIPCION", "Descripción", "Descripcion",
  "descripcion", "descripción", "DESC", "Desc",
];

function encontrarColumna(row: Record<string, unknown>, variantes: string[]): string | null {
  for (const v of variantes) {
    if (v in row && row[v] !== undefined && row[v] !== null) {
      return v;
    }
  }
  const keys = Object.keys(row);
  for (const v of variantes) {
    const found = keys.find((k) => k.trim().toUpperCase().includes(v.toUpperCase()));
    if (found) return found;
  }
  return null;
}

// --- Validación de código CUPS ---
function esCodigoCupsValido(codigo: string, seccion: string): boolean {
  const codigoLower = codigo.toLowerCase().replace(":", "").trim();
  if (PALABRAS_EXCLUIR.some((p) => codigoLower.startsWith(p))) {
    return false;
  }

  const regex = REGEX_CUPS[seccion];
  if (!regex) return false;

  return regex.test(codigo);
}

interface CupsRow {
  codigo: string;
  descripcion: string;
  seccion: string;
  seccion_nombre: string;
}

async function importarCups() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   IMPORTADOR DE CUPS - Resolución 2706 de 2025         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`📂 Archivo: ${EXCEL_PATH}\n`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(EXCEL_PATH);
  } catch (err) {
    console.error("❌ No se pudo leer el archivo Excel.");
    console.error(`   Ruta esperada: ${EXCEL_PATH}`);
    console.error(err);
    process.exit(1);
  }

  console.log(`📄 Pestañas encontradas: ${workbook.SheetNames.join(", ")}\n`);

  const todosLosCups: CupsRow[] = [];
  const estadisticas: Record<string, { validos: number; descartados: number }> = {};

  for (const sheetName of workbook.SheetNames) {
    const seccionNombre = SECCIONES[sheetName];
    if (!seccionNombre) {
      console.log(`⏭️  "${sheetName}" no es un Anexo conocido, saltando...\n`);
      continue;
    }

    console.log(`━━━ 📋 ${sheetName}: ${seccionNombre} ━━━`);
    console.log(`   Patrón esperado: ${REGEX_CUPS[sheetName]}`);

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log("   \u26a0\ufe0f  No se pudo leer la pestaña\n");
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      console.log("   ⚠️  Pestaña vacía\n");
      continue;
    }

    // Detectar columnas
    const primeraFila = rows[0];
    if (!primeraFila) {
      console.log("   \u26a0\ufe0f  Pestaña sin datos\n");
      continue;
    }
    const colCodigo = encontrarColumna(primeraFila, VARIANTES_CODIGO);
    const colDescripcion = encontrarColumna(primeraFila, VARIANTES_DESCRIPCION);

    if (!colCodigo || !colDescripcion) {
      console.log("   ⚠️  No se encontraron columnas CÓDIGO/DESCRIPCIÓN");
      console.log(`   📌 Columnas disponibles: ${Object.keys(primeraFila!).join(", ")}`);
      console.log("   ⏭️  Saltando pestaña\n");
      continue;
    }

    console.log(`   📌 Col código: "${colCodigo}" | Col descripción: "${colDescripcion}"`);

    let validos = 0;
    let descartados = 0;
    const muestraDescartados: string[] = [];

    for (const row of rows) {
      const rawCodigo = row[colCodigo];
      const rawDescripcion = row[colDescripcion];

      const codigo = String(rawCodigo ?? "").trim().replace(/\s+/g, "");
      const descripcion = String(rawDescripcion ?? "").trim();

      // Saltar filas vacías
      if (!codigo || !descripcion || descripcion.length < 3) {
        descartados++;
        continue;
      }

      // Validar si es un CUPS válido según la pestaña
      if (!esCodigoCupsValido(codigo, sheetName)) {
        descartados++;
        if (muestraDescartados.length < 3) {
          muestraDescartados.push(`${codigo} → ${descripcion.substring(0, 50)}`);
        }
        continue;
      }

      todosLosCups.push({
        codigo: codigo.toUpperCase(),
        descripcion: descripcion.toUpperCase(),
        seccion: sheetName,
        seccion_nombre: seccionNombre,
      });
      validos++;
    }

    estadisticas[sheetName] = { validos, descartados };
    console.log(`   ✅ ${validos} CUPS válidos | ⏭️ ${descartados} filas descartadas`);

    if (muestraDescartados.length > 0) {
      console.log("   📝 Ejemplos descartados:");
      for (const m of muestraDescartados) {
        console.log(`      - ${m}`);
      }
    }
    console.log("");
  }

  // Resumen pre-importación
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 Total CUPS a importar: ${todosLosCups.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (todosLosCups.length === 0) {
    console.error("❌ No se encontraron códigos CUPS válidos. Revisa la estructura del Excel.");
    process.exit(1);
  }

  // Muestra
  console.log("📋 Muestra de registros por pestaña:");
  for (const seccion of Object.keys(SECCIONES)) {
    const muestra = todosLosCups.filter((c) => c.seccion === seccion).slice(0, 2);
    for (const cup of muestra) {
      console.log(`   ${cup.seccion} | ${cup.codigo} | ${cup.descripcion.substring(0, 60)}`);
    }
  }
  console.log("");

  // Insertar en lotes
  const BATCH_SIZE = 500;
  let insertados = 0;
  let errores = 0;

  console.log("🚀 Importando a Supabase...\n");

  for (let i = 0; i < todosLosCups.length; i += BATCH_SIZE) {
    const batch = todosLosCups.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(todosLosCups.length / BATCH_SIZE);

    const { error } = await supabase
      .from("cups_maestro")
      .upsert(batch, {
        onConflict: "codigo,seccion",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`   ❌ Lote ${batchNum}/${totalBatches}: ${error.message}`);
      errores += batch.length;
    } else {
      insertados += batch.length;
      const pct = Math.round((insertados / todosLosCups.length) * 100);
      console.log(`   ✅ Lote ${batchNum}/${totalBatches}: ${batch.length} registros [${pct}%]`);
    }
  }

  // Resultado final
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  RESULTADO FINAL                        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  ✅ Insertados/actualizados: ${String(insertados).padEnd(28)}║`);
  console.log(`║  ❌ Errores:                 ${String(errores).padEnd(28)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  for (const [seccion, stats] of Object.entries(estadisticas)) {
    console.log(`║  📋 ${seccion.padEnd(12)} ${String(stats.validos).padStart(6)} válidos | ${String(stats.descartados).padStart(4)} descartados ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════╝");
}

importarCups().catch((err) => {
  console.error("💥 Error fatal:", err);
  process.exit(1);
});
*/