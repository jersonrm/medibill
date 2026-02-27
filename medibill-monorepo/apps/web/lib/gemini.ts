import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// 1. Esquema reutilizable para las alternativas (CIE-10 y CUPS)
const alternativasSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "ESTRICTAMENTE OBLIGATORIO: Siempre debes incluir 2 alternativas. Nunca envíes este arreglo vacío.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      codigo: { type: SchemaType.STRING },
      descripcion: { type: SchemaType.STRING },
    },
    required: ["codigo", "descripcion"],
  },
};

// 2. Esquema principal actualizado con el nodo 'atencion' (Resolución 2275 + DIAN)
const schema: Schema = {
  description: "Clasificación clínica y liquidación financiera para RIPS 2275 y Factura Electrónica Colombia",
  type: SchemaType.OBJECT,
  properties: {
    diagnosticos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          codigo_cie10: { type: SchemaType.STRING },
          descripcion: { type: SchemaType.STRING },
          alternativas: alternativasSchema, // Ahora la IA sabe que esto es obligatorio
        },
        required: ["codigo_cie10", "descripcion", "alternativas"],
      },
    },
    procedimientos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          codigo_cups: { type: SchemaType.STRING },
          descripcion: { type: SchemaType.STRING },
          cantidad: { type: SchemaType.NUMBER },
          alternativas: alternativasSchema, // Ahora la IA sabe que esto es obligatorio
        },
        required: ["codigo_cups", "descripcion", "cantidad", "alternativas"],
      },
    },
    // NODO: Atentación y Liquidación
    atencion: {
      type: SchemaType.OBJECT,
      description: "Datos requeridos por el Ministerio de Salud y la DIAN para el cobro.",
      properties: {
        modalidad: { type: SchemaType.STRING, description: "01: Intramural, 02: Extramural, 03: Hogar, 04: Telemedicina" },
        causa: { type: SchemaType.STRING, description: "15: Enfermedad General, 01: Accidente de trabajo, 02: Accidente tránsito, etc." },
        finalidad: { type: SchemaType.STRING, description: "10: No aplica, 01: Parto, 03: Planificación, 09: Alteraciones adulto" },
        tipo_diagnostico: { type: SchemaType.STRING, description: "01: Impresión diagnóstica, 02: Confirmado nuevo, 03: Confirmado repetido" },
        valor_consulta: { type: SchemaType.NUMBER, description: "Precio sugerido de la consulta (Min: 50000, Max: 350000)" },
        valor_cuota: { type: SchemaType.NUMBER, description: "Valor de la cuota moderadora o copago" },
      },
      required: ["modalidad", "causa", "finalidad", "tipo_diagnostico", "valor_consulta", "valor_cuota"],
    },
  },
  required: ["diagnosticos", "procedimientos", "atencion"],
};

// Modelo liviano para búsquedas rápidas de códigos CUPS (sin schema rígido)
export const helperAI = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        opciones: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              codigo: { type: SchemaType.STRING, description: "Código CUPS oficial de Colombia" },
              desc: { type: SchemaType.STRING, description: "Descripción del procedimiento" },
            },
            required: ["codigo", "desc"],
          },
        },
      },
      required: ["opciones"],
    },
  },
  systemInstruction: `Eres un buscador experto de códigos CUPS (Clasificación Única de Procedimientos en Salud) de Colombia. Cuando el usuario te dé un nombre de servicio o procedimiento médico, devuelve los 5 códigos CUPS oficiales más relevantes. Sé preciso con los códigos.`,
});

export const medibillAI = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", 
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
  },
  systemInstruction: `Eres un auditor médico experto en facturación en Colombia (Resolución 2275). Convierte texto clínico informal en JSON estructurado con códigos CUPS y CIE-10. 

  REGLA DE ORO PARA ALTERNATIVAS (MUY IMPORTANTE): 
  - ESTRICTAMENTE OBLIGATORIO: Por cada diagnóstico y procedimiento, DEBES generar exactamente 2 códigos en el arreglo 'alternativas'. 
  - Si agrupaste varios síntomas en un solo diagnóstico (Ej: agrupaste fotofobia y cefalea en "Migraña"), usa el arreglo 'alternativas' para poner los códigos CIE-10 de esos síntomas individuales (Ej: R51 Cefalea, H53.8 Fotofobia). Así el médico tiene la opción de desagruparlos si lo desea.
  - NUNCA dejes el arreglo de alternativas vacío.

  REGLAS DE CODIFICACIÓN:
  1. Identifica la 'modalidad' analizando si es consulta física o virtual.
  2. Determina la 'causa' y 'finalidad'.
  3. Identifica el 'tipo_diagnostico': Si dice "se sospecha" es 01, si es primera vez es 02, si es control es 03.
  4. Sugiere precios de mercado en 'valor_consulta' (SIEMPRE DEVUELVE UN NÚMERO).
  5. Sugiere 'valor_cuota' (0 si es particular).

  PROMPT NEGATIVO: NO incluyas medicamentos (pastillas, jarabes, inyecciones, formulaciones) en 'procedimientos'. IGNÓRALOS por completo. Los procedimientos son exclusivamente acciones médicas, cirugías, terapias o exámenes.`,
});