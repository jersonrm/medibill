/**
 * Seed Script — Catálogo de Glosas y Devoluciones → Supabase
 *
 * Lee el archivo catalogo_glosas_medibill.json y puebla la tabla
 * `catalogo_causales_glosa` con todos los códigos taxativos.
 *
 * Uso:
 *   npx tsx scripts/seed-catalogo-glosas.ts
 *
 * Requiere:
 *   - Variables de entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   - Tabla catalogo_causales_glosa creada (ver schema-glosas.sql)
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Cargar .env.local (Next.js usa .env.local, no .env)
dotenv.config({ path: resolve(import.meta.dirname ?? __dirname, "../.env.local") });

// =====================================================================
// CONFIG
// =====================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================================
// TIPOS LOCALES
// =====================================================================

interface SubcausalJSON {
  codigo: string;
  descripcion: string;
  prevenible?: boolean;
  accion?: string;
}

interface CodigoGlosaJSON {
  codigo: string;
  especifico: string;
  subcausales: SubcausalJSON[];
}

interface ConceptoGlosaJSON {
  concepto_general: string;
  definicion: string;
  capa_medibill_predominante: number;
  codigos: CodigoGlosaJSON[];
  notas?: string;
}

interface DevolucionJSON {
  codigo: string;
  descripcion: string;
  afecta: string;
  capa_medibill: number;
  prevenible: boolean;
  accion_medibill: string;
  subcausales: { codigo: string; descripcion: string }[];
  notas?: string;
}

interface CatalogoJSON {
  devoluciones: DevolucionJSON[];
  glosas: Record<string, ConceptoGlosaJSON>;
}

/** Registro para insertar en la tabla */
interface RegistroCausal {
  tipo: "devolucion" | "glosa";
  concepto: string;
  concepto_desc: string;
  codigo: string;
  descripcion: string;
  codigo_padre: string | null;
  afecta: string | null;
  capa_medibill: number;
  prevenible: boolean;
  accion_medibill: string | null;
  notas: string | null;
}

// =====================================================================
// PROCESAMIENTO
// =====================================================================

function procesarCatalogo(catalogo: CatalogoJSON): RegistroCausal[] {
  const registros: RegistroCausal[] = [];

  // 1. Devoluciones
  for (const dev of catalogo.devoluciones) {
    // Registro padre (ej: DE16)
    registros.push({
      tipo: "devolucion",
      concepto: "DE",
      concepto_desc: "DEVOLUCIÓN",
      codigo: dev.codigo,
      descripcion: dev.descripcion,
      codigo_padre: null,
      afecta: dev.afecta,
      capa_medibill: dev.capa_medibill,
      prevenible: dev.prevenible,
      accion_medibill: dev.accion_medibill,
      notas: dev.notas ?? null,
    });

    // Subcausales (ej: DE1601)
    for (const sub of dev.subcausales) {
      registros.push({
        tipo: "devolucion",
        concepto: "DE",
        concepto_desc: "DEVOLUCIÓN",
        codigo: sub.codigo,
        descripcion: sub.descripcion,
        codigo_padre: dev.codigo,
        afecta: dev.afecta,
        capa_medibill: dev.capa_medibill,
        prevenible: dev.prevenible,
        accion_medibill: dev.accion_medibill,
        notas: null,
      });
    }
  }

  // 2. Glosas (FA, TA, SO, AU, PE, SC)
  for (const [concepto, datos] of Object.entries(catalogo.glosas)) {
    for (const codEspec of datos.codigos) {
      // Registro del código específico (ej: FA01)
      registros.push({
        tipo: "glosa",
        concepto,
        concepto_desc: datos.concepto_general,
        codigo: codEspec.codigo,
        descripcion: codEspec.especifico,
        codigo_padre: null,
        afecta: "parcial",
        capa_medibill: datos.capa_medibill_predominante,
        prevenible: true,
        accion_medibill: null,
        notas: datos.notas ?? null,
      });

      // Subcausales (ej: FA0101, FA0102)
      for (const sub of codEspec.subcausales) {
        registros.push({
          tipo: "glosa",
          concepto,
          concepto_desc: datos.concepto_general,
          codigo: sub.codigo,
          descripcion: sub.descripcion,
          codigo_padre: codEspec.codigo,
          afecta: "parcial",
          capa_medibill: datos.capa_medibill_predominante,
          prevenible: sub.prevenible ?? true,
          accion_medibill: sub.accion ?? null,
          notas: null,
        });
      }
    }
  }

  return registros;
}

// =====================================================================
// INSERCIÓN EN SUPABASE
// =====================================================================

async function insertarRegistros(registros: RegistroCausal[]) {
  console.log(`📋 Total de registros a insertar: ${registros.length}`);

  // Separar padres e hijos (los padres deben insertarse primero por la FK)
  const padres = registros.filter((r) => r.codigo_padre === null);
  const hijos = registros.filter((r) => r.codigo_padre !== null);

  console.log(`   └─ Padres (códigos específicos): ${padres.length}`);
  console.log(`   └─ Hijos (subcausales): ${hijos.length}`);

  // Limpiar tabla existente
  console.log("🗑️  Limpiando registros existentes...");
  const { error: delError } = await supabase
    .from("catalogo_causales_glosa")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
  if (delError) {
    console.warn("⚠️  Error limpiando tabla (puede estar vacía):", delError.message);
  }

  // Insertar padres en lotes de 50
  console.log("📥 Insertando códigos específicos (padres)...");
  for (let i = 0; i < padres.length; i += 50) {
    const lote = padres.slice(i, i + 50);
    const { error } = await supabase
      .from("catalogo_causales_glosa")
      .insert(lote);
    if (error) {
      console.error(`❌ Error insertando padres lote ${i / 50 + 1}:`, error.message);
      // Intentar uno por uno para identificar el conflicto
      for (const reg of lote) {
        const { error: errIndiv } = await supabase
          .from("catalogo_causales_glosa")
          .insert(reg);
        if (errIndiv) {
          console.error(`   💥 Código ${reg.codigo}: ${errIndiv.message}`);
        }
      }
    } else {
      console.log(`   ✅ Lote ${Math.floor(i / 50) + 1}: ${lote.length} registros`);
    }
  }

  // Insertar hijos en lotes de 50
  console.log("📥 Insertando subcausales (hijos)...");
  for (let i = 0; i < hijos.length; i += 50) {
    const lote = hijos.slice(i, i + 50);
    const { error } = await supabase
      .from("catalogo_causales_glosa")
      .insert(lote);
    if (error) {
      console.error(`❌ Error insertando hijos lote ${i / 50 + 1}:`, error.message);
      for (const reg of lote) {
        const { error: errIndiv } = await supabase
          .from("catalogo_causales_glosa")
          .insert(reg);
        if (errIndiv) {
          console.error(`   💥 Código ${reg.codigo}: ${errIndiv.message}`);
        }
      }
    } else {
      console.log(`   ✅ Lote ${Math.floor(i / 50) + 1}: ${lote.length} registros`);
    }
  }
}

// =====================================================================
// VERIFICACIÓN POST-SEED
// =====================================================================

async function verificar() {
  // Traer todos los registros para verificar
  const { data: todos, error } = await supabase
    .from("catalogo_causales_glosa")
    .select("codigo, codigo_padre, tipo, concepto")
    .order("concepto");

  if (error) {
    console.error("❌ Error verificando:", error.message);
    return;
  }

  const registros = todos ?? [];
  console.log(`\n✅ Seed completado. Total en BD: ${registros.length} registros.`);

  // Conteo por tipo
  const porTipo: Record<string, number> = {};
  for (const r of registros) {
    porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1;
  }
  console.log("\n📊 Distribución por tipo:");
  for (const [tipo, n] of Object.entries(porTipo).sort()) {
    console.log(`   ${tipo}: ${n} registros`);
  }

  // Conteo por concepto
  const porConcepto: Record<string, number> = {};
  for (const r of registros) {
    porConcepto[r.concepto] = (porConcepto[r.concepto] ?? 0) + 1;
  }
  console.log("\n📊 Distribución por concepto:");
  for (const [concepto, n] of Object.entries(porConcepto).sort()) {
    console.log(`   ${concepto}: ${n} registros`);
  }

  // Verificar integridad de FK
  const codigosSet = new Set(registros.map((r) => r.codigo));
  const huerfanos = registros.filter(
    (r) => r.codigo_padre && !codigosSet.has(r.codigo_padre)
  );

  if (huerfanos.length > 0) {
    console.warn(`\n⚠️  ${huerfanos.length} subcausales sin padre válido:`);
    for (const h of huerfanos.slice(0, 5)) {
      console.warn(`   ${h.codigo} → padre: ${h.codigo_padre}`);
    }
  } else {
    const conPadre = registros.filter((r) => r.codigo_padre).length;
    console.log(`\n✅ Integridad referencial: OK (${conPadre} hijos, todos con padre válido)`);
  }
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Seed: Catálogo de Glosas y Devoluciones → Supabase");
  console.log(" Res. 2284/2023 + Circular 007/2025");
  console.log("═══════════════════════════════════════════════════════\n");

  // Leer JSON
  const ruta = resolve(import.meta.dirname ?? __dirname, "../data/catalogo_glosas_medibill.json");
  console.log(`📄 Leyendo: ${ruta}`);
  const raw = readFileSync(ruta, "utf-8");
  const catalogo = JSON.parse(raw) as CatalogoJSON;

  // Procesar
  const registros = procesarCatalogo(catalogo);

  // Estadísticas
  const devoluciones = registros.filter((r) => r.tipo === "devolucion");
  const glosas = registros.filter((r) => r.tipo === "glosa");
  console.log(`\n📊 Estadísticas del catálogo:`);
  console.log(`   Devoluciones: ${devoluciones.length} registros`);
  console.log(`   Glosas: ${glosas.length} registros`);
  console.log(`   Total: ${registros.length} registros\n`);

  // Insertar
  await insertarRegistros(registros);

  // Verificar
  await verificar();

  console.log("\n🏁 Proceso finalizado.");
}

main().catch((e) => {
  console.error("💥 Error fatal:", e);
  process.exit(1);
});
