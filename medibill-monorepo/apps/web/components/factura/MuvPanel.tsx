"use client";

import { useState } from "react";
import { validarRipsYObtenerCuv } from "@/app/actions/muv";
import type { FacturaData } from "./types";

interface MuvPanelProps {
  factura: FacturaData;
  accion: boolean;
  setAccion: (v: boolean) => void;
  onFacturaUpdate: (updates: Partial<FacturaData>) => void;
}

export default function MuvPanel({ factura, accion, setAccion, onFacturaUpdate }: MuvPanelProps) {
  const [estadoMuvMsg, setEstadoMuvMsg] = useState<string | null>(null);
  const [erroresMuv, setErroresMuv] = useState<{ codigo: string; mensaje: string; severidad: string; campo?: string }[]>([]);
  const [fechaRadicacion, setFechaRadicacion] = useState<string | null>(null);

  const handleValidarMuv = async () => {
    if (!confirm("¿Validar RIPS ante el MUV (FEV-RIPS API v4.3) para obtener el CUV?")) return;
    setAccion(true);
    setEstadoMuvMsg(null);
    setErroresMuv([]);
    setFechaRadicacion(null);
    try {
      const res = await validarRipsYObtenerCuv(factura.id);
      if (res.success) {
        onFacturaUpdate({ cuv: res.cuv, estado_muv: "validado" });
        setEstadoMuvMsg(`CUV obtenido: ${res.cuv}`);
        setFechaRadicacion(res.fechaRadicacion);
      } else {
        onFacturaUpdate({ estado_muv: "errores" in res && res.errores ? "rechazado" : factura.estado_muv });
        setEstadoMuvMsg(res.error);
        if ("errores" in res && res.errores) {
          setErroresMuv(res.errores);
        }
      }
    } catch (error) {
      console.error("Error validando MUV:", error);
      alert("Error al validar ante el MUV.");
    } finally {
      setAccion(false);
    }
  };

  return (
    <div className="w-full mt-2">
      {!factura.cuv && factura.estado_muv !== "validando" && (
        <button onClick={handleValidarMuv} disabled={accion}
          className="px-6 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-md">
          🏥 Validar RIPS (MUV)
        </button>
      )}
      {factura.estado_muv === "validando" && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-700">⏳ Validando ante el MUV...</p>
        </div>
      )}
      {(factura.cuv || factura.estado_muv === "rechazado" || estadoMuvMsg) && (
        <div className={`rounded-xl border p-4 mt-2 ${
          factura.cuv ? "bg-green-50 border-green-300" :
          factura.estado_muv === "rechazado" ? "bg-red-50 border-red-300" :
          "bg-teal-50 border-teal-300"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-black uppercase text-medi-deep">Estado MUV (MinSalud)</h4>
            {factura.estado_muv && (
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                factura.estado_muv === "validado" ? "bg-green-600 text-white" :
                factura.estado_muv === "rechazado" ? "bg-red-600 text-white" :
                "bg-teal-600 text-white"
              }`}>
                {factura.estado_muv}
              </span>
            )}
          </div>
          {factura.cuv && (
            <p className="text-xs text-medi-dark/60 font-mono break-all mb-2">
              CUV: {factura.cuv}
            </p>
          )}
          {fechaRadicacion && (
            <p className="text-xs text-green-700 mb-2">
              Fecha radicación: {new Date(fechaRadicacion).toLocaleString("es-CO")}
            </p>
          )}
          {estadoMuvMsg && (
            <p className={`text-xs mb-2 ${
              factura.cuv ? "text-green-700" : "text-red-700"
            }`}>{estadoMuvMsg}</p>
          )}
          {erroresMuv.length > 0 && (
            <div className="mt-2 space-y-1">
              {erroresMuv.map((e, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded-lg ${
                  e.severidad === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}>
                  <span className="font-bold">[{e.codigo}]</span> {e.mensaje}
                  {e.campo && <span className="block text-[10px] opacity-70 mt-0.5 font-mono">{e.campo}</span>}
                </div>
              ))}
            </div>
          )}
          {factura.estado_muv === "rechazado" && (
            <button onClick={handleValidarMuv} disabled={accion}
              className="mt-3 px-4 py-2 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">
              🔄 Reintentar validación
            </button>
          )}
        </div>
      )}
    </div>
  );
}
