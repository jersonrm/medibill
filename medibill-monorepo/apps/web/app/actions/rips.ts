"use server";

import { createClient } from "@/lib/supabase-server";
import { getContextoOrg } from "@/lib/organizacion";
import { registrarAuditLog } from "@/lib/audit-log";
import type { DatosParaRips, FevRips } from "@/lib/types/rips";
import { construirFevRips } from "@/lib/construir-fev-rips";

// ==========================================
// MOTOR RIPS - RESOLUCIÓN 2275 (FEV-RIPS OFICIAL)
// ==========================================

/**
 * Genera el JSON FEV-RIPS (Res. 2275) para una factura aprobada.
 * Solo disponible para facturas NO borrador y NO anuladas.
 * Carga todos los datos desde la DB — no acepta input del cliente.
 */
export async function generarJsonRipsMVP(facturaId: string): Promise<FevRips> {
  const ctx = await getContextoOrg();
  const supabase = await createClient();

  // 1. Cargar factura con verificación de organización
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", facturaId)
    .eq("organizacion_id", ctx.orgId)
    .single();

  if (errFactura || !factura) {
    throw new Error("Factura no encontrada");
  }

  if (factura.estado === "borrador" || factura.estado === "anulada") {
    throw new Error("Solo se pueden generar RIPS para facturas aprobadas");
  }

  // 2. Obtener paciente
  const paciente = Array.isArray(factura.pacientes) ? factura.pacientes[0] : factura.pacientes;
  if (!paciente) {
    throw new Error("La factura no tiene paciente asociado");
  }

  // 3. Datos del prestador (profesional que atiende)
  let prestador = { nit: "0", cod: "0", tipoDoc: "CC" as string, numDoc: "0" };
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("numero_documento, codigo_habilitacion, tipo_documento")
    .eq("user_id", ctx.userId)
    .single();
  if (perfil) {
    prestador = {
      nit: perfil.numero_documento || "0",
      cod: perfil.codigo_habilitacion || "0",
      tipoDoc: perfil.tipo_documento || "CC",
      numDoc: perfil.numero_documento || "0",
    };
  }

  // 4. Construir DatosParaRips desde la factura en DB
  const metadata = (factura.metadata || {}) as Record<string, unknown>;
  const atencion = (factura.atencion || metadata.atencion || {}) as Record<string, unknown>;
  const codConsultaCups = (atencion.codConsultaCups as string) || "890201";

  // Tarifa personalizada
  let valorConsulta = (atencion.valor_consulta as number) || 0;
  const { data: servicioConfigurado } = await supabase
    .from("servicios_medico")
    .select("tarifa")
    .eq("user_id", ctx.userId)
    .eq("codigo_cups", codConsultaCups)
    .single();
  if (servicioConfigurado) {
    valorConsulta = servicioConfigurado.tarifa;
  }

  const datos: DatosParaRips = {
    numFactura: factura.num_factura,
    numObligacion: (metadata.numObligacion as string) || "",
    tipoDocumentoPaciente: (paciente.tipo_documento || "CC") as DatosParaRips["tipoDocumentoPaciente"],
    documentoPaciente: paciente.numero_documento || "",
    fechaNacimientoPaciente: paciente.fecha_nacimiento || "",
    sexoPaciente: (paciente.sexo || "M") as DatosParaRips["sexoPaciente"],
    tipoUsuarioPaciente: (paciente.tipo_usuario || "01") as DatosParaRips["tipoUsuarioPaciente"],
    codPaisResidencia: "170",
    codPaisOrigen: (metadata.codPaisOrigen as string) || "170",
    codMunicipioResidencia: paciente.municipio_residencia_codigo || "",
    codZonaTerritorialResidencia: ({ "U": "01", "R": "02", "01": "01", "02": "02" }[paciente.zona_territorial as string] || "01") as DatosParaRips["codZonaTerritorialResidencia"],
    incapacidad: ((metadata.incapacidad as string) || "NO") as DatosParaRips["incapacidad"],
    tipoDocumentoProfesional: (prestador.tipoDoc || "CC") as DatosParaRips["tipoDocumentoProfesional"],
    documentoProfesional: prestador.numDoc || "0",
    diagnosticos: factura.diagnosticos || [],
    procedimientos: factura.procedimientos || [],
    atencionIA: {
      modalidad: (atencion.modalidad as string) || "",
      causa: (atencion.causa as string) || "",
      finalidad: (atencion.finalidad as string) || "10",
      tipo_diagnostico: (atencion.tipo_diagnostico as string) || "",
      tipo_servicio: (atencion.tipo_servicio as string) || "consulta",
      valor_consulta: valorConsulta,
      valor_cuota: (atencion.valor_cuota as number) || 0,
      codConsultaCups,
    },
  };

  const result = construirFevRips(datos, prestador);

  registrarAuditLog({
    accion: "generar_rips",
    tabla: "facturas",
    registroId: facturaId,
    metadata: { num_factura: factura.num_factura },
  });

  return result;
}
