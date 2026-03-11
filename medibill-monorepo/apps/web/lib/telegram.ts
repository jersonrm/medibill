/**
 * Cliente Telegram — Fetch nativo (sin grammy/telegraf)
 * Funciones para enviar mensajes, descargar archivos y botones inline.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado");
  return token;
}

function apiUrl(method: string): string {
  return `${TELEGRAM_API}${getToken()}/${method}`;
}

interface TelegramResponse<T = unknown> {
  ok: boolean;
  result: T;
  description?: string;
}

/** Enviar mensaje de texto con parse_mode MarkdownV2 */
export async function enviarMensaje(
  chatId: number | string,
  texto: string,
  parseMode: "MarkdownV2" | "HTML" = "HTML"
): Promise<TelegramResponse> {
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

/** Enviar mensaje con botones inline */
export async function enviarMensajeConBotones(
  chatId: number | string,
  texto: string,
  botones: { text: string; url?: string; callback_data?: string }[][],
  parseMode: "MarkdownV2" | "HTML" = "HTML"
): Promise<TelegramResponse> {
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: parseMode,
      reply_markup: {
        inline_keyboard: botones,
      },
    }),
  });
  return res.json();
}

/** Obtener info de un archivo (file_path) para descargarlo */
export async function obtenerArchivo(fileId: string): Promise<{ file_path: string; file_size: number }> {
  const res = await fetch(apiUrl("getFile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const data: TelegramResponse<{ file_path: string; file_size: number }> = await res.json();
  if (!data.ok) throw new Error(`Telegram getFile error: ${data.description}`);
  return data.result;
}

/** Descargar archivo de Telegram como Buffer */
export async function descargarArchivo(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${getToken()}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error descargando archivo: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Enviar "typing" action para indicar que el bot está procesando */
export async function enviarAccionEscribiendo(chatId: number | string): Promise<void> {
  await fetch(apiUrl("sendChatAction"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: "typing",
    }),
  });
}

/**
 * Tipo para el update de Telegram
 */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    voice?: {
      duration: number;
      mime_type: string;
      file_id: string;
      file_unique_id: string;
      file_size: number;
    };
    audio?: {
      duration: number;
      mime_type: string;
      file_id: string;
      file_unique_id: string;
      file_size: number;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    data?: string;
    message?: {
      chat: { id: number };
    };
  };
}

/** Máximo tamaño de audio permitido: 5 MB */
export const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

/** Máxima duración de audio: 5 minutos */
export const MAX_AUDIO_DURATION = 300;
