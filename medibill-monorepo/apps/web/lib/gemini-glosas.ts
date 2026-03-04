/**
 * Asistente AI para Respuesta de Glosas — Medibill
 *
 * Utiliza Gemini 2.5 Flash para sugerir la respuesta óptima (RS01-RS05)
 * a una glosa recibida, generando justificación y fundamento legal.
 *
 * Modo híbrido:
 *  - RS04: auto-detectado por extemporaneidad (sin IA)
 *  - RS05: auto-detectado si código causal no está en catálogo (sin IA)
 *  - RS01/RS02/RS03: asistidos por Gemini AI
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { GlosaRecibidaEnriquecida, SugerenciaRespuestaIA } from "@/lib/types/glosas";
import {
  CODIGOS_RESPUESTA,
  PLANTILLAS_JUSTIFICACION,
  generarJustificacionRS04,
  generarJustificacionRS05,
  FUNDAMENTO_LEGAL_RS04,
  FUNDAMENTO_LEGAL_RS05,
} from "@/lib/catalogo-respuestas-glosa";
import { calcularDiasHabiles } from "@/lib/dias-habiles";

// =====================================================================
// MODELO GEMINI PARA RESPUESTAS DE GLOSAS
// =====================================================================

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

function getGlosaAI() {
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
          codigo_recomendado: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["RS01", "RS02", "RS03", "RS04", "RS05"],
            description: "Código de respuesta recomendado",
          },
          justificacion_sugerida: {
            type: SchemaType.STRING,
            description: "Texto de justificación técnica para la respuesta",
          },
          fundamento_legal: {
            type: SchemaType.STRING,
            description: "Normas legales que sustentan la respuesta",
          },
          confianza: {
            type: SchemaType.NUMBER,
            description: "Nivel de confianza de 0.0 a 1.0",
          },
          razonamiento: {
            type: SchemaType.STRING,
            description: "Explicación del razonamiento para el usuario",
          },
        },
        required: [
          "codigo_recomendado",
          "justificacion_sugerida",
          "fundamento_legal",
          "confianza",
          "razonamiento",
        ],
      },
      temperature: 0.1,
      topP: 0.5,
      topK: 20,
    },
    systemInstruction: `Eres un experto en facturación de salud colombiana y respuesta a glosas.
Tu rol es analizar glosas recibidas por prestadores de salud (IPS) y recomendar la mejor respuesta.

MARCO LEGAL:
- Resolución 2284 de 2023: Manual Único de Devoluciones, Glosas y Respuestas
- Ley 1438 de 2011, Art. 57: plazos y procedimiento de glosas
- Circular Conjunta 007 de 2025: causas taxativas de glosa
- Decreto 780 de 2016: intereses moratorios

CÓDIGOS DE RESPUESTA DEL PRESTADOR:
- RS01: Aceptación total — el prestador reconoce el error y genera nota crédito
- RS02: Aceptación parcial — acepta parte del valor glosado, controvierte el resto
- RS03: Rechazo total con justificación — rechaza la glosa con soportes y evidencia
- RS04: Rechazo por extemporánea — la EPS glosó fuera de los 20 días hábiles
- RS05: Rechazo por infundada — el código de glosa no está en el Manual Único

REGLAS CRÍTICAS:
1. Si hay soportes válidos, preferir RS03 (rechazo total)
2. RS01 solo si el error del prestador es evidente e innegable
3. RS02 cuando parte del valor glosado es correcto pero no todo
4. Siempre citar norma legal específica en el fundamento
5. La justificación debe ser profesional, técnica y ≥20 caracteres
6. Considerar si el servicio fue de urgencias (no requiere autorización previa)

CONCEPTOS DE GLOSA:
- FA: Facturación (diferencias en cantidades, valores, copagos)
- TA: Tarifas (diferencias con acuerdo de voluntades)
- SO: Soportes (falta documentación, autorización)
- AU: Autorización/Afiliación (problemas de cobertura)
- PE: Pertinencia (indicación médica cuestionada)
- DE: Devolución (errores administrativos)
- SA: Seguimiento a acuerdos

Responde SIEMPRE en español colombiano formal.`,
  });
}

// =====================================================================
// AUTO-DETECCIÓN (sin IA)
// =====================================================================

/**
 * Verifica si la glosa es extemporánea y genera respuesta RS04 automática.
 */
function autoDetectarRS04(glosa: GlosaRecibidaEnriquecida): SugerenciaRespuestaIA | null {
  if (!glosa.es_extemporanea) return null;

  const diasTranscurridos = calcularDiasHabiles(
    glosa.fecha_radicacion_factura,
    glosa.fecha_glosa
  );

  return {
    codigo_recomendado: "RS04",
    justificacion_sugerida: generarJustificacionRS04(
      glosa.codigo_glosa,
      glosa.fecha_radicacion_factura,
      glosa.fecha_glosa,
      diasTranscurridos
    ),
    fundamento_legal: FUNDAMENTO_LEGAL_RS04,
    confianza: 1.0,
    razonamiento:
      `Glosa EXTEMPORÁNEA detectada automáticamente. La EPS formuló la glosa ${diasTranscurridos} días hábiles ` +
      `después de la radicación, excediendo el plazo legal de 20 días hábiles. ` +
      `No se requiere IA — la respuesta RS04 es automática por mandato legal.`,
  };
}

/**
 * Verifica si el código de la glosa existe en el catálogo oficial.
 * Si no existe, genera RS05 automática.
 */
function autoDetectarRS05(
  glosa: GlosaRecibidaEnriquecida,
  codigosCatalogo: Set<string>
): SugerenciaRespuestaIA | null {
  if (codigosCatalogo.has(glosa.codigo_glosa)) return null;

  return {
    codigo_recomendado: "RS05",
    justificacion_sugerida: generarJustificacionRS05(glosa.codigo_glosa),
    fundamento_legal: FUNDAMENTO_LEGAL_RS05,
    confianza: 1.0,
    razonamiento:
      `Glosa INFUNDADA detectada automáticamente. El código "${glosa.codigo_glosa}" no existe en el ` +
      `Manual Único de Devoluciones, Glosas y Respuestas (Res. 2284/2023, Anexo Técnico 3). ` +
      `Las causas de glosa son taxativas — la EPS no puede inventar códigos.`,
  };
}

// =====================================================================
// FUNCIÓN PRINCIPAL
// =====================================================================

/**
 * Sugiere la respuesta óptima para una glosa recibida.
 *
 * Modo híbrido:
 * 1. Auto-detecta RS04 (extemporánea) sin llamar a IA
 * 2. Auto-detecta RS05 (infundada) sin llamar a IA
 * 3. Para RS01/RS02/RS03 llama a Gemini AI
 *
 * @param glosa Glosa recibida enriquecida con datos calculados
 * @param codigosCatalogo Set de códigos válidos del catálogo oficial
 * @returns Sugerencia de respuesta con justificación y fundamento legal
 */
export async function sugerirRespuestaGlosa(
  glosa: GlosaRecibidaEnriquecida,
  codigosCatalogo: Set<string>
): Promise<SugerenciaRespuestaIA> {
  // 1. Auto-detección RS04
  const rs04 = autoDetectarRS04(glosa);
  if (rs04) return rs04;

  // 2. Auto-detección RS05
  const rs05 = autoDetectarRS05(glosa, codigosCatalogo);
  if (rs05) return rs05;

  // 3. Consulta a Gemini AI para RS01/RS02/RS03
  try {
    const glosaAI = getGlosaAI();
    const concepto = glosa.concepto_general;
    const plantilla = PLANTILLAS_JUSTIFICACION[concepto] || "";
    const config = CODIGOS_RESPUESTA;

    const prompt = `Analiza la siguiente glosa recibida por un prestador de salud colombiano y recomienda la mejor respuesta:

DATOS DE LA GLOSA:
- Código de glosa: ${glosa.codigo_glosa}
- Concepto general: ${concepto} (${config.RS01.nombre})
- Descripción EPS: "${glosa.descripcion_glosa}"
- Valor glosado: $${glosa.valor_glosado.toLocaleString("es-CO")}
- Valor factura: $${glosa.valor_factura.toLocaleString("es-CO")}
- Porcentaje glosado: ${glosa.porcentaje_glosado}%
- EPS: ${glosa.eps_nombre} (${glosa.eps_codigo})
- Paciente: ${glosa.paciente_nombre}
- Servicio: ${glosa.servicio_descripcion || "No especificado"}
- Factura: ${glosa.num_factura}
- Fecha radicación: ${glosa.fecha_radicacion_factura}
- Fecha glosa: ${glosa.fecha_glosa}
- Días restantes para responder: ${glosa.dias_restantes}

PLANTILLA BASE PARA CONCEPTO ${concepto}:
"${plantilla}"

INSTRUCCIONES:
1. Recomienda RS01, RS02 o RS03 según el análisis
2. Si el error parece legítimo del prestador → RS01
3. Si el error es parcialmente atribuible → RS02
4. Si la glosa parece improcedente o el prestador tiene razón → RS03
5. Genera una justificación profesional y técnica
6. Cita las normas legales aplicables
7. Evalúa tu confianza (0.0 a 1.0)`;

    const result = await glosaAI.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as SugerenciaRespuestaIA;

    // Validar que el código es válido
    if (!["RS01", "RS02", "RS03", "RS04", "RS05"].includes(parsed.codigo_recomendado)) {
      parsed.codigo_recomendado = "RS03";
    }

    return parsed;
  } catch (error) {
    // Fallback: usar plantilla por concepto general → RS03
    const concepto = glosa.concepto_general;
    const plantilla = PLANTILLAS_JUSTIFICACION[concepto] || PLANTILLAS_JUSTIFICACION["FA"]!;

    return {
      codigo_recomendado: "RS03",
      justificacion_sugerida: plantilla,
      fundamento_legal:
        "Res. 2284/2023, Anexo Técnico 3. Ley 1438/2011, Art. 57.",
      confianza: 0.5,
      razonamiento:
        `No se pudo conectar con el asistente AI. Se sugiere RS03 (rechazo total) con la plantilla ` +
        `estándar para concepto ${concepto}. Revise y ajuste la justificación antes de enviar.`,
    };
  }
}
