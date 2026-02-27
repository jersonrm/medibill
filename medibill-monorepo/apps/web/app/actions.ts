"use server";

import { medibillAI } from "../lib/gemini";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "../lib/supabase-server";

// ==========================================
// FUNCIÓN DE SEGURIDAD: HABEAS DATA (LEY 1581)
// ==========================================
function anonimizarTextoMedico(texto: string, nombre?: string, documento?: string): string {
  let textoSeguro = texto;

  if (documento && documento.trim() !== "") {
    const regexDoc = new RegExp(documento.trim(), 'gi');
    textoSeguro = textoSeguro.replace(regexDoc, '[DOCUMENTO_PACIENTE]');
  }

  if (nombre && nombre.trim() !== "") {
    const nombreLimpio = nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexNombre = new RegExp(nombreLimpio, 'gi');
    textoSeguro = textoSeguro.replace(regexNombre, '[NOMBRE_PACIENTE]');
  }

  return textoSeguro;
}

// ==========================================
// PROCESAMIENTO CON INTELIGENCIA ARTIFICIAL
// ==========================================
export async function clasificarTextoMedico(texto: string, nombrePaciente?: string, documentoPaciente?: string) {
  try {
    const supabase = await createClient();
    
    // 1. Obtener las tarifas personalizadas del usuario
    const { data: misTarifas } = await supabase
      .from('servicios_medico')
      .select('codigo_cups, tarifa');

    const textoParaIA = anonimizarTextoMedico(texto, nombrePaciente, documentoPaciente);

    // 2. Llamamos a la IA (Pasamos las tarifas como contexto opcional en el prompt si quieres, 
    // pero es más seguro aplicarlas después del análisis para que sean exactas)
    const result = await medibillAI.generateContent(textoParaIA);
    const response = await result.response;
    const datos = JSON.parse(response.text());

    // 3. CRUCE DE DATOS: Si el CUPS analizado está en mis tarifas, sobreescribir el valor
    if (datos.atencion && misTarifas) {
      // Por defecto la IA clasifica la consulta como 890201
      const miTarifaConsulta = misTarifas.find(t => t.codigo_cups === "890201");
      if (miTarifaConsulta) {
        datos.atencion.valor_consulta = miTarifaConsulta.tarifa;
      }
    }

    // También para procedimientos extra si los hubiera con precio
    if (datos.procedimientos && misTarifas) {
      datos.procedimientos = datos.procedimientos.map((proc: any) => {
        const coincidencia = misTarifas.find(t => t.codigo_cups === proc.codigo_cups);
        return coincidencia ? { ...proc, valor_procedimiento: coincidencia.tarifa } : proc;
      });
    }

    // 4. Guardar en el historial (Auditoría)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("auditorias").insert({
        usuario_id: user.id,
        nombre_paciente: nombrePaciente || "Paciente Anónimo",
        documento_paciente: documentoPaciente || "Sin Documento",
        nota_original: texto,
        resultado_ia: datos,
      });
    }

    return { exito: true, datos };
  } catch (error) {
    console.error("Error en la función clasificarTextoMedico:", error);
    return { exito: false, error: "Error al procesar la información médica." };
  }
}

export async function obtenerHistorialAuditorias() {
  noStore(); 
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  revalidatePath("/"); 

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .order("creado_en", { ascending: false }) 
    .limit(5);

  if (error) return [];
  return data;
}

export async function buscarPacientePorCedula(cedula: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !cedula) return null;

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .eq("documento_paciente", cedula)
    .order("creado_en", { ascending: false });

  if (error) return null;

  if (data && data.length > 0) {
    return {
      nombre: data[0].nombre_paciente, 
      historial: data 
    };
  }

  return null; 
}

// ==========================================
// MOTOR RIPS - RESOLUCIÓN 2275 (LIQUIDACIÓN REAL)
// ==========================================

interface DatosAuditoriaRips {
  tipoDocumentoPaciente: string;
  documentoPaciente: string;
  fechaNacimientoPaciente: string;
  sexoPaciente: string;
  tipoUsuarioPaciente: string;
  diagnosticos: any[];
  procedimientos: any[];
  // 🟢 Recibimos la liquidación sugerida por la IA
  atencionIA: {
    modalidad: string;
    causa: string;
    finalidad: string;
    tipo_diagnostico: string;
    valor_consulta: number;
    valor_cuota: number;
  };
}

export async function generarJsonRipsMVP(datos: DatosAuditoriaRips) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let perfitDoc = { tipo: "CC", num: "0", cod: "0" };

  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("tipo_documento, numero_documento, codigo_habilitacion")
      .eq("id", user.id)
      .single();
    if (perfil) {
      perfitDoc = { 
        tipo: perfil.tipo_documento || "CC", 
        num: perfil.numero_documento, 
        cod: perfil.codigo_habilitacion 
      };
    }
  }

  const fechaHoy = new Date().toISOString().slice(0, 16).replace('T', ' '); 
  const diagPrincipal = datos.diagnosticos[0]?.codigo_cie10 || "Z000";

  // 🟢 LÓGICA DE PRECIOS PERSONALIZADOS
  let valorFinalConsulta = datos.atencionIA.valor_consulta;
  
  if (user) {
    // Buscamos si el médico configuró un precio específico para consulta (890201)
    const { data: servicioConfigurado } = await supabase
      .from("servicios_medico")
      .select("valor_base")
      .eq("user_id", user.id)
      .eq("codigo_cups", "890201")
      .single();

    if (servicioConfigurado) {
      valorFinalConsulta = servicioConfigurado.valor_base;
    }
  }

  const procedimientosRips = datos.procedimientos.map((proc) => ({
    codigoPrestador: perfitDoc.cod,
    fechaInicioAtencion: fechaHoy,
    idMIPRES: null,
    numAutorizacion: null,
    codigoProcedimiento: proc.codigo_cups, 
    viaIngresoServicioSalud: "02", 
    modalidadAtencion: datos.atencionIA.modalidad, // 🟢 Dinámico desde IA
    grupoServicios: "01", 
    codigoServicio: 100, 
    finalidadAtencion: datos.atencionIA.finalidad, // 🟢 Dinámico desde IA
    tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente, 
    numDocumentoIdentificacion: datos.documentoPaciente, 
    codigoDiagnosticoPrincipal: diagPrincipal,
    codigoDiagnosticoRelacionado: null,
    codigoComplicacion: null,
    valorProcedimiento: 0,
    valorCuotaModeradora: 0,
    valorNetoPagar: 0
  }));

  const rips = {
    prestador: {
      tipoDocumentoIdentificacion: perfitDoc.tipo, 
      numDocumentoIdentificacion: perfitDoc.num, 
      codigoHabilitacion: perfitDoc.cod 
    },
    usuarios: [
      {
        tipoDocumentoIdentificacion: datos.tipoDocumentoPaciente, 
        numDocumentoIdentificacion: datos.documentoPaciente, 
        tipoUsuario: datos.tipoUsuarioPaciente, 
        fechaNacimiento: datos.fechaNacimientoPaciente, 
        sexoBiologico: datos.sexoPaciente 
      }
    ],
    consultas: [
      {
        codigoPrestador: perfitDoc.cod, 
        fechaInicioAtencion: fechaHoy,
        codigoConsulta: "890201", 
        modalidadAtencion: datos.atencionIA.modalidad, // 🟢 Dinámico
        grupoServicios: "01", 
        codigoServicio: 100, 
        finalidadAtencion: datos.atencionIA.finalidad, // 🟢 Dinámico
        causaMotivoAtencion: datos.atencionIA.causa, // 🟢 Dinámico
        codigoDiagnosticoPrincipal: diagPrincipal, 
        codigoDiagnosticoRelacionado1: datos.diagnosticos[1]?.codigo_cie10 || null, 
        codigoDiagnosticoRelacionado2: datos.diagnosticos[2]?.codigo_cie10 || null, 
        tipoDiagnosticoPrincipal: datos.atencionIA.tipo_diagnostico, // 🟢 Dinámico
        valorConsulta: valorFinalConsulta, // 🟢 Dinámico (DB o IA)
        valorCuotaModeradora: datos.atencionIA.valor_cuota,
        valorNetoPagar: valorFinalConsulta - datos.atencionIA.valor_cuota
      }
    ],
    procedimientos: procedimientosRips.length > 0 ? procedimientosRips : undefined 
  };

  return rips;
}

// 🟢 NUEVAS FUNCIONES PARA TARIFAS PERSONALIZADAS

export async function guardarTarifaUsuario(codigo: string, descripcion: string, valor: number) {
  const supabase = await createClient(); // ✅ AWAIT AGREGADO
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { exito: false, error: "Usuario no autenticado" };

  const { error } = await supabase
    .from('servicios_medico')
    .insert({
      usuario_id: user.id,
      codigo_cups: codigo,
      descripcion: descripcion,
      tarifa: valor
    });

  if (error) {
    console.error("Error guardando tarifa:", error);
    return { exito: false, error: error.message };
  }
  return { exito: true };
}

export async function obtenerTarifasUsuario() {
  const supabase = await createClient(); // ✅ AWAIT AGREGADO
  
  const { data, error } = await supabase
    .from('servicios_medico')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error("Error obteniendo tarifas:", error);
    return [];
  }
  return data;
}

export async function eliminarTarifaUsuario(id: string) {
  const supabase = await createClient(); // ✅ AWAIT AGREGADO
  const { error } = await supabase
    .from('servicios_medico')
    .delete()
    .eq('id', id);

  if (error) return { exito: false, error: error.message };
  return { exito: true };
}