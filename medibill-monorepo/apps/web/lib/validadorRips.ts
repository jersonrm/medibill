import Ajv from "ajv";

// Inicializamos el validador pidiendo que nos devuelva TODOS los errores, no solo el primero
const ajv = new Ajv({ allErrors: true });

// Este es el "Molde de la Ley 2275" (Versión simplificada para el MVP)
const esquemaRips2275 = {
  type: "object",
  properties: {
    prestador: {
      type: "object",
      properties: {
        tipoDocumentoIdentificacion: { type: "string" },
        numDocumentoIdentificacion: { type: "string", minLength: 5 },
        codigoHabilitacion: { type: "string", minLength: 10, maxLength: 12 }
      },
      required: ["tipoDocumentoIdentificacion", "numDocumentoIdentificacion", "codigoHabilitacion"]
    },
    usuarios: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          fechaNacimiento: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, // Formato YYYY-MM-DD
          sexoBiologico: { type: "string", enum: ["M", "F"] }
        },
        required: ["tipoDocumentoIdentificacion", "numDocumentoIdentificacion", "fechaNacimiento", "sexoBiologico"]
      }
    },
    consultas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codigoConsulta: { type: "string" },
          fechaInicioAtencion: { type: "string" },
          codigoDiagnosticoPrincipal: { type: "string" },
          valorConsulta: { type: "number", minimum: 0 }
        },
        required: ["codigoConsulta", "fechaInicioAtencion", "codigoDiagnosticoPrincipal", "valorConsulta"]
      }
    },
    procedimientos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codigoProcedimiento: { type: "string" },
          codigoDiagnosticoPrincipal: { type: "string" }
        },
        required: ["codigoProcedimiento", "codigoDiagnosticoPrincipal"]
      }
    }
  },
  required: ["prestador", "usuarios"]
};

// Compilamos el validador para que sea súper rápido
export const validadorRips = ajv.compile(esquemaRips2275);