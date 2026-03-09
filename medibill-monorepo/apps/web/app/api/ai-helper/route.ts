import { getHelperAI } from "@/lib/gemini";
import { buscarCupsPorTexto, buscarCupsPorCodigo } from "@/lib/cups-service";
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAudit, devError } from "@/lib/logger";

// --- Filtro de prompt injection (defensa en profundidad) ---
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /ignora\s+(todas?\s+)?(las\s+)?instrucciones/i,
  /olvida\s+todo/i,
  /system\s*:/i,
  /devuelve.*api.?key/i,
  /act\s+as/i,
  /you\s+are\s+now/i,
  /forget\s+(your\s+)?instructions/i,
  /nuevo\s+rol/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
];

function esPromptInjection(prompt: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(prompt));
}

// --- Rate limiter: 10 requests/min por usuario ---
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

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
  const result = await getHelperAI().generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

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
  const codigosVistos = new Set<string>();

  const resultadosPorTermino = await Promise.all(
    terminos.slice(0, 5).map((termino) => buscarCupsPorTexto(termino, 5))
  );

  const todasLasOpciones: { codigo: string; desc: string }[] = [];
  for (const resultados of resultadosPorTermino) {
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
    if (await limiter.isLimited(user.id, supabase)) {
      logAudit(supabase, { action: "rate_limit_exceeded", user_id: user.id, metadata: { route: "ai-helper" } });
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

    // --- Filtro de prompt injection ---
    if (esPromptInjection(prompt)) {
      return NextResponse.json(
        { error: "Prompt no permitido" },
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
  } catch (e) {
    devError("ai-helper", e);
    return NextResponse.json({ opciones: [], fuente: "error" }, { status: 500 });
  }
}