import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  enviarMensaje,
  enviarMensajeConBotones,
  enviarAccionEscribiendo,
  obtenerArchivo,
  descargarArchivo,
  MAX_AUDIO_SIZE,
  MAX_AUDIO_DURATION,
  type TelegramUpdate,
} from "@/lib/telegram";
import {
  clasificarAudioTelegram,
  buscarPacienteTelegram,
  guardarClasificacionPendiente,
} from "@/app/actions/telegram-clasificacion";
import { devLog, devWarn } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://medibill-wheat.vercel.app";

// Rate limit: 5 req/min por telegram_user_id
const rateLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });

/** Crea cliente Supabase con service role (sin cookies, para webhook) */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ==========================================
// TELEGRAM WEBHOOK
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Validar que el bot token coincida (token secreto en la URL)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Bot no configurado" }, { status: 500 });
    }

    // Procesar callback_query (botones inline)
    if (update.callback_query) {
      // Acknowledgar callback para quitar el loading
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramUserId = message.from.id;
    const telegramUsername = message.from.username || null;
    const text = message.text?.trim() || "";

    // Rate limit
    if (await rateLimiter.isLimited(`tg:${telegramUserId}`)) {
      await enviarMensaje(chatId, "⏳ Estás enviando mensajes muy rápido. Esperá un momento.");
      return NextResponse.json({ ok: true });
    }

    // ── Router de comandos ──
    if (text === "/start") {
      return await handleStart(chatId, telegramUserId);
    }

    // Crear cliente Supabase solo cuando se necesite (lazy)
    const supabase = createServiceClient();

    if (text.startsWith("/vincular")) {
      return await handleVincular(chatId, telegramUserId, telegramUsername, text, supabase);
    }

    if (text === "/desvincular") {
      return await handleDesvincular(chatId, telegramUserId, supabase);
    }

    if (text === "/estado") {
      return await handleEstado(chatId, telegramUserId, supabase);
    }

    // ── Audio: clasificar nota clínica ──
    const audioMsg = message.voice || message.audio;
    if (audioMsg) {
      return await handleAudio(chatId, telegramUserId, telegramUsername, audioMsg, supabase);
    }

    // ── Texto: podría ser cédula para clasificación pendiente ──
    if (/^\d{5,15}$/.test(text)) {
      return await handleCedula(chatId, telegramUserId, text, supabase);
    }

    // ── Texto no reconocido ──
    await enviarMensaje(
      chatId,
      "🤖 Enviame una <b>nota de voz</b> con la nota clínica y te la clasifico.\n\nComandos:\n/start — Bienvenida\n/vincular MDB-XXXX — Vincular tu cuenta\n/desvincular — Desvincular cuenta\n/estado — Ver estado de vinculación"
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true }); // Siempre 200 a Telegram
  }
}

// ==========================================
// HANDLERS
// ==========================================

async function handleStart(chatId: number, _telegramUserId: number) {
  await enviarMensajeConBotones(
    chatId,
    `🏥 <b>¡Hola! Soy el Bot de Medibill</b>\n\nClasificá tus notas clínicas por audio. Enviame una <b>nota de voz</b> y te devuelvo los códigos CUPS y CIE-10 en segundos.\n\n<b>3 clasificaciones gratis</b> sin necesidad de cuenta.\n\nPara vincular tu cuenta Medibill y acceder ilimitadamente:\n1. Andá a Configuración → Telegram en la web\n2. Copiá el código MDB-XXXX\n3. Enviame <code>/vincular MDB-XXXX</code>`,
    [
      [{ text: "🌐 Ir a Medibill", url: APP_URL }],
      [{ text: "📖 ¿Cómo funciona?", callback_data: "help" }],
    ]
  );
  return NextResponse.json({ ok: true });
}

async function handleVincular(
  chatId: number,
  telegramUserId: number,
  telegramUsername: string | null,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const parts = text.split(" ");
  const codigo = parts[1]?.trim();

  if (!codigo || !codigo.startsWith("MDB-")) {
    await enviarMensaje(chatId, "❌ Formato incorrecto. Usá: <code>/vincular MDB-XXXX</code>\n\nObtené tu código en Configuración → Telegram en la web.");
    return NextResponse.json({ ok: true });
  }

  // Buscar código de vinculación válido
  const { data: codigoRow } = await supabase
    .from("telegram_codigos_vinculacion")
    .select("user_id, expira_at, usado")
    .eq("codigo", codigo)
    .single();

  if (!codigoRow) {
    await enviarMensaje(chatId, "❌ Código no encontrado. Generá uno nuevo en la web.");
    return NextResponse.json({ ok: true });
  }

  if (codigoRow.usado) {
    await enviarMensaje(chatId, "❌ Este código ya fue usado. Generá uno nuevo en la web.");
    return NextResponse.json({ ok: true });
  }

  if (new Date(codigoRow.expira_at) < new Date()) {
    await enviarMensaje(chatId, "❌ Este código expiró. Generá uno nuevo en la web.");
    return NextResponse.json({ ok: true });
  }

  // Verificar si ya existe vinculación para este telegram_user_id
  const { data: existente } = await supabase
    .from("telegram_vinculaciones")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (existente) {
    // Actualizar vinculación existente
    await supabase
      .from("telegram_vinculaciones")
      .update({
        user_id: codigoRow.user_id,
        telegram_username: telegramUsername,
        activo: true,
      })
      .eq("telegram_user_id", telegramUserId);
  } else {
    await supabase.from("telegram_vinculaciones").insert({
      telegram_user_id: telegramUserId,
      user_id: codigoRow.user_id,
      telegram_username: telegramUsername,
      activo: true,
    });
  }

  // Marcar código como usado
  await supabase
    .from("telegram_codigos_vinculacion")
    .update({ usado: true })
    .eq("codigo", codigo);

  await enviarMensaje(chatId, "✅ <b>¡Cuenta vinculada!</b>\n\nAhora podés clasificar notas clínicas desde acá y crear facturas directamente.");
  return NextResponse.json({ ok: true });
}

async function handleDesvincular(
  chatId: number,
  telegramUserId: number,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data } = await supabase
    .from("telegram_vinculaciones")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .eq("activo", true)
    .single();

  if (!data) {
    await enviarMensaje(chatId, "ℹ️ No tenés ninguna cuenta vinculada.");
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from("telegram_vinculaciones")
    .update({ activo: false })
    .eq("telegram_user_id", telegramUserId);

  await enviarMensaje(chatId, "✅ Cuenta desvinculada. Podés volver a vincular cuando quieras.");
  return NextResponse.json({ ok: true });
}

async function handleEstado(
  chatId: number,
  telegramUserId: number,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: vinculacion } = await supabase
    .from("telegram_vinculaciones")
    .select("user_id, telegram_username, activo, created_at")
    .eq("telegram_user_id", telegramUserId)
    .eq("activo", true)
    .single();

  if (!vinculacion) {
    // Mostrar uso anónimo
    const { data: usoAnon } = await supabase
      .from("telegram_uso_anonimo")
      .select("clasificaciones_usadas")
      .eq("telegram_user_id", telegramUserId)
      .single();

    const usadas = usoAnon?.clasificaciones_usadas || 0;
    const restantes = Math.max(0, 3 - usadas);

    await enviarMensaje(
      chatId,
      `ℹ️ <b>Sin cuenta vinculada</b>\n\n🎁 Clasificaciones gratis: <b>${restantes}/3</b>\n\nVinculá tu cuenta para acceso completo.`
    );
    return NextResponse.json({ ok: true });
  }

  // Obtener info del plan
  const { data: membership } = await supabase
    .from("usuarios_organizacion")
    .select("organizacion_id, rol")
    .eq("user_id", vinculacion.user_id)
    .eq("activo", true)
    .single();

  let planInfo = "Sin plan activo";
  if (membership) {
    const { data: sub } = await supabase
      .from("suscripciones")
      .select("estado, plan:planes!inner(nombre, bot_telegram)")
      .eq("organizacion_id", membership.organizacion_id)
      .single();

    if (sub) {
      const plan = sub.plan as unknown as { nombre: string; bot_telegram: boolean };
      planInfo = `${plan.nombre} (${sub.estado})${plan.bot_telegram ? " — Bot ✅" : " — Bot ❌"}`;
    }
  }

  await enviarMensaje(
    chatId,
    `✅ <b>Cuenta vinculada</b>\n\n👤 @${vinculacion.telegram_username || "sin username"}\n📋 Plan: ${planInfo}\n📅 Vinculado: ${new Date(vinculacion.created_at).toLocaleDateString("es-CO")}`
  );
  return NextResponse.json({ ok: true });
}

async function handleAudio(
  chatId: number,
  telegramUserId: number,
  telegramUsername: string | null,
  audioMsg: { duration: number; mime_type: string; file_id: string; file_size: number },
  supabase: ReturnType<typeof createServiceClient>
) {
  // Validar duración
  if (audioMsg.duration > MAX_AUDIO_DURATION) {
    await enviarMensaje(chatId, `❌ El audio es demasiado largo (${Math.round(audioMsg.duration / 60)} min). Máximo 5 minutos.`);
    return NextResponse.json({ ok: true });
  }

  // Validar tamaño
  if (audioMsg.file_size > MAX_AUDIO_SIZE) {
    await enviarMensaje(chatId, "❌ El archivo es demasiado grande. Máximo 5 MB.");
    return NextResponse.json({ ok: true });
  }

  // Verificar acceso: vinculado vs anónimo
  const { data: vinculacion } = await supabase
    .from("telegram_vinculaciones")
    .select("user_id")
    .eq("telegram_user_id", telegramUserId)
    .eq("activo", true)
    .single();

  if (vinculacion) {
    // ── USUARIO VINCULADO ──
    // Verificar feature bot_telegram
    const { data: membership } = await supabase
      .from("usuarios_organizacion")
      .select("organizacion_id")
      .eq("user_id", vinculacion.user_id)
      .eq("activo", true)
      .single();

    if (!membership) {
      await enviarMensaje(chatId, "❌ Tu cuenta no tiene una organización activa.");
      return NextResponse.json({ ok: true });
    }

    const { data: sub } = await supabase
      .from("suscripciones")
      .select("estado, plan:planes!inner(bot_telegram, nombre)")
      .eq("organizacion_id", membership.organizacion_id)
      .single();

    if (!sub || !["active", "trialing"].includes(sub.estado)) {
      await enviarMensaje(chatId, "⚠️ Tu suscripción no está activa. Renová tu plan en la web.");
      return NextResponse.json({ ok: true });
    }

    const plan = sub.plan as unknown as { bot_telegram: boolean; nombre: string };
    if (!plan.bot_telegram) {
      await enviarMensajeConBotones(
        chatId,
        `⚠️ Tu plan <b>${plan.nombre}</b> no incluye el Bot de Telegram.\n\nActualizá a <b>Profesional</b> o superior para clasificar por audio.`,
        [[{ text: "⬆️ Actualizar Plan", url: `${APP_URL}/configuracion/suscripcion` }]]
      );
      return NextResponse.json({ ok: true });
    }

    // Verificar límite mensual de clasificaciones
    const periodo = new Date().toISOString().slice(0, 7);
    const { data: planLimits } = await supabase
      .from("planes")
      .select("max_clasificaciones")
      .eq("id", (sub.plan as unknown as { id: string }).id || "")
      .single();

    // Si tiene límite, verificar uso
    if (planLimits?.max_clasificaciones) {
      const { data: uso } = await supabase
        .from("uso_mensual")
        .select("clasificaciones_ia")
        .eq("organizacion_id", membership.organizacion_id)
        .eq("periodo", periodo)
        .single();

      if ((uso?.clasificaciones_ia || 0) >= planLimits.max_clasificaciones) {
        await enviarMensaje(
          chatId,
          `⚠️ Has alcanzado el límite de ${planLimits.max_clasificaciones} clasificaciones de tu plan ${plan.nombre} este mes.`
        );
        return NextResponse.json({ ok: true });
      }
    }

    // ── Procesar audio ──
    await enviarAccionEscribiendo(chatId);

    const fileInfo = await obtenerArchivo(audioMsg.file_id);
    const audioBuffer = await descargarArchivo(fileInfo.file_path);

    const resultado = await clasificarAudioTelegram(audioBuffer, audioMsg.mime_type, telegramUserId);

    if (!resultado.exito || !resultado.datos) {
      await enviarMensaje(chatId, `❌ ${resultado.error || "No pude clasificar. Intentá con una nota más clara."}`);
      return NextResponse.json({ ok: true });
    }

    // Incrementar uso
    await supabase.rpc("incrementar_uso_mensual", {
      p_org_id: membership.organizacion_id,
      p_periodo: periodo,
      p_campo: "clasificaciones_ia",
    });

    // Buscar paciente si hay documento
    let pacienteInfo = null;
    if (resultado.datos.documento_paciente) {
      const paciente = await buscarPacienteTelegram(vinculacion.user_id, resultado.datos.documento_paciente);
      if (paciente.encontrado) {
        pacienteInfo = paciente.datos;
      }
    }

    // Guardar clasificación pendiente para deep link
    const token = await guardarClasificacionPendiente({
      userId: vinculacion.user_id,
      telegramUserId,
      resultadoJson: resultado.datos as unknown as Record<string, unknown>,
      textoTranscrito: resultado.datos.texto_transcrito,
      documentoPaciente: resultado.datos.documento_paciente,
      pacienteEncontrado: !!pacienteInfo,
      datosPaciente: pacienteInfo as Record<string, unknown> | null,
    });

    // Formatear respuesta
    const respuesta = formatearRespuestaClasificacion(resultado.datos, pacienteInfo ?? null, token);
    await enviarMensajeConBotones(chatId, respuesta.texto, respuesta.botones);

    return NextResponse.json({ ok: true });
  } else {
    // ── USUARIO ANÓNIMO ──
    return await handleAudioAnonimo(chatId, telegramUserId, audioMsg, supabase);
  }
}

async function handleAudioAnonimo(
  chatId: number,
  telegramUserId: number,
  audioMsg: { duration: number; mime_type: string; file_id: string; file_size: number },
  supabase: ReturnType<typeof createServiceClient>
) {
  // Verificar cuota anónima (3 gratis)
  const { data: usoAnon } = await supabase
    .from("telegram_uso_anonimo")
    .select("clasificaciones_usadas")
    .eq("telegram_user_id", telegramUserId)
    .single();

  const usadas = usoAnon?.clasificaciones_usadas || 0;

  if (usadas >= 3) {
    await enviarMensajeConBotones(
      chatId,
      "🔒 Ya usaste tus <b>3 clasificaciones gratis</b>.\n\nRegistrate en Medibill para acceder a clasificaciones ilimitadas por audio.",
      [
        [{ text: "🚀 Registrarme en Medibill", url: `${APP_URL}/login` }],
      ]
    );
    return NextResponse.json({ ok: true });
  }

  // Procesar audio
  await enviarAccionEscribiendo(chatId);

  const fileInfo = await obtenerArchivo(audioMsg.file_id);
  const audioBuffer = await descargarArchivo(fileInfo.file_path);

  const resultado = await clasificarAudioTelegram(audioBuffer, audioMsg.mime_type, telegramUserId);

  if (!resultado.exito || !resultado.datos) {
    await enviarMensaje(chatId, `❌ ${resultado.error || "No pude clasificar. Intentá con nota más clara."}`);
    return NextResponse.json({ ok: true });
  }

  // Incrementar uso anónimo
  if (usoAnon) {
    await supabase
      .from("telegram_uso_anonimo")
      .update({ clasificaciones_usadas: usadas + 1 })
      .eq("telegram_user_id", telegramUserId);
  } else {
    await supabase.from("telegram_uso_anonimo").insert({
      telegram_user_id: telegramUserId,
      clasificaciones_usadas: 1,
    });
  }

  const nuevasUsadas = usadas + 1;
  const restantes = 3 - nuevasUsadas;

  // Formatear respuesta (sin paciente, sin deep link)
  const dxPrincipal = resultado.datos.diagnosticos?.find((d) => d.rol === "principal");
  const procs = resultado.datos.procedimientos || [];

  let texto = "📋 <b>Clasificación</b>\n\n";

  if (dxPrincipal) {
    texto += `🔴 <b>Dx principal:</b> ${dxPrincipal.codigo_cie10} — ${dxPrincipal.descripcion}\n`;
  }

  resultado.datos.diagnosticos?.filter(d => d.rol !== "principal").forEach(d => {
    texto += `🟡 <b>Dx:</b> ${d.codigo_cie10} — ${d.descripcion}\n`;
  });

  if (procs.length > 0) {
    texto += "\n🏥 <b>Procedimientos:</b>\n";
    procs.forEach(p => {
      texto += `  • ${p.codigo_cups} — ${p.descripcion}\n`;
    });
  }

  const attn = resultado.datos.atencion as Record<string, unknown>;
  if (attn?.codConsultaCups) {
    texto += `\n💊 <b>Consulta:</b> ${attn.codConsultaCups}`;
  }

  // CTA según restantes
  if (nuevasUsadas === 3) {
    texto += "\n\n⚠️ <b>Esta fue tu última clasificación gratis.</b>";
  } else {
    texto += `\n\n💡 ${restantes}/3 clasificaciones gratis restantes`;
  }

  const botones: { text: string; url?: string; callback_data?: string }[][] = [
    [{ text: "🚀 Registrarme en Medibill", url: `${APP_URL}/login` }],
  ];

  await enviarMensajeConBotones(chatId, texto, botones);
  return NextResponse.json({ ok: true });
}

async function handleCedula(
  chatId: number,
  telegramUserId: number,
  cedula: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  // Buscar si hay clasificación pendiente esperando cédula para este usuario
  const { data: vinculacion } = await supabase
    .from("telegram_vinculaciones")
    .select("user_id")
    .eq("telegram_user_id", telegramUserId)
    .eq("activo", true)
    .single();

  if (!vinculacion) {
    await enviarMensaje(chatId, "ℹ️ Para buscar pacientes, primero vinculá tu cuenta con /vincular.");
    return NextResponse.json({ ok: true });
  }

  // Buscar clasificación pendiente más reciente sin documento
  const { data: pendiente } = await supabase
    .from("clasificaciones_pendientes")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .is("documento_paciente", null)
    .gt("expira_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!pendiente) {
    await enviarMensaje(chatId, "ℹ️ No hay clasificaciones pendientes. Enviá primero una nota de voz.");
    return NextResponse.json({ ok: true });
  }

  // Buscar paciente
  const paciente = await buscarPacienteTelegram(vinculacion.user_id, cedula);

  // Actualizar clasificación pendiente con la cédula
  await supabase
    .from("clasificaciones_pendientes")
    .update({
      documento_paciente: cedula,
      paciente_encontrado: paciente.encontrado,
      datos_paciente: paciente.datos || null,
    })
    .eq("id", pendiente.id);

  const resultadoJson = pendiente.resultado_json as Record<string, unknown>;

  if (paciente.encontrado && paciente.datos) {
    const datos = paciente.datos as Record<string, unknown>;
    await enviarMensajeConBotones(
      chatId,
      `👤 <b>Paciente encontrado</b>\n\n${datos.nombre_completo}\n📍 EPS: ${datos.eps_nombre || "Sin EPS"}\n📋 CC: ${cedula}`,
      [
        [{ text: "📝 Crear Factura", url: `${APP_URL}/factura/desde-telegram?token=${pendiente.token}` }],
        [{ text: "🎤 Clasificar otro", callback_data: "new" }],
      ]
    );
  } else {
    await enviarMensajeConBotones(
      chatId,
      `⚠️ Paciente con CC ${cedula} <b>no registrado</b>.\n\nPodés crear la factura y completar los datos del paciente en la web.`,
      [
        [{ text: "📝 Completar datos y crear factura", url: `${APP_URL}/factura/desde-telegram?token=${pendiente.token}` }],
      ]
    );
  }

  return NextResponse.json({ ok: true });
}

// ==========================================
// FORMATEO DE RESPUESTAS
// ==========================================

interface DatosClasificacion {
  diagnosticos: { codigo_cie10?: string; descripcion: string; rol?: string }[];
  procedimientos: { codigo_cups: string; descripcion: string }[];
  atencion: Record<string, unknown>;
  documento_paciente: string | null;
  nombre_paciente: string | null;
}

function formatearRespuestaClasificacion(
  datos: DatosClasificacion,
  pacienteInfo: Record<string, unknown> | null,
  token: string
): { texto: string; botones: { text: string; url?: string; callback_data?: string }[][] } {
  let texto = "📋 <b>Clasificación</b>\n\n";

  // Paciente
  if (pacienteInfo) {
    texto += `👤 <b>${pacienteInfo.nombre_completo}</b>\n`;
    texto += `📍 EPS: ${pacienteInfo.eps_nombre || "Sin EPS"}\n\n`;
  } else if (datos.nombre_paciente) {
    texto += `👤 ${datos.nombre_paciente}\n`;
    if (datos.documento_paciente) {
      texto += `📋 CC: ${datos.documento_paciente}\n`;
      texto += `⚠️ <i>Paciente no registrado</i>\n\n`;
    } else {
      texto += "\n";
    }
  }

  // Diagnósticos
  const dxPrincipal = datos.diagnosticos?.find(d => d.rol === "principal");
  if (dxPrincipal) {
    texto += `🔴 <b>Dx principal:</b> ${dxPrincipal.codigo_cie10 || "—"} — ${dxPrincipal.descripcion}\n`;
  }

  datos.diagnosticos?.filter(d => d.rol !== "principal").forEach(d => {
    const icon = d.rol === "causa_externa" ? "🟠" : "🟡";
    texto += `${icon} <b>Dx:</b> ${d.codigo_cie10 || "—"} — ${d.descripcion}\n`;
  });

  // Procedimientos
  if (datos.procedimientos?.length > 0) {
    texto += "\n🏥 <b>Procedimientos:</b>\n";
    datos.procedimientos.forEach(p => {
      texto += `  • ${p.codigo_cups} — ${p.descripcion}\n`;
    });
  }

  // Consulta
  const attn = datos.atencion;
  if (attn?.codConsultaCups) {
    texto += `\n💊 <b>Consulta:</b> ${attn.codConsultaCups}`;
  }

  // Botones
  const botones: { text: string; url?: string; callback_data?: string }[][] = [
    [{ text: "📝 Crear Factura", url: `${APP_URL}/factura/desde-telegram?token=${token}` }],
    [{ text: "🎤 Clasificar otro", callback_data: "new" }],
  ];

  // Si no hay documento, pedir cédula
  if (!datos.documento_paciente && !pacienteInfo) {
    texto += "\n\n💬 Enviame la <b>cédula</b> del paciente para buscar sus datos.";
  }

  return { texto, botones };
}
