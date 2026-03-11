"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { devLog, devWarn } from "@/lib/logger";
import {
  validarYCorregirCups,
  validarYCorregirCie10,
  validarCoherenciaAnatomica,
  ordenarDiagnosticosPorRol,
  anonimizarTextoMedico,
} from "@/lib/validacion-medica";
import { buscarContextoRAG, formatearCandidatosParaPrompt, type TerminoProcedimiento } from "@/lib/rag-service";
import { getRagExtractorAI, getMedibillAI } from "@/lib/gemini";
import type { DiagnosticoIA, ProcedimientoIA } from "@/lib/types/validacion";

/**
 * Crea un cliente Supabase con service role (para uso desde webhook, sin cookies)
 */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ==========================================
// PIPELINE DE AUDIO — Telegram Bot
// ==========================================

/**
 * Transcribe audio y clasifica en un solo paso usando Gemini 2.5 Flash
 * con inlineData (audio multimodal).
 * El audio se procesa en memoria y NUNCA se persiste.
 */
export async function clasificarAudioTelegram(
  audioBuffer: Buffer,
  mimeType: string,
  telegramUserId: number
): Promise<{
  exito: boolean;
  datos?: {
    texto_transcrito: string;
    documento_paciente: string | null;
    nombre_paciente: string | null;
    diagnosticos: DiagnosticoIA[];
    procedimientos: ProcedimientoIA[];
    atencion: Record<string, unknown>;
  };
  error?: string;
}> {
  try {
    // 1. Transcribir + extraer datos del audio con Gemini
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY no configurada");

    const genAI = new GoogleGenerativeAI(apiKey);
    const transcriptionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const audioBase64 = audioBuffer.toString("base64");

    const transcriptionResult = await transcriptionModel.generateContent([
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
      {
        text: `Eres un asistente médico colombiano. Transcribe el audio médico y extrae la información estructurada.

INSTRUCCIONES:
1. Transcribe el audio completo al español
2. Si mencionan un número de cédula o documento del paciente, extráelo
3. Si mencionan el nombre del paciente, extráelo

Responde SIEMPRE en JSON con esta estructura exacta:
{
  "transcripcion": "texto completo transcrito",
  "documento_paciente": "número de cédula si lo mencionan, null si no",
  "nombre_paciente": "nombre si lo mencionan, null si no"
}`,
      },
    ]);

    const transcriptionResponse = await transcriptionResult.response;
    let transcriptionText = transcriptionResponse.text();

    // Limpiar posible markdown
    transcriptionText = transcriptionText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const transcripcion = JSON.parse(transcriptionText);
    const textoTranscrito = transcripcion.transcripcion || "";
    const documentoPaciente = transcripcion.documento_paciente || null;
    const nombrePaciente = transcripcion.nombre_paciente || null;

    if (!textoTranscrito || textoTranscrito.length < 10) {
      return { exito: false, error: "No pude entender el audio. Intentá con una nota más clara." };
    }

    devLog("Telegram:transcripción", `${textoTranscrito.substring(0, 100)}...`);

    // 2. Clasificar el texto transcrito con el pipeline estándar
    const textoParaIA = anonimizarTextoMedico(textoTranscrito, nombrePaciente || undefined, documentoPaciente || undefined);

    // RAG: extraer términos y buscar candidatos
    let promptAugmentado = textoParaIA;
    try {
      const extractResult = await getRagExtractorAI().generateContent(textoParaIA);
      const extractResponse = await extractResult.response;
      const terminos = JSON.parse(extractResponse.text());

      const terminosProcRaw: unknown[] = terminos.terminos_procedimientos || [];
      const terminosProc: TerminoProcedimiento[] = terminosProcRaw.map((t: unknown) => {
        if (typeof t === "string") {
          return { termino: t, categoria: "otro" as const, negado: false };
        }
        const obj = t as Record<string, unknown>;
        return {
          termino: String(obj.termino || ""),
          categoria: (obj.categoria as TerminoProcedimiento["categoria"]) || "otro",
          negado: Boolean(obj.negado),
          futuro: Boolean(obj.futuro),
        };
      });
      const terminosDx: string[] = terminos.terminos_diagnosticos || [];

      if (terminosProc.length > 0 || terminosDx.length > 0) {
        const contexto = await buscarContextoRAG(terminosProc, terminosDx);
        const candidatosTexto = formatearCandidatosParaPrompt(contexto);
        promptAugmentado = `NOTA CLÍNICA:\n${textoParaIA}\n\n${candidatosTexto}`;
      }
    } catch (ragError) {
      devWarn("Telegram RAG extraction failed", ragError);
    }

    // 3. Clasificar con Gemini (modelo medibillAI con schema)
    const classResult = await getMedibillAI().generateContent(promptAugmentado);
    const classResponse = await classResult.response;
    const datos = JSON.parse(classResponse.text());

    // 4. Validación y enriquecimiento (reusar pipeline existente)
    if (datos.procedimientos && datos.procedimientos.length > 0) {
      datos.procedimientos = datos.procedimientos.map((p: ProcedimientoIA) => ({
        ...p,
        descripcion_ia_original: p.descripcion,
      }));
      datos.procedimientos = await validarYCorregirCups(datos.procedimientos);
    }

    // Dedup consulta
    if (datos.procedimientos?.length > 0 && datos.atencion?.codConsultaCups) {
      const codConsulta = String(datos.atencion.codConsultaCups).replace(/[.\s-]/g, "");
      datos.procedimientos = datos.procedimientos.filter(
        (p: ProcedimientoIA) => String(p.codigo_cups).replace(/[.\s-]/g, "") !== codConsulta
      );
    }

    if (datos.procedimientos?.length > 0) {
      datos.procedimientos = await validarCoherenciaAnatomica(datos.procedimientos);
    }

    if (datos.diagnosticos?.length > 0) {
      datos.diagnosticos = await validarYCorregirCie10(datos.diagnosticos);
      datos.diagnosticos = ordenarDiagnosticosPorRol(datos.diagnosticos);
    }

    // Corregir diagnostico_asociado
    if (datos.procedimientos?.length > 0 && datos.diagnosticos?.length > 0) {
      const codigosDxValidos = new Set(
        datos.diagnosticos.map((d: DiagnosticoIA) =>
          String(d.codigo_cie10 || "").replace(/[.\s-]/g, "").toUpperCase()
        )
      );
      const dxPrincipalCodigo = datos.diagnosticos[0]?.codigo_cie10?.replace(/[.\s-]/g, "").toUpperCase() || "";

      datos.procedimientos = datos.procedimientos.map((proc: ProcedimientoIA) => {
        const dxAsoc = String(proc.diagnostico_asociado || "").replace(/[.\s-]/g, "").toUpperCase();
        if (dxAsoc && !codigosDxValidos.has(dxAsoc)) {
          return { ...proc, diagnostico_asociado: dxPrincipalCodigo };
        }
        return proc;
      });
    }

    if (datos.atencion && !datos.atencion.tipo_servicio) {
      datos.atencion.tipo_servicio = "consulta";
    }

    return {
      exito: true,
      datos: {
        texto_transcrito: textoTranscrito,
        documento_paciente: documentoPaciente,
        nombre_paciente: nombrePaciente,
        diagnosticos: datos.diagnosticos || [],
        procedimientos: datos.procedimientos || [],
        atencion: datos.atencion || {},
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    devLog("Error en clasificarAudioTelegram", msg);
    return { exito: false, error: "Error procesando el audio. Intentá de nuevo." };
  }
}

/**
 * Busca un paciente por documento cuando el doctor está vinculado.
 */
export async function buscarPacienteTelegram(
  userId: string,
  documento: string
): Promise<{ encontrado: boolean; datos?: Record<string, unknown> }> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("pacientes")
    .select("*")
    .eq("user_id", userId)
    .eq("numero_documento", documento)
    .single();

  if (!data) return { encontrado: false };

  return {
    encontrado: true,
    datos: {
      id: data.id,
      nombre_completo: `${data.primer_nombre || ""} ${data.segundo_nombre || ""} ${data.primer_apellido || ""} ${data.segundo_apellido || ""}`.trim(),
      tipo_documento: data.tipo_documento,
      numero_documento: data.numero_documento,
      fecha_nacimiento: data.fecha_nacimiento,
      sexo: data.sexo,
      eps_codigo: data.eps_codigo,
      eps_nombre: data.eps_nombre,
    },
  };
}

/**
 * Guarda una clasificación pendiente para deep link "Crear factura".
 * TTL: 1 hora.
 */
export async function guardarClasificacionPendiente(params: {
  userId: string | null;
  telegramUserId: number;
  resultadoJson: Record<string, unknown>;
  textoTranscrito: string;
  documentoPaciente: string | null;
  pacienteEncontrado: boolean;
  datosPaciente: Record<string, unknown> | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const token = crypto.randomUUID();
  const expiraAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await supabase.from("clasificaciones_pendientes").insert({
    token,
    user_id: params.userId,
    telegram_user_id: params.telegramUserId,
    resultado_json: params.resultadoJson,
    texto_transcrito: params.textoTranscrito,
    documento_paciente: params.documentoPaciente,
    paciente_encontrado: params.pacienteEncontrado,
    datos_paciente: params.datosPaciente,
    expira_at: expiraAt.toISOString(),
  });

  return token;
}
