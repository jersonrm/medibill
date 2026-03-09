import { devLog, devWarn } from "@/lib/logger";
import { buscarCupsPorCodigo, buscarCupsPorTexto } from "@/lib/cups-service";
import { buscarCie10PorCodigo, buscarCie10PorTexto } from "@/lib/cie10-service";
import { searchByText } from "@/lib/embedding-service";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

// ==========================================
// FUNCIÓN DE SEGURIDAD: HABEAS DATA (LEY 1581)
// ==========================================
export function anonimizarTextoMedico(texto: string, nombre?: string, documento?: string): string {
  let textoSeguro = texto;

  // 1. Reemplazar documento del paciente (si se proporciona explícitamente)
  if (documento && documento.trim() !== "") {
    const regexDoc = new RegExp(documento.trim(), 'gi');
    textoSeguro = textoSeguro.replace(regexDoc, '[DOCUMENTO_PACIENTE]');
  }

  // 2. Reemplazar nombre del paciente (si se proporciona)
  if (nombre && nombre.trim() !== "") {
    const nombreLimpio = nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexNombre = new RegExp(nombreLimpio, 'gi');
    textoSeguro = textoSeguro.replace(regexNombre, '[NOMBRE_PACIENTE]');
  }

  // 3. Teléfonos colombianos (celulares 3XX XXX XXXX)
  textoSeguro = textoSeguro.replace(/\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[TELEFONO]');

  // 4. Emails
  textoSeguro = textoSeguro.replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, '[EMAIL]');

  // 5. Cédulas en contexto (precedidas por CC, cédula, TI, etc.) — no afecta códigos CUPS/CIE-10
  textoSeguro = textoSeguro.replace(
    /(?:CC|C\.C\.|cédula|cedula|documento|identificación|identificacion|TI|T\.I\.|RC|R\.C\.)\s*(?:No\.?\s*)?(\d{6,10})\b/gi,
    (match, digits: string) => match.replace(digits, '[DOCUMENTO]')
  );

  // 6. Direcciones colombianas
  textoSeguro = textoSeguro.replace(
    /\b(?:calle|carrera|cra|cl|kr|transversal|diagonal|av|avenida)\s+\d+(?:\s*(?:#|no\.?|n°)\s*\d+(?:\s*-\s*\d+)?)?/gi,
    '[DIRECCION]'
  );

  return textoSeguro;
}

// ==========================================
// UTILIDAD: Similitud entre descripciones (Jaccard por palabras)
// ==========================================
export function calcularSimilitud(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

// ==========================================
// DETECCIÓN DE ANTÓNIMOS EN VALIDACIÓN POST-IA
// ==========================================
export function esAntonimoDescripcion(descripcionIA: string, descripcionDB: string): boolean {
  const normIA = descripcionIA.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normDB = descripcionDB.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // "sutura" vs "retiro de sutura"
  if (!normIA.includes("retiro") && normDB.includes("retiro")) return true;
  if (normIA.includes("retiro") && !normDB.includes("retiro")) return true;

  // "aplicación de yeso" vs "retiro de yeso"
  if (!normIA.includes("sustitucion") && normDB.includes("sustitucion")) return true;

  // "biopsia" vs "desbridamiento/lavado" — procedimientos con intención opuesta
  if (normIA.includes("lavado") && normDB.includes("biopsia")) return true;
  if (normIA.includes("desbridamiento") && normDB.includes("biopsia")) return true;
  if (normIA.includes("biopsia") && (normDB.includes("lavado") || normDB.includes("desbridamiento"))) return true;

  // "fistulectomía" no es "lavado quirúrgico"
  if (normIA.includes("lavado") && normDB.includes("fistulectomia")) return true;

  return false;
}

// ==========================================
// VALIDACIÓN ANATÓMICA POST-IA
// ==========================================
// Mapa de regiones anatómicas: palabras clave → regiones incompatibles
// Si la descripción de la IA menciona una región y el código validado 
// menciona una región INCOMPATIBLE, forzar re-búsqueda.
const REGIONES_ANATOMICAS: { region: RegExp; incompatibles: RegExp }[] = [
  // Cara/mejilla NO es párpado/oído/nariz
  { region: /\b(mejilla|malar|bucal|cara)\b/i, incompatibles: /\b(parpado|oido|oreja|timpano|nasal|nariz|lengua|labio)\b/i },
  // Párpado NO es mejilla/oído
  { region: /\b(parpado)\b/i, incompatibles: /\b(mejilla|oido|oreja|antebrazo|pierna)\b/i },
  // Antebrazo NO es pierna/mano/pie/oído
  { region: /\b(antebrazo)\b/i, incompatibles: /\b(pierna|pie|oido|oreja|parpado|tobillo|rodilla)\b/i },
  // Pierna NO es brazo/mano/cara
  { region: /\b(pierna|tibial)\b/i, incompatibles: /\b(brazo|mano|cara|mejilla|parpado|oido)\b/i },
  // Mano/muñeca NO es pie/pierna
  { region: /\b(mano|muneca|dedo.*mano|carpo)\b/i, incompatibles: /\b(pie|pierna|tobillo|tarso|dedo.*pie)\b/i },
  // Pie/tobillo NO es mano/muñeca
  { region: /\b(pie|tobillo|dedo.*pie|tarso)\b/i, incompatibles: /\b(mano|muneca|dedo.*mano|carpo)\b/i },
  // Tórax NO es abdomen/extremidades
  { region: /\b(torax|toracic|costal)\b/i, incompatibles: /\b(abdomen|pelvis|pierna|brazo)\b/i },
  // Curación/herida → no debe confundirse con curación de oído
  { region: /\b(herida|piel|cutaneo|tejido)\b/i, incompatibles: /\b(oido|oreja|timpano)\b/i },
];

/**
 * Detecta si un procedimiento tiene incoherencia anatómica entre
 * la descripción que la IA pidió y la descripción del código validado.
 * Retorna la región IA encontrada si hay conflicto, null si es coherente.
 */
function detectarIncoherenciaAnatomica(descripcionIA: string, descripcionCups: string): string | null {
  const normIA = descripcionIA.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normCups = descripcionCups.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const { region, incompatibles } of REGIONES_ANATOMICAS) {
    // La IA pide una región específica...
    if (region.test(normIA)) {
      // ...pero el CUPS validado menciona una región incompatible
      if (incompatibles.test(normCups)) {
        return normIA.match(region)?.[0] || "desconocida";
      }
    }
  }

  return null; // Sin conflicto
}

/**
 * Valida coherencia anatómica de cada procedimiento.
 * Si detecta incoherencia, busca un CUPS alternativo por texto.
 */
export async function validarCoherenciaAnatomica(procedimientos: ProcedimientoIA[]): Promise<ProcedimientoIA[]> {
  if (!procedimientos || procedimientos.length === 0) return [];

  const resultados = [];

  for (const proc of procedimientos) {
    const descripcionOriginal = String(proc.descripcion_ia_original || proc.descripcion || "");
    const descripcionValidada = String(proc.descripcion || "");

    const regionConflicto = detectarIncoherenciaAnatomica(descripcionOriginal, descripcionValidada);

    if (regionConflicto) {
      devLog("INCOHERENCIA ANATÓMICA", `IA pidió "${descripcionOriginal.substring(0, 50)}" (región: ${regionConflicto}) pero CUPS validado es "${descripcionValidada.substring(0, 50)}" → re-buscando`);

      // Re-buscar por la descripción original de la IA (léxica + semántica)
      const [porTexto, porSemantica] = await Promise.all([
        buscarCupsPorTexto(descripcionOriginal, 5),
        searchByText(descripcionOriginal, "cups", 5).catch(() => []),
      ]);

      // Merge resultados
      const codigosLexicos = new Set(porTexto.map(r => r.codigo));
      const todosResultados = [
        ...porTexto,
        ...porSemantica
          .filter(s => !codigosLexicos.has(s.codigo))
          .map(s => ({
            codigo: s.codigo,
            descripcion: s.descripcion,
            seccion: "",
            seccion_nombre: "",
            relevancia: s.similitud,
          })),
      ];

      // Filtrar candidatos que NO tengan incoherencia anatómica
      const candidatosCoherentes = todosResultados.filter((r) => {
        return !detectarIncoherenciaAnatomica(descripcionOriginal, r.descripcion)
          && !esAntonimoDescripcion(descripcionOriginal, r.descripcion);
      });

      if (candidatosCoherentes.length > 0) {
        const mejor = candidatosCoherentes[0]!;
        devLog("CUPS corregido", `${mejor.codigo} — ${mejor.descripcion.substring(0, 50)}`);
        resultados.push({
          ...proc,
          codigo_cups: mejor.codigo,
          descripcion: mejor.descripcion,
          cups_validado: true,
          cups_corregido_anatomia: true,
          alternativas: candidatosCoherentes.slice(0, 3).map((r) => ({
            codigo: r.codigo,
            descripcion: r.descripcion,
          })),
        });
        continue;
      } else {
        devWarn("Sin alternativa anatómica coherente", descripcionOriginal.substring(0, 50));
      }
    }

    resultados.push(proc);
  }

  return resultados;
}

// ==========================================
// VALIDACIÓN DE CUPS CONTRA DB (Resolución 2706 de 2025)
// ==========================================
export async function validarYCorregirCups(procedimientos: ProcedimientoIA[]): Promise<ProcedimientoIA[]> {
  if (!procedimientos || procedimientos.length === 0) return [];

  const resultados = [];

  for (const proc of procedimientos) {
    // Normalizar: quitar puntos, espacios, etc. del código que genera la IA
    const codigoLimpio = String(proc.codigo_cups ?? "")
      .replace(/[.\s-]/g, "")
      .toUpperCase()
      .trim();
    
    const descripcionIA = String(proc.descripcion || "");

    // 1. Buscar por código exacto en la DB
    const exacto = await buscarCupsPorCodigo(codigoLimpio);
    if (exacto) {
      // VALIDACIÓN SEMÁNTICA: verificar que la descripción coincida
      const similitud = calcularSimilitud(descripcionIA, exacto.descripcion);
      const esAntonimo = esAntonimoDescripcion(descripcionIA, exacto.descripcion);
      
      if (similitud >= 0.3 && !esAntonimo) {
        // Código existe Y la descripción es coherente Y no es antónimo
        resultados.push({
          ...proc,
          codigo_cups: exacto.codigo,
          descripcion: exacto.descripcion,
          cups_validado: true,
        });
        continue;
      }
      // Código existe pero descripción NO coincide o es antónimo → buscar por texto
      if (esAntonimo) {
        devLog("CUPS antónimo detectado", `${codigoLimpio} → buscando por texto`);
      }
    }

    // 2. Buscar por descripción (ya sea porque código no existe o no coincide semánticamente)
    //    Combina búsqueda léxica (trigramas) + búsqueda semántica (embeddings)
    const [porTexto, porSemantica] = await Promise.all([
      buscarCupsPorTexto(descripcionIA, 5),
      searchByText(descripcionIA, "cups", 5).catch(() => []),
    ]);

    // Merge: léxica primero, semántica complementa con resultados no duplicados
    const codigosLexicos = new Set(porTexto.map(r => r.codigo));
    const combinados = [
      ...porTexto,
      ...porSemantica
        .filter(s => !codigosLexicos.has(s.codigo))
        .map(s => ({
          codigo: s.codigo,
          descripcion: s.descripcion,
          seccion: "",
          seccion_nombre: "",
          relevancia: s.similitud,
        })),
    ];

    // Filtrar antónimos de los resultados combinados
    const porTextoFiltrado = combinados.filter((r) => !esAntonimoDescripcion(descripcionIA, r.descripcion));
    
    if (porTextoFiltrado.length > 0) {
      const mejor = porTextoFiltrado[0]!;
      resultados.push({
        ...proc,
        codigo_cups: mejor.codigo,
        descripcion: mejor.descripcion,
        cups_validado: true,
        cups_corregido: exacto ? true : false,
        alternativas: porTextoFiltrado.slice(0, 3).map((r) => ({
          codigo: r.codigo,
          descripcion: r.descripcion,
        })),
      });
      continue;
    }

    // 3. Si ni por código ni por texto se encuentra, mantener marcado como no validado
    resultados.push({
      ...proc,
      codigo_cups: codigoLimpio || proc.codigo_cups,
      cups_validado: false,
    });
  }

  return resultados;
}

// ==========================================
// VALIDACIÓN DE CIE-10 CONTRA DB (Colombia 2026)
// ==========================================
export async function validarYCorregirCie10(diagnosticos: DiagnosticoIA[]): Promise<DiagnosticoIA[]> {
  if (!diagnosticos || diagnosticos.length === 0) return [];

  const resultados = [];

  for (const diag of diagnosticos) {
    // Normalizar: quitar puntos, espacios (S42.0 → S420)
    const codigoLimpio = String(diag.codigo_cie10 ?? "")
      .replace(/[.\s-]/g, "")
      .toUpperCase()
      .trim();

    const descripcionIA = String(diag.descripcion || "");

    // 1. Buscar por código exacto en la DB
    const exacto = await buscarCie10PorCodigo(codigoLimpio);
    if (exacto) {
      // VALIDACIÓN SEMÁNTICA: verificar que la descripción coincida
      const similitud = calcularSimilitud(descripcionIA, exacto.descripcion);
      if (similitud >= 0.2) {
        // Código existe Y la descripción es coherente
        resultados.push({
          ...diag,
          codigo_cie10: exacto.codigo,
          descripcion: exacto.descripcion,
          cie10_validado: true,
        });
        continue;
      }
      // Código existe pero descripción NO coincide → buscar por texto
    }

    // 2. Buscar por descripción (ya sea porque código no existe o no coincide semánticamente)
    //    Combina búsqueda léxica (trigramas) + búsqueda semántica (embeddings)
    const [porTexto, porSemantica] = await Promise.all([
      buscarCie10PorTexto(descripcionIA, 3),
      searchByText(descripcionIA, "cie10", 3).catch(() => []),
    ]);

    // Merge: léxica primero, semántica complementa con resultados no duplicados
    const codigosLexicos = new Set(porTexto.map(r => r.codigo));
    const combinados = [
      ...porTexto,
      ...porSemantica
        .filter(s => !codigosLexicos.has(s.codigo))
        .map(s => ({
          codigo: s.codigo,
          descripcion: s.descripcion,
          codigo_3: "",
          descripcion_3: "",
          capitulo: 0,
          nombre_capitulo: "",
          relevancia: s.similitud,
        })),
    ];

    if (combinados.length > 0) {
      const mejor = combinados[0]!;
      resultados.push({
        ...diag,
        codigo_cie10: mejor.codigo,
        descripcion: mejor.descripcion,
        cie10_validado: true,
        cie10_corregido: exacto ? true : false,
        alternativas: combinados.map((r) => ({
          codigo: r.codigo,
          descripcion: r.descripcion,
        })),
      });
      continue;
    }

    // 3. No se encontró — usar código limpio marcado como no validado
    resultados.push({
      ...diag,
      codigo_cie10: codigoLimpio || diag.codigo_cie10,
      cie10_validado: false,
    });
  }

  return resultados;
}

// ==========================================
// ORDENAR DIAGNÓSTICOS POR ROL (principal → relacionado → causa_externa)
// ==========================================
export function ordenarDiagnosticosPorRol(diagnosticos: DiagnosticoIA[]): DiagnosticoIA[] {
  const prioridad: Record<string, number> = { principal: 0, relacionado: 1, causa_externa: 2 };
  return [...diagnosticos].sort((a, b) => {
    const pa = a.rol ? prioridad[a.rol] ?? 1 : 1;
    const pb = b.rol ? prioridad[b.rol] ?? 1 : 1;
    return pa - pb;
  });
}
