import { devLog, devWarn, devError } from "@/lib/logger";
import { obtenerGrupoServicio, obtenerGrupoServicioProcedimiento } from "@/lib/catalogo-rips";
import type { DiagnosticoIA } from "@/lib/types/validacion";
import type { FevRips, DatosParaRips, ConsultaRips, ProcedimientoRips, UsuarioRips, UrgenciaRips, MedicamentoRips, OtroServicioRips, ServiciosRips } from "@/lib/types/rips";

// ==========================================
// LÓGICA PURA DE CONSTRUCCIÓN FEV-RIPS
// ==========================================

/**
 * Construye la estructura FevRips (Res. 2275) a partir de datos ya resueltos.
 * Función pura sin acceso a DB — usada internamente y en tests.
 */
export function construirFevRips(
  datos: DatosParaRips,
  prestador: { nit: string; cod: string },
): FevRips {
  // ═══ VALIDACIÓN FECHA NACIMIENTO ═══
  const anioNac = parseInt(datos.fechaNacimientoPaciente?.substring(0, 4) || "0", 10);
  const anioActual = new Date().getFullYear();
  if (anioNac < 1900 || anioNac > anioActual) {
    devError(`Fecha de nacimiento inválida (año ${anioNac}). Debe estar entre 1900 y ${anioActual}.`);
    throw new Error(`Fecha de nacimiento inválida: "${datos.fechaNacimientoPaciente}". El año debe estar entre 1900 y ${anioActual}.`);
  }

  const fechaHoy = new Date().toISOString().slice(0, 16).replace('T', ' '); 
  const diagPrincipal = (datos.diagnosticos[0]?.codigo_cie10 || "Z000").replace(/[.\s-]/g, "");

  // Separar diagnósticos relacionados y causa externa para priorización en RIPS
  // Res. 2275 solo permite 3 diagnósticos relacionados — si hay causa_externa, DEBE incluirse
  const diagRelacionados = datos.diagnosticos.slice(1); // todos menos el principal
  const diagCausaExterna = diagRelacionados.filter(d => d.rol === "causa_externa");
  const diagSoloRelacionados = diagRelacionados.filter(d => d.rol !== "causa_externa");
  
  // PRIORIZACIÓN: Reservar SIEMPRE un slot para causa_externa cuando existe
  // La causa externa (W/X/Y/V) es OBLIGATORIA para AT, Tránsito y EP ante ARL/SOAT
  let diag3Relacionados: DiagnosticoIA[];
  if (diagCausaExterna.length > 0) {
    const slotsParaRelacionados = Math.max(0, 3 - diagCausaExterna.length);
    diag3Relacionados = [
      ...diagSoloRelacionados.slice(0, slotsParaRelacionados),
      ...diagCausaExterna,
    ].slice(0, 3);
    if (diagCausaExterna.length > 1) {
      devWarn("Múltiples causas externas", `${diagCausaExterna.length} códigos detectados`);
    }
  } else {
    diag3Relacionados = diagSoloRelacionados.slice(0, 3);
  }

  const valorFinalConsulta = datos.atencionIA.valor_consulta;
  const codConsultaCups = datos.atencionIA.codConsultaCups || "890201";

  // Determinar grupo de servicios y código dinámicamente
  const grupoServicioConsulta = obtenerGrupoServicio(datos.atencionIA.tipo_servicio);

  // Determinar concepto de recaudo según tipo de usuario y causa de atención
  const causa = datos.atencionIA.causa;
  const conceptoRecaudo = (
    datos.tipoUsuarioPaciente === "04" || 
    datos.tipoUsuarioPaciente === "05" ||
    causa === "01" || // Accidente de Trabajo → ARL paga todo
    causa === "02" || // Accidente de Tránsito → SOAT paga todo
    causa === "13"    // Enfermedad Profesional → ARL paga todo
  ) 
    ? "05" as const  // No aplica
    : "01" as const; // Cuota moderadora

  // CONSULTAS (CT) — Estructura oficial Res. 2275
  const esUrgencias = datos.atencionIA.tipo_servicio === "urgencias";

  const consultas: ConsultaRips[] = esUrgencias ? [] : [
    {
      codPrestador: prestador.cod,
      fechaInicioAtencion: fechaHoy,
      numAutorizacion: datos.atencionIA.numAutorizacion || null,
      codConsulta: codConsultaCups,
      modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as ConsultaRips["modalidadGrupoServicioTecSal"],
      grupoServicios: grupoServicioConsulta.grupoServicios,
      codServicio: grupoServicioConsulta.codServicio,
      finalidadTecnologiaSalud: datos.atencionIA.finalidad as ConsultaRips["finalidadTecnologiaSalud"],
      causaMotivoAtencion: datos.atencionIA.causa as ConsultaRips["causaMotivoAtencion"],
      codDiagnosticoPrincipal: diagPrincipal,
      codDiagnosticoRelacionado1: diag3Relacionados[0]?.codigo_cie10 || null,
      codDiagnosticoRelacionado2: diag3Relacionados[1]?.codigo_cie10 || null,
      codDiagnosticoRelacionado3: diag3Relacionados[2]?.codigo_cie10 || null,
      tipoDiagnosticoPrincipal: datos.atencionIA.tipo_diagnostico as ConsultaRips["tipoDiagnosticoPrincipal"],
      tipoDocumentoIdentificacion: datos.tipoDocumentoProfesional,
      numDocumentoIdentificacion: datos.documentoProfesional,
      vrServicio: valorFinalConsulta,
      conceptoRecaudo,
      valorPagoModerador: datos.atencionIA.valor_cuota,
      numFEVPagoModerador: null,
      consecutivo: 1,
    }
  ];

  // URGENCIAS (AU) — Estructura oficial Res. 2275
  const urgencias: UrgenciaRips[] = esUrgencias ? [
    {
      codPrestador: prestador.cod,
      fechaInicioAtencion: fechaHoy,
      numAutorizacion: datos.atencionIA.numAutorizacion || null,
      codDiagnosticoPrincipal: diagPrincipal,
      codDiagnosticoRelacionado1: diag3Relacionados[0]?.codigo_cie10 || null,
      codDiagnosticoRelacionado2: diag3Relacionados[1]?.codigo_cie10 || null,
      codDiagnosticoRelacionado3: diag3Relacionados[2]?.codigo_cie10 || null,
      codDiagnosticoCausaMuerte: null,
      condicionDestinoUsuarioEgreso: (datos.atencionIA.condicion_egreso || "01") as UrgenciaRips["condicionDestinoUsuarioEgreso"],
      tipoDiagnosticoPrincipal: datos.atencionIA.tipo_diagnostico as UrgenciaRips["tipoDiagnosticoPrincipal"],
      fechaEgreso: fechaHoy,
      codConsulta: codConsultaCups,
      modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as UrgenciaRips["modalidadGrupoServicioTecSal"],
      grupoServicios: grupoServicioConsulta.grupoServicios,
      codServicio: grupoServicioConsulta.codServicio,
      causaMotivoAtencion: datos.atencionIA.causa as UrgenciaRips["causaMotivoAtencion"],
      tipoDocumentoIdentificacion: datos.tipoDocumentoProfesional,
      numDocumentoIdentificacion: datos.documentoProfesional,
      vrServicio: valorFinalConsulta,
      conceptoRecaudo,
      valorPagoModerador: datos.atencionIA.valor_cuota,
      numFEVPagoModerador: null,
      consecutivo: 1,
    }
  ] : [];

  // PROCEDIMIENTOS (AF) — Estructura oficial Res. 2275
  const viaIngreso = esUrgencias ? "01" as const : "02" as const;
  
  const procedimientos: ProcedimientoRips[] = datos.procedimientos.map((proc, idx) => {
    const cupsLimpio = String(proc.codigo_cups || "").replace(/[.\s-]/g, "").toUpperCase();
    const grupoProc = obtenerGrupoServicioProcedimiento(cupsLimpio, datos.atencionIA.tipo_servicio);

    let dxProcedimiento = diagPrincipal;
    if (proc.diagnostico_asociado) {
      const dxAsoc = String(proc.diagnostico_asociado).replace(/[.\s-]/g, "").toUpperCase();
      if (/^[WXYV]/.test(dxAsoc)) {
        devLog("Dx proc corregido", `proc ${cupsLimpio}: dxAsociado ${dxAsoc} es causa externa (W/X/Y/V) → usando diagPrincipal ${diagPrincipal}`);
      } else {
        dxProcedimiento = dxAsoc;
      }
    }

    return {
      codPrestador: prestador.cod,
      fechaInicioAtencion: fechaHoy,
      idMIPRES: null,
      numAutorizacion: proc.numAutorizacion || null,
      codProcedimiento: cupsLimpio,
      viaIngresoServicioSalud: viaIngreso,
      modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as ProcedimientoRips["modalidadGrupoServicioTecSal"],
      grupoServicios: grupoProc.grupoServicios,
      codServicio: grupoProc.codServicio,
      finalidadTecnologiaSalud: datos.atencionIA.finalidad as ProcedimientoRips["finalidadTecnologiaSalud"],
      tipoDocumentoIdentificacion: datos.tipoDocumentoProfesional,
      numDocumentoIdentificacion: datos.documentoProfesional,
      codDiagnosticoPrincipal: dxProcedimiento,
      codDiagnosticoRelacionado: null,
      codComplicacion: null,
      vrServicio: proc.valor_procedimiento || proc.valor_unitario || 0,
      conceptoRecaudo,
      valorPagoModerador: 0,
      numFEVPagoModerador: null,
      consecutivo: idx + 2,
    };
  });

  // MEDICAMENTOS (AM) — Resolución 2275
  let consecutivoBase = 1 + (esUrgencias ? 1 : consultas.length) + procedimientos.length;
  
  const medicamentos: MedicamentoRips[] = (datos.medicamentos || []).map((med, idx) => ({
    codPrestador: prestador.cod,
    numAutorizacion: med.numAutorizacion || null,
    idMIPRES: med.idMIPRES || null,
    fechaDispensAdmon: fechaHoy,
    codDiagnosticoPrincipal: med.codDiagnosticoPrincipal || diagPrincipal,
    codDiagnosticoRelacionado: med.codDiagnosticoRelacionado || null,
    tipoMedicamento: med.tipoMedicamento,
    codTecnologiaSalud: med.codTecnologiaSalud,
    nomTecnologiaSalud: med.nomTecnologiaSalud || null,
    concentracionMedicamento: med.concentracionMedicamento,
    unidadMedida: med.unidadMedida,
    formaFarmaceutica: med.formaFarmaceutica || null,
    unidadMinDispensa: med.unidadMinDispensa,
    cantidadMedicamento: med.cantidadMedicamento,
    diasTratamiento: med.diasTratamiento,
    tipoDocumentoIdentificacion: datos.tipoDocumentoProfesional,
    numDocumentoIdentificacion: datos.documentoProfesional,
    vrUnitMedicamento: med.vrUnitMedicamento,
    vrServicio: med.vrUnitMedicamento * med.cantidadMedicamento,
    conceptoRecaudo,
    valorPagoModerador: 0,
    numFEVPagoModerador: null,
    consecutivo: consecutivoBase + idx,
  }));

  consecutivoBase += medicamentos.length;

  // OTROS SERVICIOS (AT) — Resolución 2275
  const otrosServiciosRips: OtroServicioRips[] = (datos.otrosServicios || []).map((mat, idx) => ({
    codPrestador: prestador.cod,
    numAutorizacion: mat.numAutorizacion || null,
    idMIPRES: mat.idMIPRES || null,
    fechaSuministroTecnologia: fechaHoy,
    tipoDocumentoIdentificacion: datos.tipoDocumentoProfesional,
    numDocumentoIdentificacion: datos.documentoProfesional,
    nomTecnologiaSalud: mat.nomTecnologiaSalud,
    codTecnologiaSalud: mat.codTecnologiaSalud,
    cantidad: mat.cantidad,
    vrUnitTecnologia: mat.vrUnitTecnologia,
    vrServicio: mat.vrUnitTecnologia * mat.cantidad,
    conceptoRecaudo,
    valorPagoModerador: 0,
    numFEVPagoModerador: null,
    consecutivo: consecutivoBase + idx,
  }));

  // SERVICIOS — agrupados dentro de cada usuario (Res. 2275)
  const servicios: ServiciosRips = {
    consultas,
    procedimientos: procedimientos.length > 0 ? procedimientos : [],
    urgencias,
    hospitalizacion: [],
    recienNacidos: [],
    medicamentos,
    otrosServicios: otrosServiciosRips,
  };

  // USUARIOS (US) — Estructura oficial Res. 2275 (servicios anidados)
  const usuarios: UsuarioRips[] = [
    {
      consecutivo: 1,
      tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente,
      numDocumentoIdentificacion: datos.documentoPaciente,
      tipoUsuario: datos.tipoUsuarioPaciente,
      fechaNacimiento: datos.fechaNacimientoPaciente,
      codSexo: datos.sexoPaciente,
      codPaisResidencia: datos.codPaisResidencia || "170",
      codMunicipioResidencia: datos.codMunicipioResidencia || "00000",
      codZonaTerritorialResidencia: datos.codZonaTerritorialResidencia || "01",
      incapacidad: datos.incapacidad || "NO",
      codPaisOrigen: datos.codPaisOrigen || "170",
      servicios,
    }
  ];

  // ESTRUCTURA RAÍZ FEV-RIPS (Resolución 2275)
  const fevRips: FevRips = {
    numDocumentoIdObligado: prestador.nit,
    numFactura: datos.numFactura,
    numObligacion: datos.numObligacion || "",
    tipoNota: null,
    numNota: null,
    usuarios,
  };

  if (servicios.medicamentos.length === 0) {
    devWarn("medicamentos", "Sección medicamentos[] vacía — funcionalidad AM pendiente");
  }

  devLog("construirFevRips:resultado", JSON.stringify({
    tipoServicio: datos.atencionIA.tipo_servicio,
    esUrgencias,
    diagPrincipal,
    totalDiagnosticos: datos.diagnosticos.length,
    totalProcedimientos: procedimientos.length,
    dxRelacionados: diag3Relacionados.length,
    causaExterna: diagCausaExterna.length,
    conceptoRecaudo,
    viaIngreso,
  }));

  return fevRips;
}
