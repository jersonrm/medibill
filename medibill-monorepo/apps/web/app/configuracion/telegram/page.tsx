"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  generarCodigoVinculacion,
  obtenerEstadoVinculacion,
  desvincularTelegram,
} from "@/app/actions/telegram-vinculacion";

export default function TelegramConfigPage() {
  const [vinculado, setVinculado] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [fechaVinculacion, setFechaVinculacion] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [codigoExpira, setCodigoExpira] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(0);

  const cargarEstado = useCallback(async () => {
    setLoading(true);
    try {
      const estado = await obtenerEstadoVinculacion();
      setVinculado(estado.vinculado);
      setTelegramUsername(estado.telegramUsername);
      setFechaVinculacion(estado.fechaVinculacion);
    } catch {
      // Ignorar errores de carga
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  // Timer para expiración del código
  useEffect(() => {
    if (!codigoExpira) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((codigoExpira.getTime() - Date.now()) / 1000));
      setTiempoRestante(diff);
      if (diff <= 0) {
        setCodigo(null);
        setCodigoExpira(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [codigoExpira]);

  async function handleGenerarCodigo() {
    setGenerando(true);
    try {
      const result = await generarCodigoVinculacion();
      if (result.codigo) {
        setCodigo(result.codigo);
        setCodigoExpira(new Date(Date.now() + 10 * 60 * 1000));
        setTiempoRestante(600);
      }
    } catch {
      // Ignorar
    } finally {
      setGenerando(false);
    }
  }

  async function handleDesvincular() {
    if (!confirm("¿Seguro que querés desvincular tu cuenta de Telegram?")) return;
    setDesvinculando(true);
    try {
      const result = await desvincularTelegram();
      if (result.success) {
        setVinculado(false);
        setTelegramUsername(null);
        setFechaVinculacion(null);
      }
    } catch {
      // Ignorar
    } finally {
      setDesvinculando(false);
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bot de Telegram</h1>
      <p className="text-gray-600 mb-8">
        Vinculá tu cuenta para clasificar notas clínicas por audio directamente desde Telegram.
      </p>

      {vinculado ? (
        /* ── Estado vinculado ── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-green-800">Cuenta vinculada</h2>
                <p className="text-sm text-green-600">
                  {telegramUsername ? `@${telegramUsername}` : "Telegram conectado"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Usuario Telegram:</span>
                <p className="font-medium">{telegramUsername ? `@${telegramUsername}` : "Sin username"}</p>
              </div>
              <div>
                <span className="text-gray-500">Vinculado desde:</span>
                <p className="font-medium">
                  {fechaVinculacion ? new Date(fechaVinculacion).toLocaleDateString("es-CO") : "—"}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Cómo usar el bot:</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Abrí @MedibillBot en Telegram</li>
                <li>Enviá una nota de voz con la atención del paciente</li>
                <li>Recibí los códigos CUPS y CIE-10 en segundos</li>
                <li>Tocá &quot;Crear Factura&quot; para pre-llenar todo en la web</li>
              </ol>
            </div>

            <button
              onClick={handleDesvincular}
              disabled={desvinculando}
              className="w-full px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {desvinculando ? "Desvinculando..." : "Desvincular cuenta"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Estado no vinculado ── */
        <div className="space-y-6">
          {/* Instrucciones */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vincular con Telegram</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-medi-primary text-white text-xs font-bold flex-shrink-0">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Generá un código de vinculación</p>
                  <p className="text-sm text-gray-500">El código expira en 10 minutos</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-medi-primary text-white text-xs font-bold flex-shrink-0">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Abrí @MedibillBot en Telegram</p>
                  <p className="text-sm text-gray-500">
                    <a href="https://t.me/MedibillBot" target="_blank" rel="noopener noreferrer" className="text-medi-primary hover:underline">
                      t.me/MedibillBot
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-medi-primary text-white text-xs font-bold flex-shrink-0">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Enviá el comando de vinculación</p>
                  <p className="text-sm text-gray-500">Escribí /vincular seguido del código</p>
                </div>
              </div>
            </div>
          </div>

          {/* Código */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {codigo ? (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">Tu código de vinculación:</p>
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-3xl font-mono font-bold tracking-widest text-medi-primary">{codigo}</p>
                </div>
                <p className="text-sm text-gray-500 mb-1">
                  Enviá en Telegram: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">/vincular {codigo}</code>
                </p>
                <p className="text-xs text-amber-600">Expira en {formatTime(tiempoRestante)}</p>

                <button
                  onClick={handleGenerarCodigo}
                  disabled={generando}
                  className="mt-4 px-4 py-2 text-sm text-medi-primary hover:underline disabled:opacity-50"
                >
                  Generar nuevo código
                </button>
              </div>
            ) : (
              <div className="text-center">
                <button
                  onClick={handleGenerarCodigo}
                  disabled={generando}
                  className="px-6 py-3 bg-medi-primary text-white rounded-xl font-semibold text-sm hover:bg-medi-accent transition-colors disabled:opacity-50 shadow-lg shadow-medi-primary/25"
                >
                  {generando ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando...
                    </span>
                  ) : (
                    "Generar código de vinculación"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Info del bot */}
          <div className="bg-blue-50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">¿Qué podés hacer con el Bot?</h3>
                <ul className="mt-2 text-sm text-blue-800 space-y-1">
                  <li>🎤 Clasificar notas clínicas por audio</li>
                  <li>📋 Obtener códigos CUPS y CIE-10 en segundos</li>
                  <li>👤 Buscar pacientes por cédula</li>
                  <li>📝 Crear facturas pre-llenadas desde el bot</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
