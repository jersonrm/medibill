"use server";

import { devLog, devWarn } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { FevRips, DatosParaRips, ConsultaRips, ProcedimientoRips, UsuarioRips, UrgenciaRips } from "@/lib/types/rips";

// ==========================================
// MOTOR RIPS - RESOLUCIÓN 2275 (FEV-RIPS OFICIAL)
// ==========================================

export async function generarJsonRipsMVP(datos: DatosParaRips): Promise<FevRips> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Datos del prestador (médico autenticado)
  let prestador = { nit: "0", cod: "0" };

  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("numero_documento, codigo_habilitacion")
      .eq("id", user.id)
      .single();
    if (perfil) {
      prestador = { 
        nit: perfil.numero_documento || "0", 
        cod: perfil.codigo_habilitacion || "0" 
      };
    }
  }

  // ═══ VALIDACIÓN FECHA NACIMIENTO ═══
  const anioNac = parseInt(datos.fechaNacimientoPaciente?.substring(0, 4) || "0", 10);
  const anioActual = new Date().getFullYear();
  if (anioNac < 1900 || anioNac > anioActual) {
    console.error(`Fecha de nacimiento inválida (año ${anioNac}). Debe estar entre 1900 y ${anioActual}.`);
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
  let diag3Relacionados: any[];
  if (diagCausaExterna.length > 0) {
    // Reservar el último slot(s) para causa_externa, llenar el resto con relacionados clínicos
    const slotsParaRelacionados = Math.max(0, 3 - diagCausaExterna.length);
    diag3Relacionados = [
      ...diagSoloRelacionados.slice(0, slotsParaRelacionados),
      ...diagCausaExterna,
    ].slice(0, 3);
    if (diagCausaExterna.length > 1) {
      devWarn("Múltiples causas externas", `${diagCausaExterna.length} códigos detectados`);
    }
  } else {
    // Sin causa externa: usar los primeros 3 relacionados clínicos
    diag3Relacionados = diagSoloRelacionados.slice(0, 3);
  }

  // LÓGICA DE PRECIOS PERSONALIZADOS
  let valorFinalConsulta = datos.atencionIA.valor_consulta;
  
  if (user) {
    const { data: servicioConfigurado } = await supabase
      .from("servicios_medico")
      .select("tarifa")
      .eq("user_id", user.id)
      .eq("codigo_cups", "890201")
      .single();

    if (servicioConfigurado) {
      valorFinalConsulta = servicioConfigurado.tarifa;
    }
  }

  // Determinar concepto de recaudo según tipo de usuario y causa de atención
  // Si es Accidente de Trabajo (01) o Enfermedad Profesional (13), la ARL asume todo → "05" No aplica
  // Si es particular/no asegurado (04/05) → "05" No aplica
  // En otro caso → "01" Cuota moderadora
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

  // USUARIOS (US) — Estructura oficial Res. 2275
  const usuarios: UsuarioRips[] = [
    {
      tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente,
      numDocumentoIdentificacion: datos.documentoPaciente,
      tipoUsuario: datos.tipoUsuarioPaciente,
      fechaNacimiento: datos.fechaNacimientoPaciente,
      codSexo: datos.sexoPaciente,
      codPaisResidencia: datos.codPaisResidencia || "170",
      codMunicipioResidencia: datos.codMunicipioResidencia || "00000",
      codZonaTerritorialResidencia: datos.codZonaTerritorialResidencia || "U",
      incapacidad: datos.incapacidad || "NO",
      consecutivo: 1,
    }
  ];

  // CONSULTAS (CT) — Estructura oficial Res. 2275
  const esUrgencias = datos.atencionIA.tipo_servicio === "urgencias";

  const consultas: ConsultaRips[] = esUrgencias ? [] : [
    {
      codPrestador: prestador.cod,
      fechaInicioAtencion: fechaHoy,
      numAutorizacion: null,
      codigoConsulta: "890201",
      modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as ConsultaRips["modalidadGrupoServicioTecSal"],
      grupoServicios: "01",
      codServicio: 100,
      finalidadTecnologiaSalud: datos.atencionIA.finalidad as ConsultaRips["finalidadTecnologiaSalud"],
      causaMotivoAtencion: datos.atencionIA.causa as ConsultaRips["causaMotivoAtencion"],
      codDiagnosticoPrincipal: diagPrincipal,
      codDiagnosticoRelacionado1: diag3Relacionados[0]?.codigo_cie10 || null,
      codDiagnosticoRelacionado2: diag3Relacionados[1]?.codigo_cie10 || null,
      codDiagnosticoRelacionado3: diag3Relacionados[2]?.codigo_cie10 || null,
      tipoDiagnosticoPrincipal: datos.atencionIA.tipo_diagnostico as ConsultaRips["tipoDiagnosticoPrincipal"],
      tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente,
      numDocumentoIdentificacion: datos.documentoPaciente,
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
      numAutorizacion: null,
      codDiagnosticoPrincipal: diagPrincipal,
      codDiagnosticoRelacionado1: diag3Relacionados[0]?.codigo_cie10 || null,
      codDiagnosticoRelacionado2: diag3Relacionados[1]?.codigo_cie10 || null,
      codDiagnosticoRelacionado3: diag3Relacionados[2]?.codigo_cie10 || null,
      codDiagnosticoCausaMuerte: null,
      condicionDestinoUsuarioEgreso: (datos.atencionIA.condicion_egreso || "01") as UrgenciaRips["condicionDestinoUsuarioEgreso"], // Determinado por IA desde nota clínica
      tipoDiagnosticoPrincipal: datos.atencionIA.tipo_diagnostico as UrgenciaRips["tipoDiagnosticoPrincipal"],
      fechaEgreso: fechaHoy,
      codigoConsulta: "890201",
      modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as UrgenciaRips["modalidadGrupoServicioTecSal"],
      grupoServicios: "01",
      codServicio: 100,
      causaMotivoAtencion: datos.atencionIA.causa as UrgenciaRips["causaMotivoAtencion"],
      tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente,
      numDocumentoIdentificacion: datos.documentoPaciente,
      vrServicio: valorFinalConsulta,
      conceptoRecaudo,
      valorPagoModerador: datos.atencionIA.valor_cuota,
      numFEVPagoModerador: null,
      consecutivo: 1,
    }
  ] : [];

  // PROCEDIMIENTOS (AF) — Estructura oficial Res. 2275
  // viaIngresoServicioSalud: "01" = Demanda espontánea (urgencias/consulta directa), "02" = Remitido
  const viaIngreso = esUrgencias ? "01" as const : "02" as const;
  
  const procedimientos: ProcedimientoRips[] = datos.procedimientos.map((proc, idx) => ({
    codPrestador: prestador.cod,
    fechaInicioAtencion: fechaHoy,
    idMIPRES: null,
    numAutorizacion: null,
    codigoProcedimiento: String(proc.codigo_cups || "").replace(/[.\s-]/g, "").toUpperCase(),
    viaIngresoServicioSalud: viaIngreso,
    modalidadGrupoServicioTecSal: datos.atencionIA.modalidad as ProcedimientoRips["modalidadGrupoServicioTecSal"],
    grupoServicios: "01",
    codServicio: 100,
    finalidadTecnologiaSalud: datos.atencionIA.finalidad as ProcedimientoRips["finalidadTecnologiaSalud"],
    tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente,
    numDocumentoIdentificacion: datos.documentoPaciente,
    // Usar diagnóstico asociado específico del procedimiento si existe, sino el principal
    codDiagnosticoPrincipal: proc.diagnostico_asociado 
      ? String(proc.diagnostico_asociado).replace(/[.\s-]/g, "").toUpperCase()
      : diagPrincipal,
    codDiagnosticoRelacionado: null,
    codComplicacion: null,
    vrServicio: 0,
    conceptoRecaudo,
    valorPagoModerador: 0,
    numFEVPagoModerador: null,
    consecutivo: idx + 2, // Consecutivo inicia en 2 (1 es la consulta)
  }));

  // ESTRUCTURA RAÍZ FEV-RIPS (Resolución 2275)
  const fevRips: FevRips = {
    numDocumentoIdObligado: prestador.nit,
    numFactura: `MDB-${Date.now()}`, // Prefijo Medibill + timestamp
    tipoNota: null,
    numNota: null,
    usuarios,
    servicios: {
      consultas,
      procedimientos: procedimientos.length > 0 ? procedimientos : [],
      urgencias,
      hospitalizacion: [],
      recienNacidos: [],
      medicamentos: [],
      otrosServicios: [],
    },
  };

  // ═══ WARNING: Medicamentos no reportados ═══
  if (fevRips.servicios.medicamentos.length === 0) {
    devWarn("medicamentos", "Sección medicamentos[] vacía — funcionalidad AM pendiente");
  }

  // ═══ DEBUG RIPS ═══ (logs en servidor para validación)
  devLog("generarJsonRipsMVP", "═══ RIPS DEBUG ═══");
  devLog("RIPS config", `Tipo servicio: ${datos.atencionIA.tipo_servicio} | esUrgencias: ${esUrgencias}`);
  devLog("RIPS config", `Causa: ${datos.atencionIA.causa} | conceptoRecaudo: ${conceptoRecaudo}`);
  devLog("RIPS config", `viaIngreso: ${viaIngreso}`);
  devLog("RIPS Dx", `Principal: ${diagPrincipal} | Total: ${datos.diagnosticos.length}`);
  datos.diagnosticos.forEach((d, i) => {
    devLog("RIPS Dx", `[${i}]: ${d.codigo_cie10} | rol: ${d.rol} | ${d.descripcion?.substring(0, 50)}`);
  });
  devLog("RIPS Dx relacionados", `${diag3Relacionados.length} slots`);
  diag3Relacionados.forEach((d, i) => {
    devLog("RIPS Dx slot", `${i+1}: ${d.codigo_cie10} | rol: ${d.rol}`);
  });
  if (diagCausaExterna.length > 0) {
    devLog("RIPS causa externa", `${diagCausaExterna.length} detectados`);
  } else {
    devWarn("RIPS causa externa", "No se detectó código W/X/Y/V");
  }
  devLog("RIPS Proc", `${procedimientos.length} procedimientos`);
  procedimientos.forEach((p, i) => {
    devLog("RIPS Proc", `[${i}]: ${p.codigoProcedimiento} → codDxPrincipal: ${p.codDiagnosticoPrincipal} | via: ${p.viaIngresoServicioSalud}`);
  });
  if (esUrgencias && urgencias.length > 0) {
    const u = urgencias[0]!;
    devLog("RIPS Urgencia", `DxPrincipal=${u.codDiagnosticoPrincipal} | slots: ${u.codDiagnosticoRelacionado1}, ${u.codDiagnosticoRelacionado2}, ${u.codDiagnosticoRelacionado3}`);
    devLog("RIPS Urgencia", `tipoDiag=${u.tipoDiagnosticoPrincipal} | causa=${u.causaMotivoAtencion} | egreso=${u.condicionDestinoUsuarioEgreso}`);
  }
  devLog("generarJsonRipsMVP", "═══ FIN RIPS DEBUG ═══");

  return fevRips;
}
