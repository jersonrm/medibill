/**
 * Quick diagnostic: show actual column types for cups_maestro and cie10_maestro
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Query information_schema for column types
  const { data, error } = await supabase.rpc("check_column_types" as any);
  
  if (error) {
    console.log("RPC not available, trying raw query via postgrest...");
    
    // Alternative: query a single row and check types
    const { data: cupsRow, error: cupsErr } = await supabase
      .from("cups_maestro")
      .select("*")
      .limit(1)
      .single();
    
    if (cupsErr) {
      console.error("Error querying cups_maestro:", cupsErr.message);
    } else {
      console.log("\n=== cups_maestro sample row ===");
      console.log(JSON.stringify(cupsRow, null, 2));
      console.log("\nColumn types (typeof):");
      for (const [key, value] of Object.entries(cupsRow as any)) {
        console.log(`  ${key}: ${typeof value} (value: ${JSON.stringify(value)?.substring(0, 80)})`);
      }
    }

    const { data: cie10Row, error: cie10Err } = await supabase
      .from("cie10_maestro")
      .select("*")
      .limit(1)
      .single();
    
    if (cie10Err) {
      console.error("Error querying cie10_maestro:", cie10Err.message);
    } else {
      console.log("\n=== cie10_maestro sample row ===");
      console.log(JSON.stringify(cie10Row, null, 2));
      console.log("\nColumn types (typeof):");
      for (const [key, value] of Object.entries(cie10Row as any)) {
        console.log(`  ${key}: ${typeof value} (value: ${JSON.stringify(value)?.substring(0, 80)})`);
      }
    }
  }

  // Check actual column types via information_schema
  console.log("\n\n=== Checking actual column types ===");
  const { data: colTypes, error: colErr } = await supabase
    .from("information_schema.columns" as any)
    .select("table_name, column_name, data_type, character_maximum_length")
    .in("table_name", ["cups_maestro", "cie10_maestro"])
    .order("table_name")
    .order("ordinal_position");
  
  if (colErr) {
    console.log("Cannot query information_schema directly, trying SQL...");
    // Try a raw approach - rpc
  } else {
    console.log(JSON.stringify(colTypes, null, 2));
  }

  // Also try calling each function to see the exact error
  console.log("\n\n=== Testing buscar_cups ===");
  const { data: d1, error: e1 } = await supabase.rpc("buscar_cups", {
    termino: "hemograma",
    limite: 1,
  });
  console.log("Result:", d1 ? "OK" : "ERROR");
  if (e1) console.log("Error:", e1.message, "\nDetails:", JSON.stringify(e1));

  console.log("\n=== Testing match_documents ===");
  // Fake 768-dim vector
  const fakeVector = JSON.stringify(new Array(768).fill(0.1));
  const { data: d2, error: e2 } = await supabase.rpc("match_documents", {
    query_embedding: fakeVector,
    match_count: 1,
    tipo: "cups",
  });
  console.log("Result:", d2 ? "OK" : "ERROR");
  if (e2) console.log("Error:", e2.message, "\nDetails:", JSON.stringify(e2));

  console.log("\n=== Testing buscar_cups_hibrido ===");
  const { data: d3, error: e3 } = await supabase.rpc("buscar_cups_hibrido", {
    termino_busqueda: "hemograma",
    vector_busqueda: fakeVector,
    limite: 1,
    peso_semantico: 0.6,
  });
  console.log("Result:", d3 ? "OK" : "ERROR");
  if (e3) console.log("Error:", e3.message, "\nDetails:", JSON.stringify(e3));

  console.log("\n=== Testing buscar_cie10_hibrido ===");
  const { data: d4, error: e4 } = await supabase.rpc("buscar_cie10_hibrido", {
    termino_busqueda: "diabetes",
    vector_busqueda: fakeVector,
    limite: 1,
    peso_semantico: 0.6,
  });
  console.log("Result:", d4 ? "OK" : "ERROR");
  if (e4) console.log("Error:", e4.message, "\nDetails:", JSON.stringify(e4));
}

main().catch(console.error);
