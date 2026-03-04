"use client";

import React from "react";
import type { RespuestaConGlosa, CodigoRespuesta } from "@/lib/types/glosas";
import { COLORES_RESPUESTA, LABELS_CONCEPTO } from "@/lib/types/glosas";
import { CODIGOS_RESPUESTA } from "@/lib/catalogo-respuestas-glosa";

interface ResumenRespuestaProps {
  respuesta: RespuestaConGlosa;
}

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function ResumenRespuesta({ respuesta }: ResumenRespuestaProps) {
  const codigo = respuesta.codigo_respuesta as CodigoRespuesta;
  const config = CODIGOS_RESPUESTA[codigo];
  const colores = COLORES_RESPUESTA[codigo];
  const concepto = respuesta.glosa
    ? LABELS_CONCEPTO[respuesta.glosa.concepto_general] || respuesta.glosa.concepto_general
    : "";

  return (
    <div
      className={`rounded-xl border ${colores.border} ${colores.bg} p-4 transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${colores.bg} ${colores.text} ring-1 ring-current`}
          >
            {config.icono}
          </span>
          <div>
            <span className={`font-mono font-bold text-sm ${colores.text}`}>
              {codigo}
            </span>
            <span className="text-sm text-gray-600 ml-2">
              {config.nombre}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {respuesta.fecha_respuesta}
        </span>
      </div>

      {/* Glosa info */}
      {respuesta.glosa && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span className="font-semibold">{respuesta.glosa.eps_nombre}</span>
          <span>•</span>
          <span className="font-mono">{respuesta.glosa.codigo_glosa}</span>
          <span>•</span>
          <span>{concepto}</span>
          <span>•</span>
          <span>{respuesta.glosa.num_factura}</span>
        </div>
      )}

      {/* Valores */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-gray-400 block mb-0.5">Glosado</span>
          <span className="font-bold text-gray-700">
            {respuesta.glosa ? formatCOP(respuesta.glosa.valor_glosado) : "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Aceptado</span>
          <span className="font-bold text-red-600">
            {formatCOP(respuesta.valor_aceptado)}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Controvertido</span>
          <span className="font-bold text-green-600">
            {formatCOP(respuesta.valor_controvertido)}
          </span>
        </div>
      </div>
    </div>
  );
}
