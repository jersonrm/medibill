"use client";

import React from "react";
import type { GlosaRecibidaEnriquecida } from "@/lib/types/glosas";
import { LABELS_CONCEPTO } from "@/lib/types/glosas";
import BadgeEstadoGlosa from "@/components/glosas/BadgeEstadoGlosa";

interface TarjetaGlosaProps {
  glosa: GlosaRecibidaEnriquecida;
  seleccionada: boolean;
  onClick: (glosa: GlosaRecibidaEnriquecida) => void;
}

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function TarjetaGlosa({
  glosa,
  seleccionada,
  onClick,
}: TarjetaGlosaProps) {
  const isVencida = glosa.estado === "vencida";
  const conceptoLabel = LABELS_CONCEPTO[glosa.concepto_general] || glosa.concepto_general;

  return (
    <button
      type="button"
      onClick={() => !isVencida && onClick(glosa)}
      disabled={isVencida}
      className={`
        w-full text-left rounded-xl border-2 p-4 transition-all duration-200
        ${isVencida ? "opacity-60 cursor-not-allowed border-gray-200 bg-gray-50" : "cursor-pointer hover:shadow-md hover:border-medi-primary/50"}
        ${seleccionada ? "border-medi-primary bg-medi-light/20 shadow-md ring-2 ring-medi-primary/20" : "border-medi-light/50 bg-white"}
      `}
    >
      {/* Header: código + EPS + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700">
            {glosa.codigo_glosa}
          </span>
          <span className="text-xs text-medi-dark font-medium">
            {conceptoLabel}
          </span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-medi-dark">{glosa.eps_nombre}</span>
        </div>
        <BadgeEstadoGlosa
          estado={glosa.estado}
          diasRestantes={glosa.dias_restantes}
          urgencia={glosa.urgencia}
          esExtemporanea={glosa.es_extemporanea}
        />
      </div>

      {/* Descripción */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {glosa.descripcion_glosa}
      </p>

      {/* Grid: factura, valor glosado, paciente */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-gray-400 block mb-0.5">Factura</span>
          <span className="font-semibold text-medi-deep">{glosa.num_factura}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Valor glosado</span>
          <span className="font-bold text-red-600">
            {formatCOP(glosa.valor_glosado)}
          </span>
          <span className="text-gray-400 ml-1">
            ({glosa.porcentaje_glosado}%)
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Paciente</span>
          <span className="font-medium text-gray-700 truncate block">
            {glosa.paciente_nombre}
          </span>
        </div>
      </div>
    </button>
  );
}
