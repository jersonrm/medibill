"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { marcarComoDescargada } from "@/app/actions/facturas";
import { generarPaqueteDescarga, radicarFactura, radicarPorEmail, obtenerEmailRadicacion } from "@/app/actions/radicacion";
import type { FacturaData } from "./types";

interface RadicacionPanelProps {
  factura: FacturaData;
  accion: boolean;
  setAccion: (v: boolean) => void;
  onFacturaUpdate: (updates: Partial<FacturaData>) => void;
}

export default function RadicacionPanel({ factura, accion, setAccion, onFacturaUpdate }: RadicacionPanelProps) {
  const [numeroRadicado, setNumeroRadicado] = useState("");
  const [radicacionMsg, setRadicacionMsg] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<{ email: string; epsNombre: string } | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // Cargar info de email de radicación al montar
  useEffect(() => {
    if (factura.estado === "descargada" && factura.cufe && factura.cuv) {
      obtenerEmailRadicacion(factura.id).then(setEmailInfo);
    }
  }, [factura.id, factura.estado, factura.cufe, factura.cuv]);

  const handleDescargarPaquete = async () => {
    setAccion(true);
    setRadicacionMsg(null);
    try {
      const res = await generarPaqueteDescarga(factura.id);
      if (res.success) {
        const bytes = Uint8Array.from(atob(res.zipBase64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (factura.estado === "aprobada") {
          await marcarComoDescargada(factura.id);
          onFacturaUpdate({ estado: "descargada" });
        }
        setRadicacionMsg("Paquete descargado exitosamente.");
      } else {
        alert(res.error);
      }
    } catch (e) {
      console.error("Error generando paquete radicación:", e);
      alert("Error generando el paquete de radicación.");
    } finally {
      setAccion(false);
    }
  };

  const handleConfirmarRadicacion = async () => {
    if (!numeroRadicado.trim()) {
      alert("Ingrese el número de radicado.");
      return;
    }
    if (!confirm(`¿Marcar factura como radicada con número ${numeroRadicado.trim()}?`)) return;
    setAccion(true);
    try {
      const res = await radicarFactura(factura.id, numeroRadicado.trim());
      if (res.success) {
        onFacturaUpdate({
          estado: "radicada",
          metadata: {
            ...(factura.metadata || {}),
            numero_radicado: numeroRadicado.trim(),
            fecha_radicacion: new Date().toISOString(),
          },
        });
      } else {
        alert(res.error);
      }
    } catch (e) {
      console.error("Error radicando factura:", e);
      alert("Error al radicar la factura.");
    } finally {
      setAccion(false);
    }
  };

  const handleRadicarPorEmail = async () => {
    if (!emailInfo) return;
    if (!confirm(`¿Enviar paquete de radicación por email a ${emailInfo.email} (${emailInfo.epsNombre})?`)) return;
    setEnviandoEmail(true);
    setAccion(true);
    setRadicacionMsg(null);
    try {
      const res = await radicarPorEmail(factura.id);
      if (res.success) {
        onFacturaUpdate({
          estado: "radicada",
          metadata: {
            ...(factura.metadata || {}),
            email_radicacion_enviado: emailInfo.email,
            email_message_id: res.messageId,
            fecha_envio_email: new Date().toISOString(),
            numero_radicado: `EMAIL-${res.messageId}`,
            fecha_radicacion: new Date().toISOString(),
          },
        });
        setRadicacionMsg(`Email enviado exitosamente a ${emailInfo.email}`);
      } else {
        alert(res.error);
      }
    } catch (e) {
      console.error("Error radicando por email:", e);
      alert("Error al enviar la radicación por email.");
    } finally {
      setEnviandoEmail(false);
      setAccion(false);
    }
  };

  return (
    <>
      {/* Radicación — Visible cuando tiene CUFE+CUV y estado aprobada/descargada */}
      {factura.cufe && factura.cuv && (factura.estado === "aprobada" || factura.estado === "descargada") && (
        <div className="w-full mt-2">
          <div className="rounded-xl border border-purple-300 bg-purple-50 p-5">
            <h4 className="text-sm font-black uppercase text-medi-deep mb-3">📦 Radicación ante EPS</h4>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleDescargarPaquete}
                disabled={accion}
                className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-md"
              >
                📦 Descargar paquete radicación
              </button>
            </div>
            {radicacionMsg && (
              <p className="text-xs text-green-700 mb-3">{radicacionMsg}</p>
            )}
            {factura.estado === "descargada" && (
              <div className="border-t border-purple-200 pt-4 space-y-4">
                {/* Radicar por Email */}
                {emailInfo ? (
                  <div className="bg-white border border-purple-200 rounded-lg p-4">
                    <p className="text-xs font-bold text-purple-800 mb-2">📧 Radicar por Email</p>
                    <p className="text-xs text-medi-dark/60 mb-3">
                      Enviar paquete ZIP a <span className="font-semibold">{emailInfo.email}</span> ({emailInfo.epsNombre})
                    </p>
                    <button
                      onClick={handleRadicarPorEmail}
                      disabled={accion || enviandoEmail}
                      className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                      {enviandoEmail ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        <>📧 Radicar por Email a {emailInfo.epsNombre}</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800">
                      📧 Para radicar por email, <Link href="/acuerdos" className="font-bold underline hover:text-amber-900">configure el email de radicación en Acuerdos de Voluntades</Link>.
                    </p>
                  </div>
                )}

                {/* Radicar manualmente */}
                <div>
                  <p className="text-xs text-medi-dark/60 mb-2">O ingrese el número de radicado manualmente:</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Número de radicado EPS"
                      value={numeroRadicado}
                      onChange={e => setNumeroRadicado(e.target.value)}
                      className="flex-grow px-4 py-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button
                      onClick={handleConfirmarRadicacion}
                      disabled={accion || !numeroRadicado.trim()}
                      className="px-5 py-2 bg-purple-700 text-white font-bold rounded-lg hover:bg-purple-800 transition-colors disabled:opacity-50 text-sm"
                    >
                      ✓ Confirmar radicación
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado radicada */}
      {factura.estado === "radicada" && (
        <div className="w-full mt-2">
          <div className="rounded-xl border border-green-400 bg-green-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black uppercase text-green-800">✅ Factura Radicada</h4>
              <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-purple-600 text-white">Radicada</span>
            </div>
            {!!(factura.metadata as Record<string, unknown>)?.numero_radicado && (
              <p className="text-sm text-green-800 mb-1">
                <span className="font-bold">Número radicado EPS:</span>{" "}
                {String((factura.metadata as Record<string, unknown>).numero_radicado)}
              </p>
            )}
            {!!(factura.metadata as Record<string, unknown>)?.fecha_radicacion && (
              <p className="text-xs text-green-700 mb-2">
                Fecha radicación: {new Date(String((factura.metadata as Record<string, unknown>).fecha_radicacion)).toLocaleString("es-CO")}
              </p>
            )}
            {!!(factura.metadata as Record<string, unknown>)?.email_radicacion_enviado && (
              <p className="text-xs text-green-700 mb-2">
                📧 Enviado a: {String((factura.metadata as Record<string, unknown>).email_radicacion_enviado)}
              </p>
            )}
            <div className="mt-3 bg-green-100 border border-green-300 rounded-lg p-3">
              <p className="text-xs text-green-800">
                📋 La EPS tiene un plazo máximo de <span className="font-bold">22 días hábiles</span> para pronunciarse sobre la factura radicada (Art. 56 Ley 2166/2021).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
