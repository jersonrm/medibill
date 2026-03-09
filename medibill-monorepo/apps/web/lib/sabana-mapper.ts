/**
 * Mapeo inteligente de columnas de sábana EPS usando Gemini AI.
 * Incluye cache por EPS + headers_hash para reutilizar mapeos.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@/lib/supabase-server";
import type {
  MapeoColumnas,
  ResultadoMapeoIA,
  FilaSabana,
  FilaNormalizada,
  CampoEstandar,
  CAMPOS_OBLIGATORIOS,
} from "@/lib/types/sabana";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// =====================================================================
// MODELO GEMINI PARA MAPEO DE COLUMNAS
// =====================================================================

function getMapperAI() {
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no está configurada.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          mapeo: {
            type: SchemaType.OBJECT,
            description:
              "Mapeo de campos estándar a nombres de columna del archivo. Solo incluir si hay una columna que correspond",
            properties: {
              num_factura: {
                type: SchemaType.STRING,
                description: "Nombre exacto de la columna que contiene el número de factura",
                nullable: true,
              },
              valor_facturado: {
                type: SchemaType.STRING,
                description: "Columna con el valor total facturado por el prestador",
                nullable: true,
              },
              valor_pagado: {
                type: SchemaType.STRING,
                description: "Columna con el valor que la EPS pagó/aprobó",
                nullable: true,
              },
              valor_glosado: {
                type: SchemaType.STRING,
                description: "Columna con el valor glosado/objetado por la EPS",
                nullable: true,
              },
              fecha_pago: {
                type: SchemaType.STRING,
                description: "Columna con la fecha en que se realizó el pago",
                nullable: true,
              },
              referencia_pago: {
                type: SchemaType.STRING,
                description: "Columna con número de referencia, transferencia o comprobante de pago",
                nullable: true,
              },
              documento_paciente: {
                type: SchemaType.STRING,
                description: "Columna con el número de documento del paciente/afiliado",
                nullable: true,
              },
              nombre_paciente: {
                type: SchemaType.STRING,
                description: "Columna con el nombre del paciente/afiliado",
                nullable: true,
              },
              observacion: {
                type: SchemaType.STRING,
                description: "Columna con observaciones, notas o motivo de glosa",
                nullable: true,
              },
            },
          },
          columnas_no_mapeadas: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Nombres de columnas del archivo que no corresponden a ningún campo estándar",
          },
          confianza: {
            type: SchemaType.NUMBER,
            description: "Nivel de confianza del mapeo, de 0.0 a 1.0",
          },
        },
        required: ["mapeo", "columnas_no_mapeadas", "confianza"],
      },
      temperature: 0.1,
      topP: 0.5,
      topK: 20,
    },
    systemInstruction: `Eres un experto en facturación de salud colombiana. Tu tarea es mapear las columnas de un archivo Excel/CSV que envía una EPS (Entidad Promotora de Salud) como reporte de pagos a un prestador de salud (médico o IPS).

Contexto:
- En Colombia, las EPS envían "sábanas de pagos" a los prestadores con el detalle de las facturas pagadas, glosadas o pendientes.
- Cada EPS usa nombres de columnas diferentes, pero el contenido es similar.
- Los nombres de columnas pueden estar en español, abreviaturas, o códigos internos de la EPS.

Reglas:
1. Solo mapea una columna si estás razonablemente seguro de su correspondencia.
2. Si no hay columna que corresponda a un campo, NO lo incluyas en el mapeo (déjalo null).
3. El valor del mapeo debe ser el nombre EXACTO de la columna como aparece en el archivo.
4. Columnas que no corresponden a ningún campo estándar van en "columnas_no_mapeadas".
5. La confianza debe reflejar qué tan claro es el mapeo (>0.9 si los nombres son obvios, <0.7 si es ambiguo).`,
  });
}

// =====================================================================
// HASH DE HEADERS (para cache)
// =====================================================================

/**
 * Genera un hash determinista de los headers para usarlo como clave de cache.
 * Normaliza, ordena y concatena los headers.
 */
async function generarHeadersHash(headers: string[]): Promise<string> {
  const normalized = headers
    .map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"))
    .sort()
    .join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =====================================================================
// MAPEO PRINCIPAL
// =====================================================================

/**
 * Mapea las columnas de una sábana EPS a campos estándar.
 * Primero busca en cache (tabla mapeos_sabana_eps), si no hay match llama al LLM.
 */
export async function mapearColumnasSabana(
  headers: string[],
  muestra: FilaSabana[],
  userId: string,
  nitEps?: string,
  epsNombre?: string
): Promise<ResultadoMapeoIA & { mapeo_id?: string; desde_cache: boolean }> {
  const headersHash = await generarHeadersHash(headers);

  // 1. Buscar en cache
  if (nitEps) {
    const supabase = await createClient();
    const { data: cached } = await supabase
      .from("mapeos_sabana_eps")
      .select("*")
      .eq("user_id", userId)
      .eq("nit_eps", nitEps)
      .eq("headers_hash", headersHash)
      .gte("confianza", 0.7)
      .single();

    if (cached) {
      // Incrementar veces_usado
      await supabase
        .from("mapeos_sabana_eps")
        .update({
          veces_usado: (cached.veces_usado || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cached.id);

      return {
        mapeo: cached.mapeo_json as MapeoColumnas,
        columnas_no_mapeadas: headers.filter(
          (h) =>
            !Object.values(cached.mapeo_json as MapeoColumnas).includes(h)
        ),
        confianza: cached.confianza,
        mapeo_id: cached.id,
        desde_cache: true,
      };
    }
  }

  // 2. Llamar al LLM
  const resultado = await mapearConIA(headers, muestra);

  // 3. Guardar en cache si la confianza es suficiente y tenemos datos de EPS
  let mapeoId: string | undefined;
  if (nitEps && epsNombre && resultado.confianza >= 0.6) {
    const supabase = await createClient();
    const { data: saved } = await supabase
      .from("mapeos_sabana_eps")
      .upsert(
        {
          user_id: userId,
          nit_eps: nitEps,
          eps_nombre: epsNombre,
          headers_hash: headersHash,
          mapeo_json: resultado.mapeo,
          confianza: resultado.confianza,
          veces_usado: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,nit_eps,headers_hash" }
      )
      .select("id")
      .single();

    mapeoId = saved?.id;
  }

  return { ...resultado, mapeo_id: mapeoId, desde_cache: false };
}

/**
 * Llama a Gemini para mapear las columnas.
 */
async function mapearConIA(
  headers: string[],
  muestra: FilaSabana[]
): Promise<ResultadoMapeoIA> {
  const muestraLimitada = muestra.slice(0, 5);

  const prompt = `Analiza este archivo de reporte de pagos de una EPS colombiana y mapea cada columna al campo estándar correspondiente.

COLUMNAS DEL ARCHIVO:
${JSON.stringify(headers)}

PRIMERAS ${muestraLimitada.length} FILAS DE MUESTRA:
${JSON.stringify(muestraLimitada, null, 2)}

CAMPOS ESTÁNDAR A MAPEAR:
- num_factura: número de factura del prestador
- valor_facturado: monto total que el prestador facturó
- valor_pagado: monto que la EPS efectivamente pagó/aprobó
- valor_glosado: monto que la EPS objetó/glosó
- fecha_pago: fecha en que la EPS realizó el pago
- referencia_pago: número de referencia de la transferencia bancaria o comprobante
- documento_paciente: número de cédula/documento del paciente atendido
- nombre_paciente: nombre completo del paciente
- observacion: observaciones, notas, o motivo de la glosa

Analiza tanto los nombres de las columnas como los datos de muestra para determinar el mapeo correcto.`;

  const model = getMapperAI();
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as {
    mapeo: Record<string, string | null>;
    columnas_no_mapeadas: string[];
    confianza: number;
  };

  // Filtrar nulls del mapeo
  const mapeoLimpio: MapeoColumnas = {};
  for (const [campo, columna] of Object.entries(parsed.mapeo)) {
    if (columna && headers.includes(columna)) {
      mapeoLimpio[campo as CampoEstandar] = columna;
    }
  }

  return {
    mapeo: mapeoLimpio,
    columnas_no_mapeadas: parsed.columnas_no_mapeadas || [],
    confianza: Math.max(0, Math.min(1, parsed.confianza || 0.5)),
  };
}

// =====================================================================
// APLICAR MAPEO A LAS FILAS
// =====================================================================

/**
 * Transforma filas crudas a estructura normalizada usando el mapeo de columnas.
 */
export function aplicarMapeo(
  filas: FilaSabana[],
  mapeo: MapeoColumnas
): FilaNormalizada[] {
  return filas
    .map((fila, idx) => {
      const extraerTexto = (campo: CampoEstandar): string | null => {
        const col = mapeo[campo];
        if (!col) return null;
        const val = fila[col];
        if (val === null || val === undefined) return null;
        return String(val).trim() || null;
      };

      const extraerNumero = (campo: CampoEstandar): number | null => {
        const col = mapeo[campo];
        if (!col) return null;
        const val = fila[col];
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return val;
        const num = parseFloat(String(val).replace(/[,$\s]/g, ""));
        return isNaN(num) ? null : num;
      };

      const numFactura = extraerTexto("num_factura");
      const valorPagado = extraerNumero("valor_pagado");

      // Si no tiene número de factura ni valor pagado, ignorar la fila
      if (!numFactura && valorPagado === null) return null;

      return {
        num_factura: numFactura || "",
        valor_facturado: extraerNumero("valor_facturado"),
        valor_pagado: valorPagado ?? 0,
        valor_glosado: extraerNumero("valor_glosado"),
        fecha_pago: extraerTexto("fecha_pago"),
        referencia_pago: extraerTexto("referencia_pago"),
        documento_paciente: extraerTexto("documento_paciente"),
        nombre_paciente: extraerTexto("nombre_paciente"),
        observacion: extraerTexto("observacion"),
        fila_original: idx,
      } satisfies FilaNormalizada;
    })
    .filter((f): f is FilaNormalizada => f !== null);
}
