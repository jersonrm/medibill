"use client";

import React from "react";
import type { CodigoRespuesta, ConfigRespuestaRS } from "@/lib/types/glosas";
import { COLORES_RESPUESTA, LABELS_RESPUESTA_DETALLE } from "@/lib/types/glosas";
import { CODIGOS_RESPUESTA } from "@/lib/catalogo-respuestas-glosa";

interface SelectorRespuestaProps {
  codigoSeleccionado: CodigoRespuesta | null;
  onSeleccionar: (codigo: CodigoRespuesta) => void;
  esExtemporanea: boolean;
  codigoRecomendadoIA?: CodigoRespuesta | null;
}

const ORDEN_CODIGOS: CodigoRespuesta[] = ["RS01", "RS02", "RS03", "RS04", "RS05"];

export default function SelectorRespuesta({
  codigoSeleccionado,
  onSeleccionar,
  esExtemporanea,
  codigoRecomendadoIA,
}: SelectorRespuestaProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">
        Código de respuesta
      </label>
      <div className="grid grid-cols-1 gap-2">
        {ORDEN_CODIGOS.map((codigo) => {
          const config: ConfigRespuestaRS = CODIGOS_RESPUESTA[codigo];
          const colores = COLORES_RESPUESTA[codigo];
          const isSelected = codigoSeleccionado === codigo;
          const isDisabled = codigo === "RS04" && !esExtemporanea;
          const isRecomendado = codigoRecomendadoIA === codigo;

          return (
            <button
              key={codigo}
              type="button"
              onClick={() => !isDisabled && onSeleccionar(codigo)}
              disabled={isDisabled}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                ${isDisabled ? "opacity-40 cursor-not-allowed border-gray-200 bg-gray-50" : "cursor-pointer hover:shadow-sm"}
                ${isSelected
                  ? `${colores.border} ${colores.bg} ring-2 ring-offset-1 ring-current shadow-sm`
                  : "border-gray-200 bg-white hover:border-gray-300"
                }
              `}
            >
              {/* Indicador de selección */}
              <div
                className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${isSelected ? `${colores.bg} ${colores.text} ring-2 ring-current` : "bg-gray-100 text-gray-400"}
                `}
              >
                {config.icono}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold text-sm ${isSelected ? colores.text : "text-gray-700"}`}
                  >
                    {codigo}
                  </span>
                  <span className={`text-sm font-medium ${isSelected ? colores.text : "text-gray-600"}`}>
                    {config.nombre}
                  </span>
                  {isRecomendado && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">
                      ✨ IA recomienda
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {config.descripcion}
                </p>
              </div>

              {/* Punto indicador de selección */}
              {isSelected && (
                <div className={`flex-shrink-0 w-3 h-3 rounded-full ${colores.text.replace("text-", "bg-")}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
