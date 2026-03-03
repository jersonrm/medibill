import { helperAI } from "@/lib/gemini";
import { buscarCupsPorTexto, buscarCupsPorCodigo } from "@/lib/cups-service";
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// --- Rate limiter in-memory ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

if (typeof globalThis !== "undefined") {
  const CLEANUP_INTERVAL = 5 * 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, CLEANUP_INTERVAL).unref?.();
}

// --- Estrategia 1: Búsqueda directa en DB (sin IA, sin costo) ---
async function busquedaDirecta(prompt: string) {
  // Si parece un código numérico, buscar por código exacto
  const soloDigitos = prompt.replace(/\s+/g, "");
  if (/^[A-Za-z]?\d{4,6}$/.test(soloDigitos)) {
    const exacto = await buscarCupsPorCodigo(soloDigitos.toUpperCase());
    if (exacto) {
      return {
        opciones: [{ codigo: exacto.codigo, desc: exacto.descripcion }],
        fuente: "db_exacta" as const,
      };
    }
  }

  // Buscar por texto en la DB con full-text search
  const resultados = await buscarCupsPorTexto(prompt, 5);

  if (resultados.length > 0) {
    return {
      opciones: resultados.map((r) => ({
        codigo: r.codigo,
        desc: r.descripcion,
      })),
      fuente: "db_fulltext" as const,
    };
  }

  return null;
}

// --- Estrategia 2: IA extrae términos médicos → busca en DB ---
async function busquedaConIA(prompt: string) {
  const result = await helperAI.generateContent(
    `Del siguiente texto médico colombiano, extrae los términos clave de procedimientos, exámenes de laboratorio o servicios de salud.
Descompón términos compuestos en variantes de búsqueda. Por ejemplo:
- "hemograma completo" → ["hemograma", "hemograma completo"]
- "radiografía de tórax" → ["radiografia torax", "radiografia", "torax"]
- "consulta medicina general" → ["consulta medicina general", "consulta general"]

Responde ÚNICAMENTE con JSON válido: {"terminos": ["término 1", "término 2", "término 3"]}
No inventes códigos CUPS. Solo extrae términos de búsqueda.

Texto: "${prompt}"`
  );

  const response = result.response;
  const text = response
    .text()
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  let terminos: string[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.terminos)) {
      terminos = parsed.terminos.filter(
        (t: unknown) => typeof t === "string" && (t as string).length > 2
      );
    }
  } catch {
    // Si Gemini falla el JSON, usar el prompt original fragmentado
    terminos = prompt.split(/\s+/).filter((t) => t.length > 2);
  }

  // Buscar cada término en la DB y acumular resultados únicos
  const todasLasOpciones: { codigo: string; desc: string }[] = [];
  const codigosVistos = new Set<string>();

  for (const termino of terminos.slice(0, 5)) {
    const resultados = await buscarCupsPorTexto(termino, 5);
    for (const r of resultados) {
      if (!codigosVistos.has(r.codigo)) {
        codigosVistos.add(r.codigo);
        todasLasOpciones.push({ codigo: r.codigo, desc: r.descripcion });
      }
    }
  }

  return {
    opciones: todasLasOpciones.slice(0, 10),
    fuente: "ia_db" as const,
  };
}

export async function POST(req: Request) {
  try {
    // --- Auth check ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // --- Rate limiting ---
    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta en un momento." },
        { status: 429 }
      );
    }

    // --- Input validation ---
    const body = await req.json();
    const prompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt || prompt.length > 500) {
      return NextResponse.json(
        { error: "Prompt inválido (máx. 500 caracteres)" },
        { status: 400 }
      );
    }

    // --- Estrategia 1: Búsqueda directa en DB (rápida, sin costo) ---
    const directa = await busquedaDirecta(prompt);
    if (directa && directa.opciones.length > 0) {
      return NextResponse.json({
        opciones: directa.opciones,
        fuente: directa.fuente,
      });
    }

    // --- Estrategia 2: IA interpreta → busca en DB ---
    const conIA = await busquedaConIA(prompt);
    return NextResponse.json({
      opciones: conIA.opciones,
      fuente: conIA.fuente,
    });
  } catch {
    return NextResponse.json({ opciones: [], fuente: "error" }, { status: 500 });
  }
}