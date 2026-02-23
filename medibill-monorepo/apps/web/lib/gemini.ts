import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// 1. Creamos un sub-esquema reutilizable para las alternativas
const alternativasSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "Máximo 2 códigos alternativos o más específicos que podrían aplicar.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      codigo: { type: SchemaType.STRING },
      descripcion: { type: SchemaType.STRING },
    },
    required: ["codigo", "descripcion"],
  },
};

// 2. Integramos las alternativas en el esquema principal
const schema: Schema = {
  description: "Clasificación de códigos de salud Colombia con alternativas sugeridas",
  type: SchemaType.OBJECT,
  properties: {
    diagnosticos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          codigo_cie10: { type: SchemaType.STRING },
          descripcion: { type: SchemaType.STRING },
          alternativas: alternativasSchema,
        },
        required: ["codigo_cie10", "descripcion"],
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
          alternativas: alternativasSchema,
        },
        required: ["codigo_cups", "descripcion", "cantidad"],
      },
    },
  },
  required: ["diagnosticos", "procedimientos"],
};

export const medibillAI = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
  },
  // 3. Instrucciones del sistema reforzadas con PROMPT NEGATIVO
  systemInstruction: "Eres un auditor médico experto en facturación en Colombia (Resolución 2275). Convierte texto clínico informal en JSON estructurado con códigos CUPS y CIE-10. Para cada diagnóstico y procedimiento principal, evalúa el contexto y devuelve obligatoriamente en el arreglo 'alternativas' 1 o 2 códigos adicionales que también podrían ser correctos, más específicos, o aplicables según la especialidad del médico. REGLA ESTRICTA Y ABSOLUTA: NO incluyas medicamentos (pastillas, jarabes, inyecciones, formulaciones, dosis o cantidades de farmacia) en el arreglo de 'procedimientos' bajo ninguna circunstancia. Si el texto menciona la receta, suministro o entrega de un medicamento (ej. acetaminofén 500mg por 20 unidades), IGNÓRALO por completo. Los procedimientos (CUPS) son exclusivamente acciones médicas, intervenciones quirúrgicas, terapias, imágenes o exámenes de laboratorio.",
});