"use server";

import { medibillAI } from "../lib/gemini";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
// 1. Traemos a tu "guardián" que lee las cookies
import { createClient } from "../lib/supabase-server";

// 2. Añadimos los parámetros opcionales para el paciente
export async function clasificarTextoMedico(
  texto: string,
  nombrePaciente?: string,
  documentoPaciente?: string
) {
  try {
    // 3. Validamos la entrada
    if (!texto || texto.trim() === "") {
      return { exito: false, error: "El texto médico está vacío." };
    }

    // 4. Enviamos el texto a Gemini
    const result = await medibillAI.generateContent(texto);
    const response = await result.response;
    const text = response.text();

    const jsonData = JSON.parse(text);

    // 5. Invocamos a Supabase de forma segura y preguntamos: ¿Quién está logueado?
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ No hay un usuario autenticado o la sesión expiró.");
      return { exito: false, error: "Debes iniciar sesión para guardar auditorías." };
    }

    // 6. GUARDAMOS EN SUPABASE (Conectado a la cuenta del médico y al paciente)
    const { error: dbError } = await supabase
      .from("auditorias_rips")
      .insert([
        {
          nota_original: texto,
          resultado_ia: jsonData,
          user_id: user.id, // ID del médico
          nombre_paciente: nombrePaciente || null, // Guardamos el nombre
          documento_paciente: documentoPaciente || null // Guardamos la cédula
        }
      ]);

    if (dbError) {
      console.error("❌ Error guardando en Supabase:", dbError.message);
    } else {
      console.log(`✅ Auditoría guardada exitosamente en BD para el usuario: ${user.email}`);
    }

    // 7. Retornamos los datos al frontend
    return { exito: true, datos: jsonData };
    
  } catch (error) {
    console.error("❌ Error en la función:", error);
    return { exito: false, error: "Ocurrió un error al procesar el texto con la IA." };
  }
}

export async function obtenerHistorialAuditorias() {
  // 1. Asegura que la consulta no se guarde en caché (datos siempre frescos)
  noStore(); 
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // 2. Aquí usamos la función que tenías declarada: 
  // Esto le dice a Next.js que la página principal tiene datos nuevos
  revalidatePath("/"); 

  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .order("creado_en", { ascending: false }) 
    .limit(5);

  if (error) {
    console.error("Error cargando historial:", error);
    return [];
  }

  return data;
}

export async function buscarPacientePorCedula(cedula: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !cedula) return null;

  // Buscamos todas las auditorías de esa cédula para este médico
  const { data, error } = await supabase
    .from("auditorias_rips")
    .select("*")
    .eq("user_id", user.id)
    .eq("documento_paciente", cedula)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error buscando paciente:", error);
    return null;
  }

  // Si encontramos datos, devolvemos el nombre del último registro y todo su historial
  if (data && data.length > 0) {
    return {
      nombre: data[0].nombre_paciente, // El nombre más reciente guardado
      historial: data // Todas sus consultas pasadas
    };
  }

  return null; // Paciente nuevo
}

// ==========================================
// NUEVO MOTOR RIPS - RESOLUCIÓN 2275
// ==========================================

interface DatosAuditoriaRips {
  documentoPaciente: string;
  diagnosticos: any[];
  procedimientos: any[];
}

export async function generarJsonRipsMVP(datos: DatosAuditoriaRips) {
  const fechaHoy = new Date().toISOString().slice(0, 16).replace('T', ' '); 
  
  // Validamos que haya un documento, si no, usamos un genérico
  const idPaciente = datos.documentoPaciente?.trim() || "000000000";
  const diagPrincipal = datos.diagnosticos[0]?.codigo_cie10 || "Z000";

  // 1. Mapear todos los procedimientos dinámicamente
  const procedimientosRips = datos.procedimientos.map((proc) => ({
    codigoPrestador: "520010000101", // Código simulado Nariño
    fechaInicioAtencion: fechaHoy,
    idMIPRES: null,
    numAutorizacion: null,
    codigoProcedimiento: proc.codigo_cups, // Ej: 87.41.01 (El TAC)
    viaIngresoServicioSalud: "02", // Consulta Externa
    modalidadAtencion: "01", 
    grupoServicios: "01", 
    codigoServicio: 100, 
    finalidadAtencion: "10", 
    tipoDocumentoIdentificacion: "CC",
    numDocumentoIdentificacion: idPaciente,
    codigoDiagnosticoPrincipal: diagPrincipal,
    codigoDiagnosticoRelacionado: null,
    codigoComplicacion: null,
    valorProcedimiento: 0,
    valorCuotaModeradora: 0,
    valorNetoPagar: 0
  }));

  const rips = {
    prestador: {
      tipoDocumentoIdentificacion: "CC",
      numDocumentoIdentificacion: "1085222333", // Médico (sigue fijo por ahora)
      codigoHabilitacion: "520010000101" 
    },
    usuarios: [
      {
        tipoDocumentoIdentificacion: "CC",
        numDocumentoIdentificacion: idPaciente, // 🟢 DINÁMICO: Cédula real
        tipoUsuario: "01", 
        fechaNacimiento: "1990-05-15", // Fijo MVP
        sexoBiologico: "M" // Fijo MVP
      }
    ],
    consultas: [
      {
        codigoPrestador: "520010000101",
        fechaInicioAtencion: fechaHoy,
        codigoConsulta: "890201", // Código general de "Consulta Médica"
        modalidadAtencion: "01", 
        grupoServicios: "01", 
        codigoServicio: 100, 
        finalidadAtencion: "10", 
        causaMotivoAtencion: "15", 
        codigoDiagnosticoPrincipal: diagPrincipal, // 🟢 DINÁMICO
        codigoDiagnosticoRelacionado1: datos.diagnosticos[1]?.codigo_cie10 || null, // 🟢 DINÁMICO
        codigoDiagnosticoRelacionado2: datos.diagnosticos[2]?.codigo_cie10 || null, // 🟢 DINÁMICO
        tipoDiagnosticoPrincipal: "01", 
        valorConsulta: 50000,      
        valorCuotaModeradora: 0,
        valorNetoPagar: 50000
      }
    ],
    // 🟢 DINÁMICO: Array completo de procedimientos, solo lo incluimos si existen
    procedimientos: procedimientosRips.length > 0 ? procedimientosRips : undefined 
  };

  return rips;
}