import { buscarCupsPorTexto, buscarCupsHibrido, type CupsResultado } from "@/lib/cups-service";
import { buscarCie10PorTexto, buscarCie10Hibrido, type Cie10Resultado } from "@/lib/cie10-service";
import { generarEmbedding, searchByText } from "@/lib/embedding-service";

// Flag para habilitar búsqueda híbrida (activar después de correr generar-embeddings.ts)
const USAR_BUSQUEDA_HIBRIDA = process.env.ENABLE_HYBRID_SEARCH === "true";

// Flag para habilitar búsqueda semántica pura via match_documents RPC
// Complementa la búsqueda léxica/híbrida con resultados semánticos adicionales
const USAR_BUSQUEDA_SEMANTICA = process.env.ENABLE_SEMANTIC_SEARCH !== "false"; // habilitada por defecto

export interface ContextoRAG {
  candidatosCups: { codigo: string; descripcion: string; contexto_jerarquico?: string | null }[];
  candidatosCie10: { codigo: string; descripcion: string }[];
  procedimientosNegados: string[];
}

/** Categoría asignada por ragExtractorAI a cada término de procedimiento */
export type CategoriaTermino = "laboratorio" | "imagen" | "cirugia_piel" | "inmovilizacion" | "inyeccion" | "otro";

export interface TerminoProcedimiento {
  termino: string;
  categoria: CategoriaTermino;
  negado?: boolean;
}

const MAX_CANDIDATOS = 20;
const RESULTADOS_POR_TERMINO = 5;

// ==========================================
// RE-RANKING JERÁRQUICO
// ==========================================
// Mapeo de categorías del extractor a palabras clave jerárquicas.
// Cuando la jerarquía de un candidato contiene estas palabras, recibe un boost.
const PALABRAS_JERARQUIA_POR_CATEGORIA: Record<CategoriaTermino, RegExp | null> = {
  laboratorio:    /laboratorio|patolog[ií]a|qu[ií]mica|hematolog[ií]a|microbiolog[ií]a|inmunolog[ií]a/i,
  imagen:         /im[aá]gen|radiolog[ií]a|diagn[oó]stic|radiograf[ií]a|ecograf[ií]a|tomograf[ií]a|resonancia/i,
  cirugia_piel:   /piel|tejido|subcutáneo|subcutaneo|mama|excisi[oó]n|sutura|desbridamiento/i,
  inmovilizacion: /rehabilitaci[oó]n|inmoviliz|f[eé]rula|yeso|vendaje|ort[eé]sis/i,
  inyeccion:      /inyecci[oó]n|vacuna|inmunizaci[oó]n|infusi[oó]n|toxoide|inmunoglobulina/i,
  otro:           null,
};

/**
 * Aplica un boost de relevancia a candidatos cuya jerarquía coincide
 * semánticamente con la categoría del término buscado.
 * Esto ayuda a desambiguar cuando hay candidatos con scores similares.
 * Ej: buscando "desbridamiento" [cirugia_piel], un candidato con
 * jerarquía "PIEL > ESCISIÓN > DESBRIDAMIENTO" recibe boost vs uno
 * sin jerarquía o con jerarquía de otra sección.
 */
function aplicarBoostJerarquico(
  resultados: CupsResultado[],
  categoria: CategoriaTermino,
  terminoBuscado: string
): CupsResultado[] {
  const patron = PALABRAS_JERARQUIA_POR_CATEGORIA[categoria];
  if (!patron) return resultados; // "otro" → sin boost

  const termNorm = terminoBuscado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return resultados.map((r) => {
    let boost = 0;

    if (r.contexto_jerarquico) {
      const ctxNorm = r.contexto_jerarquico.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Boost si la jerarquía coincide con la categoría esperada
      if (patron.test(ctxNorm)) {
        boost += 0.05;
      }

      // Boost adicional si alguna palabra del término aparece en la jerarquía
      const palabrasTerm = termNorm.split(/\s+/).filter(p => p.length >= 4);
      for (const palabra of palabrasTerm) {
        if (ctxNorm.includes(palabra)) {
          boost += 0.03;
        }
      }
    }

    return boost > 0
      ? { ...r, relevancia: Math.min(r.relevancia + boost, 1) }
      : r;
  }).sort((a, b) => b.relevancia - a.relevancia);
}

// ==========================================
// FILTRO POR PREFIJO CUPS SEGÚN CATEGORÍA
// ==========================================
// Prefijos válidos de la Clasificación CUPS (Resolución 2706 de 2025)
// Esto evita que "hemograma" retorne "apicograma" (dental) o que "glucosa" retorne "glucagón"
const PREFIJOS_POR_CATEGORIA: Record<CategoriaTermino, string[]> = {
  laboratorio:    ["90", "91"],               // 90xxxx-91xxxx: laboratorio clínico
  imagen:         ["87", "88"],               // 87xxxx-88xxxx: imágenes diagnósticas
  cirugia_piel:   ["86", "85"],               // 86xxxx: piel/tejido subcutáneo, 85xxxx: mama
  inmovilizacion: ["93"],                     // 93xxxx: rehabilitación, inmovilizaciones, yesos
  inyeccion:      ["99"],                     // 99xxxx: inyecciones, vacunas, infusiones
  otro:           [],                         // Sin filtro — acepta cualquier prefijo
};

/**
 * Filtra resultados CUPS según la categoría del término.
 * Si la categoría tiene prefijos definidos, descarta resultados con prefijo incorrecto.
 * Ej: categoría "laboratorio" solo acepta códigos que empiecen con "90" o "91".
 */
function filtrarPorCategoria(resultados: CupsResultado[], categoria: CategoriaTermino): CupsResultado[] {
  const prefijos = PREFIJOS_POR_CATEGORIA[categoria];
  if (!prefijos || prefijos.length === 0) return resultados; // "otro" → sin filtro

  return resultados.filter((r) => {
    const codigo = String(r.codigo).trim();
    return prefijos.some((p) => codigo.startsWith(p));
  });
}

// ==========================================
// DETECCIÓN DE ANTÓNIMOS / NEGACIÓN
// ==========================================
// Pares de procedimientos opuestos que pg_trgm confunde por compartir raíz
const ANTONIMOS_CUPS: [RegExp, RegExp][] = [
  [/\bretiro\b.*\bsutura\b/i, /\bsutura\b(?!.*\bretiro\b)/i],
  [/\bsutura\b(?!.*\bretiro\b)/i, /\bretiro\b.*\bsutura\b/i],
  [/\bretiro\b.*\byeso\b/i, /\baplicacion\b.*\byeso\b/i],
  [/\baplicacion\b.*\byeso\b/i, /\bretiro\b.*\byeso\b/i],
  [/\bretiro\b.*\bclavo\b/i, /\bfijacion\b.*\bclavo\b/i],
  // toxoide (vacuna preventiva) ≠ antitoxina (tratamiento terapéutico)
  [/\btoxoide\b/i, /\bantitoxina\b/i],
  [/\bantitoxina\b/i, /\btoxoide\b/i],
];

/**
 * Detecta si un resultado CUPS es antónimo del término buscado.
 * Ej: buscaste "sutura piel" pero obtuviste "retiro de sutura en piel" → descartado.
 */
function esAntonimo(terminoBuscado: string, descripcionCups: string): boolean {
  const termNorm = terminoBuscado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const descNorm = descripcionCups.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const [patternTermino, patternDescripcion] of ANTONIMOS_CUPS) {
    // Si el término buscado matchea UN lado y la descripción matchea el OTRO → antónimo
    if (patternTermino.test(termNorm) && patternDescripcion.test(descNorm)) return true;
    if (patternDescripcion.test(termNorm) && patternTermino.test(descNorm)) return true;
  }

  // Heurística genérica: si busco X sin "retiro" y el resultado es "retiro de X"
  if (!termNorm.includes("retiro") && descNorm.includes("retiro")) return true;
  if (termNorm.includes("retiro") && !descNorm.includes("retiro")) return true;

  return false;
}

// ==========================================
// CONFUSIÓN POR SIMILITUD LINGÜÍSTICA
// ==========================================
// Pares de términos que pg_trgm confunde por raíz similar pero significado diferente
const CONFUSIONES_CONOCIDAS: { busqueda: RegExp; excluir: RegExp }[] = [
  { busqueda: /creatinina/i, excluir: /\bcreatina\b/i },      // creatinina ≠ creatina
  { busqueda: /creatina\b/i, excluir: /creatinina/i },        // creatina ≠ creatinina
  { busqueda: /glucosa|glucemia/i, excluir: /glucagon/i },     // glucosa ≠ glucagón
  { busqueda: /glucagon/i, excluir: /glucosa|glucemia/i },     // glucagón ≠ glucosa
  { busqueda: /hemograma/i, excluir: /apicograma|apicoectomia|hematocrito|espermograma|espermiograma|\bhemoglobina\b/i }, // hemograma ≠ apicograma ≠ hematocrito ≠ espermograma ≠ hemoglobina
  { busqueda: /hematocrito/i, excluir: /hemograma/i },         // hematocrito ≠ hemograma
  { busqueda: /\bhemoglobina\b/i, excluir: /hemograma/i },      // hemoglobina ≠ hemograma
  { busqueda: /\bradiografia\b.*\btorax\b/i, excluir: /\bcodo\b|\bmano\b|\bpie\b|\bdedo\b/i }, // Rx tórax ≠ Rx codo
  { busqueda: /\bradiografia\b.*\bcodo\b/i, excluir: /\btorax\b|\bpierna\b/i },
  { busqueda: /\bdesbridamiento\b/i, excluir: /\bbiopsia\b|\bfistulectomia\b/i }, // desbridamiento ≠ biopsia ≠ fistulectomía
  { busqueda: /\bbiopsia\b/i, excluir: /\bdesbridamiento\b|\blavado\b/i },
  { busqueda: /\blavado\b.*\bherida\b|\bcuracion\b/i, excluir: /\bfistulectomia\b|\bbiopsia\b/i }, // lavado/curación ≠ fistulectomía
  { busqueda: /\bafrontamiento\b|\bsteri.?strip\b|\bcierre\b.*\badhesivo\b/i, excluir: /\bfistulectomia\b|\bbiopsia\b/i }, // cierre adhesivo ≠ fistulectomía
  { busqueda: /\bcuracion\b.*\b(herida|piel|lesion|araña)\b|\b(herida|piel|lesion|araña)\b.*\bcuracion\b/i, excluir: /\boido\b|\boreja\b|\btimpano\b|\bnasal\b|\bvaginal\b/i }, // curación de herida ≠ curación de oído
  { busqueda: /\bcuracion\b.*\boido\b|\boido\b.*\bcuracion\b/i, excluir: /\bherida\b|\bpiel\b/i }, // curación de oído ≠ curación de herida
  { busqueda: /\btoxoide\b.*\btetani/i, excluir: /\bdifteri/i }, // toxoide tetánico ≠ toxoide diftérico
  { busqueda: /\btoxoide\b.*\bdifteri/i, excluir: /\btetani/i }, // toxoide diftérico ≠ toxoide tetánico
  { busqueda: /\bantitoxina\b.*\btetani/i, excluir: /\btoxoide\b/i }, // antitoxina tetánica ≠ toxoide tetánico
  { busqueda: /\bespermograma\b/i, excluir: /\bhemograma\b/i }, // espermograma ≠ hemograma
];

/**
 * Filtra resultados que son confusiones lingüísticas conocidas.
 */
function filtrarConfusiones(resultados: CupsResultado[], terminoBuscado: string): CupsResultado[] {
  const termNorm = terminoBuscado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const reglaAplicable = CONFUSIONES_CONOCIDAS.find((c) => c.busqueda.test(termNorm));
  if (!reglaAplicable) return resultados;

  return resultados.filter((r) => {
    const descNorm = r.descripcion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return !reglaAplicable.excluir.test(descNorm);
  });
}

// ==========================================
// CONFUSIONES CIE-10 POR SIMILITUD LINGÜÍSTICA
// ==========================================
const CONFUSIONES_CIE10: { busqueda: RegExp; excluir: RegExp }[] = [
  { busqueda: /asma\b.*\bintermitente\b|\bintermitente\b.*\basma\b/i, excluir: /heterotropia|estrabismo|exotropia/i }, // asma intermitente ≠ heterotropia intermitente
  { busqueda: /heterotropia|estrabismo/i, excluir: /asma/i },   // heterotropia ≠ asma
  { busqueda: /\bdiabetes\b/i, excluir: /\binsipida\b/i },     // diabetes mellitus ≠ diabetes insípida (cuando no se especifica)
];

/**
 * Filtra resultados CIE-10 que son confusiones lingüísticas conocidas.
 */
function filtrarConfusionesCie10(resultados: Cie10Resultado[], terminoBuscado: string): Cie10Resultado[] {
  const termNorm = terminoBuscado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const reglaAplicable = CONFUSIONES_CIE10.find((c) => c.busqueda.test(termNorm));
  if (!reglaAplicable) return resultados;

  return resultados.filter((r) => {
    const descNorm = r.descripcion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return !reglaAplicable.excluir.test(descNorm);
  });
}

/**
 * Busca códigos CUPS y CIE-10 oficiales a partir de los términos
 * extraídos por ragExtractorAI. Devuelve candidatos deduplicados
 * y filtrados por categoría para inyectar en el prompt de medibillAI.
 * 
 * v2: Acepta términos categorizados {termino, categoria} para filtrar
 * por prefijo CUPS, detectar antónimos y excluir confusiones lingüísticas.
 */
export async function buscarContextoRAG(
  terminosProcedimientos: TerminoProcedimiento[],
  terminosDiagnosticos: string[]
): Promise<ContextoRAG> {
  // Separar términos negados de los positivos
  const terminosPositivos = terminosProcedimientos.filter(t => !t.negado);
  const terminosNegados = terminosProcedimientos.filter(t => t.negado);
  const procedimientosNegados = terminosNegados.map(t => t.termino);

  if (terminosNegados.length > 0) {
    console.log(`🚫 RAG — Procedimientos NEGADOS detectados: ${procedimientosNegados.join(", ")}`);
  }

  // Lanzar todas las búsquedas en paralelo (SOLO términos positivos)
  const [resultadosCups, resultadosCie10] = await Promise.all([
    Promise.all(
      terminosPositivos.map(async ({ termino, categoria }) => {
        // Búsqueda: híbrida (trigrama+vector) si está habilitada, sino solo trigramas
        let resultadosBrutos: CupsResultado[];
        if (USAR_BUSQUEDA_HIBRIDA) {
          try {
            const embedding = await generarEmbedding(termino);
            resultadosBrutos = await buscarCupsHibrido(termino, embedding, RESULTADOS_POR_TERMINO);
          } catch {
            resultadosBrutos = await buscarCupsPorTexto(termino, RESULTADOS_POR_TERMINO);
          }
        } else {
          resultadosBrutos = await buscarCupsPorTexto(termino, RESULTADOS_POR_TERMINO);
        }

        // Complementar con búsqueda semántica pura (match_documents RPC)
        // Esto captura resultados que la búsqueda léxica/híbrida puede perder
        if (USAR_BUSQUEDA_SEMANTICA) {
          try {
            const semanticos = await searchByText(termino, "cups", RESULTADOS_POR_TERMINO);
            const codigosExistentes = new Set(resultadosBrutos.map(r => r.codigo));
            for (const s of semanticos) {
              if (!codigosExistentes.has(s.codigo)) {
                resultadosBrutos.push({
                  codigo: s.codigo,
                  descripcion: s.descripcion,
                  seccion: "",
                  seccion_nombre: "",
                  relevancia: s.similitud,
                });
              }
            }
          } catch (e) {
            console.warn(`⚠️  Búsqueda semántica CUPS para "${termino}" falló:`, e);
          }
        }
        
        // Pipeline de filtrado: categoría → confusiones → antónimos
        const porCategoria = filtrarPorCategoria(resultadosBrutos, categoria);
        const sinConfusiones = filtrarConfusiones(porCategoria, termino);
        const sinAntonimos = sinConfusiones.filter((r) => !esAntonimo(termino, r.descripcion));

        if (sinAntonimos.length === 0 && resultadosBrutos.length > 0) {
          // Si el filtrado eliminó todo, reintentamos con categoría "otro" (sin filtro de prefijo)
          // pero mantenemos filtrado de antónimos y confusiones
          const sinFiltroCategoria = filtrarConfusiones(resultadosBrutos, termino);
          const fallback = sinFiltroCategoria.filter((r) => !esAntonimo(termino, r.descripcion));
          console.log(`⚠️  RAG filtro: "${termino}" [${categoria}] sin resultados tras filtrado por prefijo → fallback sin filtro de categoría (${fallback.length} resultados)`);
          return fallback;
        }

        const descartados = resultadosBrutos.length - sinAntonimos.length;
        if (descartados > 0) {
          console.log(`🔍 RAG filtro: "${termino}" [${categoria}] — ${descartados} candidatos descartados por filtrado`);
        }

        // Re-ranking: boost jerárquico según categoría
        return aplicarBoostJerarquico(sinAntonimos, categoria, termino);
      })
    ),
    Promise.all(
      terminosDiagnosticos.map(async (t) => {
        // Búsqueda: híbrida (trigrama+vector) si está habilitada, sino solo trigramas
        let resultadosBrutos: Cie10Resultado[];
        if (USAR_BUSQUEDA_HIBRIDA) {
          try {
            const embedding = await generarEmbedding(t);
            resultadosBrutos = await buscarCie10Hibrido(t, embedding, RESULTADOS_POR_TERMINO);
          } catch {
            resultadosBrutos = await buscarCie10PorTexto(t, RESULTADOS_POR_TERMINO);
          }
        } else {
          resultadosBrutos = await buscarCie10PorTexto(t, RESULTADOS_POR_TERMINO);
        }

        // Complementar con búsqueda semántica pura (match_documents RPC)
        if (USAR_BUSQUEDA_SEMANTICA) {
          try {
            const semanticos = await searchByText(t, "cie10", RESULTADOS_POR_TERMINO);
            const codigosExistentes = new Set(resultadosBrutos.map(r => r.codigo));
            for (const s of semanticos) {
              if (!codigosExistentes.has(s.codigo)) {
                resultadosBrutos.push({
                  codigo: s.codigo,
                  descripcion: s.descripcion,
                  codigo_3: "",
                  descripcion_3: "",
                  capitulo: 0,
                  nombre_capitulo: "",
                  relevancia: s.similitud,
                });
              }
            }
          } catch (e) {
            console.warn(`⚠️  Búsqueda semántica CIE-10 para "${t}" falló:`, e);
          }
        }

        const sinConfusiones = filtrarConfusionesCie10(resultadosBrutos, t);

        const descartados = resultadosBrutos.length - sinConfusiones.length;
        if (descartados > 0) {
          console.log(`🔍 RAG filtro CIE-10: "${t}" — ${descartados} candidatos descartados por confusión lingüística`);
        }

        return sinConfusiones;
      })
    ),
  ]);

  // Deduplicar CUPS por código
  const cupsMap = new Map<string, CupsResultado>();
  for (const resultados of resultadosCups) {
    for (const r of resultados) {
      if (!cupsMap.has(r.codigo)) {
        cupsMap.set(r.codigo, r);
      }
    }
  }

  // Deduplicar CIE-10 por código
  const cie10Map = new Map<string, Cie10Resultado>();
  for (const resultados of resultadosCie10) {
    for (const r of resultados) {
      if (!cie10Map.has(r.codigo)) {
        cie10Map.set(r.codigo, r);
      }
    }
  }

  // Ordenar por relevancia y limitar
  const candidatosCups = Array.from(cupsMap.values())
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, MAX_CANDIDATOS)
    .map(({ codigo, descripcion, contexto_jerarquico }) => ({ codigo, descripcion, contexto_jerarquico }));

  const candidatosCie10 = Array.from(cie10Map.values())
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, MAX_CANDIDATOS)
    .map(({ codigo, descripcion }) => ({ codigo, descripcion }));

  return { candidatosCups, candidatosCie10, procedimientosNegados };
}

/**
 * Formatea los candidatos RAG como texto para inyectar en el prompt
 * de medibillAI. Agrupa CUPS por sección jerárquica para dar
 * contexto de desambiguación al modelo.
 */
export function formatearCandidatosParaPrompt(contexto: ContextoRAG): string {
  // Agrupar CUPS por sección jerárquica principal
  const cupsConJerarquia = contexto.candidatosCups.filter(c => c.contexto_jerarquico);
  const cupsSinJerarquia = contexto.candidatosCups.filter(c => !c.contexto_jerarquico);

  const gruposJerarquicos = new Map<string, typeof contexto.candidatosCups>();
  for (const c of cupsConJerarquia) {
    const seccionPrincipal = c.contexto_jerarquico!.split(" > ")[0]!;
    if (!gruposJerarquicos.has(seccionPrincipal)) {
      gruposJerarquicos.set(seccionPrincipal, []);
    }
    gruposJerarquicos.get(seccionPrincipal)!.push(c);
  }

  let cupsLines = "";

  // Mostrar agrupados por sección jerárquica
  if (gruposJerarquicos.size > 0) {
    for (const [seccion, cups] of gruposJerarquicos) {
      cupsLines += `\n  [🏥 ${seccion}]\n`;
      for (const c of cups) {
        // Mostrar sub-jerarquía (sin la sección principal para no repetir)
        const subJerarquia = c.contexto_jerarquico!.split(" > ").slice(1).join(" > ");
        const ctx = subJerarquia ? ` ← ${subJerarquia}` : "";
        cupsLines += `    ${c.codigo} — ${c.descripcion}${ctx}\n`;
      }
    }
  }

  // CUPS sin jerarquía (si los hay)
  if (cupsSinJerarquia.length > 0) {
    if (cupsLines) cupsLines += "\n";
    for (const c of cupsSinJerarquia) {
      cupsLines += `  ${c.codigo} — ${c.descripcion}\n`;
    }
  }

  if (!cupsLines) cupsLines = "  (sin candidatos)\n";

  const cie10Lines = contexto.candidatosCie10
    .map((c) => `  ${c.codigo} — ${c.descripcion}`)
    .join("\n");

  const negadosSection = contexto.procedimientosNegados.length > 0
    ? `\n\n⛔ PROCEDIMIENTOS NEGADOS (NO generar CUPS para estos):\n${contexto.procedimientosNegados.map(t => `  ❌ ${t}`).join("\n")}\n  La nota clínica indica EXPLÍCITAMENTE que estos procedimientos NO se realizaron.\n  NO incluyas NINGÚN código CUPS relacionado con estos procedimientos.`
    : "";

  return `
═══════════════════════════════════════════════════
CÓDIGOS CANDIDATOS OFICIALES (BASE DE DATOS)
═══════════════════════════════════════════════════
Prioriza estos códigos sobre tu conocimiento general.
Si alguno coincide con lo descrito en la nota, ÚSALO.

Los candidatos están agrupados por SECCIÓN JERÁRQUICA [🏥].
La flecha ← muestra el camino jerárquico: grupo > subgrupo.
Usa esta jerarquía para DESAMBIGUAR códigos similares:
  • Si dos códigos tienen descripción parecida, elige el que
    pertenece a la sección/subgrupo más coherente con la nota.
  • Ej: "lavado" aparece en PIEL (terapéutico) y en OÍDO (diagnóstico)
    — la jerarquía te dice cuál es cuál.

CUPS (Procedimientos):
${cupsLines}
CIE-10 (Diagnósticos):
${cie10Lines || "  (sin candidatos)"}
═══════════════════════════════════════════════════${negadosSection}`;
}
