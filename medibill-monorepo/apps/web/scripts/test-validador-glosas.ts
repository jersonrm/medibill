/**
 * Test Script — Validador de Glosas contra Datos de Prueba
 *
 * Lee las 7 facturas FEV-PRUEBA-001..007 de Supabase, carga el acuerdo
 * de voluntades + tarifas + reglas de coherencia, ejecuta validarFactura()
 * y compara las glosas detectadas con las esperadas.
 *
 * Uso:
 *   npx tsx scripts/test-validador-glosas.ts
 *
 * Requiere:
 *   - Variables de entorno en .env.local
 *   - Datos de prueba insertados (ver seed-datos-prueba.ts)
 *   - Catálogo de causales poblado (ver seed-catalogo-glosas.ts)
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { validarFactura } from "@/lib/validador-glosas";
import type { FacturaDB, ReglaCoherenciaDB } from "@/lib/types/glosas";

// Cargar .env.local
dotenv.config({ path: resolve(import.meta.dirname ?? __dirname, "../.env.local") });

// =====================================================================
// CONFIG
// =====================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MARCA_PRUEBA = "es_dato_prueba";

// =====================================================================
// ESCENARIOS ESPERADOS
// =====================================================================

interface Escenario {
  num_factura: string;
  etiqueta: string;
  glosas_esperadas: string[];
}

const ESCENARIOS: Escenario[] = [
  { num_factura: "FEV-PRUEBA-001", etiqueta: "PERFECTA",       glosas_esperadas: [] },
  { num_factura: "FEV-PRUEBA-002", etiqueta: "ERROR TARIFA",   glosas_esperadas: ["TA0201"] },
  { num_factura: "FEV-PRUEBA-003", etiqueta: "SIN SOPORTES",   glosas_esperadas: ["SO3405", "SO3701"] },
  { num_factura: "FEV-PRUEBA-004", etiqueta: "DX INCOHERENTE", glosas_esperadas: ["PE0101"] },
  { num_factura: "FEV-PRUEBA-005", etiqueta: "FUERA DE PLAZO", glosas_esperadas: ["DE5601"] },
  { num_factura: "FEV-PRUEBA-006", etiqueta: "SIN AUTORIZ.",   glosas_esperadas: ["AU0101", "SO2101"] },
  { num_factura: "FEV-PRUEBA-007", etiqueta: "CATASTRÓFICA",   glosas_esperadas: ["TA0201", "TA0801", "PE0101", "SO3405", "AU0101", "DE5601"] },
];

// =====================================================================
// CARGA DE DATOS
// =====================================================================

async function cargarFacturas(): Promise<FacturaDB[]> {
  const nums = ESCENARIOS.map((e) => e.num_factura);
  const { data, error } = await supabase
    .from("facturas")
    .select("*")
    .in("num_factura", nums)
    .order("num_factura");

  if (error) {
    console.error("❌ Error cargando facturas:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error("❌ No se encontraron facturas de prueba. ¿Ejecutaste seed-datos-prueba.ts?");
    process.exit(1);
  }
  return data as FacturaDB[];
}

interface AcuerdoConTarifas {
  id: string;
  eps_codigo: string;
  nombre_eps: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  requiere_autorizacion: boolean;
  tarifas: { cups_codigo: string; valor_pactado: number }[];
}

async function cargarAcuerdos(): Promise<Map<string, AcuerdoConTarifas>> {
  const { data: acuerdos, error } = await supabase
    .from("acuerdos_voluntades")
    .select("id, eps_codigo, nombre_eps, fecha_inicio, fecha_fin, requiere_autorizacion, observaciones")
    .like("observaciones", `%${MARCA_PRUEBA}%`);

  if (error) {
    console.error("❌ Error cargando acuerdos:", error.message);
    process.exit(1);
  }

  const mapa = new Map<string, AcuerdoConTarifas>();

  for (const a of acuerdos ?? []) {
    const { data: tarifas } = await supabase
      .from("acuerdo_tarifas")
      .select("cups_codigo, valor_pactado")
      .eq("acuerdo_id", a.id);

    mapa.set(a.eps_codigo, {
      id: a.id,
      eps_codigo: a.eps_codigo,
      nombre_eps: a.nombre_eps,
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      requiere_autorizacion: a.requiere_autorizacion,
      tarifas: (tarifas ?? []).map((t) => ({
        cups_codigo: t.cups_codigo,
        valor_pactado: Number(t.valor_pactado),
      })),
    });
  }

  return mapa;
}

async function cargarReglasCoherencia(): Promise<ReglaCoherenciaDB[]> {
  const { data, error } = await supabase
    .from("reglas_coherencia")
    .select("*")
    .eq("activo", true);

  if (error) {
    console.error("⚠️  Error cargando reglas de coherencia:", error.message);
    return [];
  }
  return (data ?? []) as ReglaCoherenciaDB[];
}

// =====================================================================
// EJECUCIÓN DE VALIDACIÓN
// =====================================================================

interface ResultadoTest {
  idx: number;
  etiqueta: string;
  esperado: string[];
  detectado: string[];
  ok: boolean;
}

function ejecutarTest(
  factura: FacturaDB,
  escenario: Escenario,
  acuerdos: Map<string, AcuerdoConTarifas>,
  reglas: ReglaCoherenciaDB[],
  idx: number,
): ResultadoTest {
  const epsCode = factura.nit_erp;
  const acuerdo = acuerdos.get(epsCode);

  // Extensión de vigencia del acuerdo para cubrir la fecha de la factura
  // (los acuerdos de prueba tienen fechas estáticas, la validación puede
  //  ejecutarse en cualquier momento)
  let acuerdoAjustado = acuerdo;
  if (acuerdo) {
    const fechaFact = new Date(factura.fecha_expedicion);
    const fechaFin = new Date(acuerdo.fecha_fin);
    const hoy = new Date();
    // Extender vigencia si la fecha de la factura o la fecha actual exceden el fin
    if (fechaFact > fechaFin || hoy > fechaFin) {
      acuerdoAjustado = {
        ...acuerdo,
        fecha_fin: new Date(Math.max(fechaFact.getTime(), hoy.getTime()) + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      };
    }
  }

  const resultado = validarFactura({
    factura,
    acuerdo: acuerdoAjustado,
    reglasCoherencia: reglas,
    facturasExistentes: [],
    fechaReferencia: new Date(), // usar hoy como referencia
  });

  // Códigos únicos detectados
  const detectado = resultado.glosas_potenciales_prevenidas.sort();
  const esperado = [...escenario.glosas_esperadas].sort();

  // Comparación de conjuntos
  const ok =
    esperado.length === detectado.length &&
    esperado.every((c) => detectado.includes(c));

  return { idx, etiqueta: escenario.etiqueta, esperado, detectado, ok };
}

// =====================================================================
// FORMATEO DE TABLA
// =====================================================================

function formatCodigos(codigos: string[]): string {
  if (codigos.length === 0) return "Ninguna";
  return codigos.join(", ");
}

function truncar(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function imprimirTabla(resultados: ResultadoTest[]) {
  // Header
  const sep = "─";
  const colNum = 4;
  const colFact = 17;
  const colEsp = 32;
  const colDet = 32;
  const colOk = 5;

  const pad = (s: string, n: number) => s.padEnd(n);
  const padC = (s: string, n: number) => {
    const total = n - s.length;
    const left = Math.floor(total / 2);
    return " ".repeat(left) + s + " ".repeat(total - left);
  };

  console.log();
  console.log(
    `| ${pad("#", colNum)} | ${pad("Factura", colFact)} | ${pad("Esperado", colEsp)} | ${pad("Detectado", colDet)} | ${padC("✓/✗", colOk)} |`,
  );
  console.log(
    `|${sep.repeat(colNum + 2)}|${sep.repeat(colFact + 2)}|${sep.repeat(colEsp + 2)}|${sep.repeat(colDet + 2)}|${sep.repeat(colOk + 2)}|`,
  );

  for (const r of resultados) {
    const num = String(r.idx).padStart(colNum);
    const fact = pad(r.etiqueta, colFact);
    const esp = pad(truncar(formatCodigos(r.esperado), colEsp), colEsp);
    const det = pad(truncar(formatCodigos(r.detectado), colDet), colDet);
    const ok = padC(r.ok ? "✓" : "✗", colOk);

    console.log(`| ${num} | ${fact} | ${esp} | ${det} | ${ok} |`);
  }
  console.log();
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Test: Validador de Glosas — 7 Escenarios de Prueba");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📅 ${new Date().toLocaleDateString("es-CO")} ${new Date().toLocaleTimeString("es-CO")}`);
  console.log(`🔗 ${SUPABASE_URL}\n`);

  // 1. Cargar datos
  console.log("📂 Cargando datos de Supabase...");
  const [facturas, acuerdos, reglas] = await Promise.all([
    cargarFacturas(),
    cargarAcuerdos(),
    cargarReglasCoherencia(),
  ]);

  console.log(`   ✓ ${facturas.length} facturas`);
  console.log(`   ✓ ${acuerdos.size} acuerdos de voluntades`);
  console.log(`   ✓ ${reglas.length} reglas de coherencia`);

  // 2. Ejecutar validación para cada escenario
  console.log("\n🔍 Ejecutando validaciones...\n");
  const resultados: ResultadoTest[] = [];

  for (let i = 0; i < ESCENARIOS.length; i++) {
    const escenario = ESCENARIOS[i]!;
    const factura = facturas.find((f) => f.num_factura === escenario.num_factura);

    if (!factura) {
      console.error(`   ❌ Factura ${escenario.num_factura} no encontrada en BD`);
      resultados.push({
        idx: i + 1,
        etiqueta: escenario.etiqueta,
        esperado: escenario.glosas_esperadas,
        detectado: [],
        ok: false,
      });
      continue;
    }

    const resultado = ejecutarTest(factura, escenario, acuerdos, reglas, i + 1);
    resultados.push(resultado);

    const symbol = resultado.ok ? "✓" : "✗";
    console.log(`   ${symbol} ${escenario.num_factura} — ${escenario.etiqueta}`);
    if (!resultado.ok) {
      console.log(`     Esperado:  ${formatCodigos(resultado.esperado)}`);
      console.log(`     Detectado: ${formatCodigos(resultado.detectado)}`);
    }
  }

  // 3. Tabla resumen
  imprimirTabla(resultados);

  // 4. Resultado final
  const aprobados = resultados.filter((r) => r.ok).length;
  const total = resultados.length;
  const emoji = aprobados === total ? "🎉" : "⚠️";

  console.log(`${emoji} RESULTADO: ${aprobados}/${total} escenarios validados correctamente\n`);

  // Detalle de fallos
  const fallos = resultados.filter((r) => !r.ok);
  if (fallos.length > 0) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  DETALLE DE FALLOS");
    console.log("═══════════════════════════════════════════════════════════\n");

    for (const f of fallos) {
      console.log(`  #${f.idx} ${f.etiqueta}:`);

      // Códigos faltantes (esperados pero no detectados)
      const faltantes = f.esperado.filter((c) => !f.detectado.includes(c));
      if (faltantes.length > 0) {
        console.log(`    Faltantes (esperados, no detectados): ${faltantes.join(", ")}`);
      }

      // Códigos sobrantes (detectados pero no esperados)
      const sobrantes = f.detectado.filter((c) => !f.esperado.includes(c));
      if (sobrantes.length > 0) {
        console.log(`    Sobrantes (detectados, no esperados): ${sobrantes.join(", ")}`);
      }
      console.log();
    }
  }

  process.exit(aprobados === total ? 0 : 1);
}

main().catch((e) => {
  console.error("💥 Error fatal:", e);
  process.exit(1);
});
