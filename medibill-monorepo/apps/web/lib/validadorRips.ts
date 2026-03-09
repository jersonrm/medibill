import Ajv, { type ValidateFunction } from "ajv";

// logger:false evita que AJV llame console.error (Next.js devtools lo intercepta y muestra como error)
// validateSchema:false y strict:false evitan compilar el meta-schema (usa new Function() que falla en el browser)
const ajv = new Ajv({ allErrors: true, validateSchema: false, strict: false, logger: false });

// Sub-esquema de servicios (reutilizado dentro de cada usuario)
const esquemaServicios = {
  type: "object",
  properties: {
    consultas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codPrestador: { type: "string", minLength: 1 },
          fechaInicioAtencion: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$" },
          numAutorizacion: { type: ["string", "null"] },
          codConsulta: { type: "string", minLength: 1, pattern: "^\\d{6}$" },
          modalidadGrupoServicioTecSal: { type: "string" },
          grupoServicios: { type: "string" },
          codServicio: { type: "number" },
          finalidadTecnologiaSalud: { type: "string" },
          causaMotivoAtencion: { type: "string" },
          codDiagnosticoPrincipal: { type: "string", minLength: 3, pattern: "^[A-Z]\\d{2,4}$" },
          codDiagnosticoRelacionado1: { type: ["string", "null"] },
          codDiagnosticoRelacionado2: { type: ["string", "null"] },
          codDiagnosticoRelacionado3: { type: ["string", "null"] },
          tipoDiagnosticoPrincipal: { type: "string", enum: ["01", "02", "03"] },
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          vrServicio: { type: "number", minimum: 0 },
          conceptoRecaudo: { type: "string", enum: ["01", "02", "03", "04", "05"] },
          valorPagoModerador: { type: "number", minimum: 0 },
          numFEVPagoModerador: { type: ["string", "null"] },
          consecutivo: { type: "number", minimum: 1 },
        },
        required: [
          "codPrestador", "fechaInicioAtencion", "codConsulta",
          "modalidadGrupoServicioTecSal", "finalidadTecnologiaSalud",
          "causaMotivoAtencion", "codDiagnosticoPrincipal",
          "tipoDiagnosticoPrincipal", "vrServicio", "conceptoRecaudo",
          "valorPagoModerador", "consecutivo"
        ]
      }
    },
    procedimientos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codPrestador: { type: "string" },
          fechaInicioAtencion: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$" },
          idMIPRES: { type: ["string", "null"] },
          numAutorizacion: { type: ["string", "null"] },
          codProcedimiento: { type: "string", minLength: 1 },
          viaIngresoServicioSalud: { type: "string", enum: ["01", "02"] },
          modalidadGrupoServicioTecSal: { type: "string" },
          grupoServicios: { type: "string" },
          codServicio: { type: "number" },
          finalidadTecnologiaSalud: { type: "string" },
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          codDiagnosticoPrincipal: { type: "string", minLength: 3, pattern: "^[A-Z]\\d{2,4}$" },
          codDiagnosticoRelacionado: { type: ["string", "null"] },
          codComplicacion: { type: ["string", "null"] },
          vrServicio: { type: "number", minimum: 0 },
          conceptoRecaudo: { type: "string", enum: ["01", "02", "03", "04", "05"] },
          valorPagoModerador: { type: "number", minimum: 0 },
          numFEVPagoModerador: { type: ["string", "null"] },
          consecutivo: { type: "number", minimum: 1 },
        },
        required: [
          "codPrestador", "fechaInicioAtencion", "codProcedimiento",
          "modalidadGrupoServicioTecSal", "finalidadTecnologiaSalud",
          "codDiagnosticoPrincipal", "vrServicio", "conceptoRecaudo",
          "valorPagoModerador", "consecutivo"
        ]
      }
    },
    urgencias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codPrestador: { type: "string", minLength: 1 },
          fechaInicioAtencion: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$" },
          numAutorizacion: { type: ["string", "null"] },
          codDiagnosticoPrincipal: { type: "string", minLength: 3, pattern: "^[A-Z]\\d{2,4}$" },
          codDiagnosticoRelacionado1: { type: ["string", "null"] },
          codDiagnosticoRelacionado2: { type: ["string", "null"] },
          codDiagnosticoRelacionado3: { type: ["string", "null"] },
          codDiagnosticoCausaMuerte: { type: ["string", "null"] },
          condicionDestinoUsuarioEgreso: { type: "string", enum: ["01", "02", "03", "04", "05", "06"] },
          tipoDiagnosticoPrincipal: { type: "string", enum: ["01", "02", "03"] },
          fechaEgreso: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$" },
          codConsulta: { type: "string", minLength: 1 },
          modalidadGrupoServicioTecSal: { type: "string" },
          grupoServicios: { type: "string" },
          codServicio: { type: "number" },
          causaMotivoAtencion: { type: "string" },
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          vrServicio: { type: "number", minimum: 0 },
          conceptoRecaudo: { type: "string", enum: ["01", "02", "03", "04", "05"] },
          valorPagoModerador: { type: "number", minimum: 0 },
          numFEVPagoModerador: { type: ["string", "null"] },
          consecutivo: { type: "number", minimum: 1 },
        },
        required: [
          "codPrestador", "fechaInicioAtencion", "codDiagnosticoPrincipal",
          "condicionDestinoUsuarioEgreso", "tipoDiagnosticoPrincipal", "fechaEgreso", "codConsulta",
          "modalidadGrupoServicioTecSal", "causaMotivoAtencion",
          "vrServicio", "conceptoRecaudo", "valorPagoModerador", "consecutivo"
        ]
      }
    },
    hospitalizacion: { type: "array" },
    recienNacidos: { type: "array" },
    medicamentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codPrestador: { type: "string", minLength: 1 },
          numAutorizacion: { type: ["string", "null"] },
          idMIPRES: { type: ["string", "null"] },
          fechaDispensAdmon: { type: "string" },
          codMedicamento: { type: "string", minLength: 1 },
          tipoMedicamento: { type: "string", enum: ["01", "02"] },
          nombreGenerico: { type: "string", minLength: 1 },
          formaFarmaceutica: { type: "string" },
          concentracion: { type: "string" },
          unidadMedida: { type: "string" },
          cantidadDispensada: { type: "number", minimum: 1 },
          diasTratamiento: { type: "number", minimum: 1 },
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          vrUnitMedicamento: { type: "number", minimum: 0 },
          vrServicio: { type: "number", minimum: 0 },
          conceptoRecaudo: { type: "string", enum: ["01", "02", "03", "04", "05"] },
          valorPagoModerador: { type: "number", minimum: 0 },
          numFEVPagoModerador: { type: ["string", "null"] },
          consecutivo: { type: "number", minimum: 1 },
        },
        required: [
          "codPrestador", "fechaDispensAdmon", "codMedicamento", "tipoMedicamento",
          "nombreGenerico", "cantidadDispensada", "diasTratamiento",
          "vrUnitMedicamento", "vrServicio", "conceptoRecaudo", "valorPagoModerador", "consecutivo"
        ]
      }
    },
    otrosServicios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codPrestador: { type: "string", minLength: 1 },
          numAutorizacion: { type: ["string", "null"] },
          idMIPRES: { type: ["string", "null"] },
          fechaSuministroTecnologia: { type: "string" },
          tipoDocumentoIdentificacion: { type: "string" },
          numDocumentoIdentificacion: { type: "string" },
          nomTecnologiaSalud: { type: "string", minLength: 1 },
          codTecnologiaSalud: { type: "string", minLength: 1 },
          cantidad: { type: "number", minimum: 1 },
          vrUnitTecnologia: { type: "number", minimum: 0 },
          vrServicio: { type: "number", minimum: 0 },
          conceptoRecaudo: { type: "string", enum: ["01", "02", "03", "04", "05"] },
          valorPagoModerador: { type: "number", minimum: 0 },
          numFEVPagoModerador: { type: ["string", "null"] },
          consecutivo: { type: "number", minimum: 1 },
        },
        required: [
          "codPrestador", "fechaSuministroTecnologia", "nomTecnologiaSalud",
          "codTecnologiaSalud", "cantidad", "vrUnitTecnologia", "vrServicio",
          "conceptoRecaudo", "valorPagoModerador", "consecutivo"
        ]
      }
    },
  },
  required: ["consultas", "procedimientos", "urgencias", "hospitalizacion", "recienNacidos", "medicamentos", "otrosServicios"]
};

// Esquema FEV-RIPS oficial (Resolución 2275 de 2023 - Anexo Técnico)
const esquemaFevRips2275 = {
  type: "object",
  properties: {
    numDocumentoIdObligado: { type: "string", minLength: 1 },
    numFactura: { type: "string", minLength: 1 },
    numObligacion: { type: "string" },
    tipoNota: { type: ["string", "null"] },
    numNota: { type: ["string", "null"] },
    usuarios: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          tipoDocumentoIdentificacion: { type: "string", enum: ["CC", "TI", "RC", "CE", "PA", "MS", "AS", "CD", "SC", "PE", "PT", "CN", "DE", "SI", "NI"] },
          numDocumentoIdentificacion: { type: "string", minLength: 1 },
          tipoUsuario: { type: "string", enum: ["01", "02", "03", "04", "05", "06", "07", "08"] },
          fechaNacimiento: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          codSexo: { type: "string", enum: ["M", "F", "I"] },
          codPaisResidencia: { type: "string", minLength: 1 },
          codMunicipioResidencia: { type: "string", minLength: 1 },
          codZonaTerritorialResidencia: { type: "string", enum: ["U", "R"] },
          incapacidad: { type: "string", enum: ["SI", "NO"] },
          codEntidadAdministradora: { type: "string" },
          consecutivo: { type: "number", minimum: 1 },
          servicios: esquemaServicios,
        },
        required: [
          "tipoDocumentoIdentificacion", "numDocumentoIdentificacion", "tipoUsuario",
          "fechaNacimiento", "codSexo", "codPaisResidencia", "codMunicipioResidencia",
          "codZonaTerritorialResidencia", "incapacidad", "codEntidadAdministradora",
          "consecutivo", "servicios"
        ]
      }
    },
  },
  required: ["numDocumentoIdObligado", "numFactura", "numObligacion", "usuarios"]
};

// Compilación lazy: evita que new Function() falle durante la evaluación del módulo en el browser
let _validadorRips: ValidateFunction | null = null;

export function getValidadorRips(): ValidateFunction {
  if (!_validadorRips) {
    _validadorRips = ajv.compile(esquemaFevRips2275);
  }
  return _validadorRips;
}