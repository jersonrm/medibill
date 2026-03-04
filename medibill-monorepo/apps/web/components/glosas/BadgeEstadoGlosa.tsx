"use client";

import React from "react";
import type { EstadoGlosaRecibida, NivelUrgencia } from "@/lib/types/glosas";
import {
  LABELS_ESTADO_GLOSA_RECIBIDA,
  COLORES_ESTADO_GLOSA_RECIBIDA,
} from "@/lib/types/glosas";

interface BadgeEstadoGlosaProps {
  estado: EstadoGlosaRecibida;
  diasRestantes?: number;
  urgencia?: NivelUrgencia;
  esExtemporanea?: boolean;
}

export default function BadgeEstadoGlosa({
  estado,
  diasRestantes,
  urgencia,
  esExtemporanea,
}: BadgeEstadoGlosaProps) {
  // Determinar clases de color y animación según estado + urgencia
  let colorClasses = COLORES_ESTADO_GLOSA_RECIBIDA[estado];
  let label = LABELS_ESTADO_GLOSA_RECIBIDA[estado];
  let showPulse = false;
  let sublabel = "";

  if (estado === "pendiente" && urgencia) {
    switch (urgencia) {
      case "critica":
        colorClasses = "bg-red-100 text-red-800";
        showPulse = true;
        sublabel = `${diasRestantes} día${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`;
        break;
      case "urgente":
        colorClasses = "bg-amber-100 text-amber-800";
        sublabel = `${diasRestantes} días restantes`;
        break;
      case "normal":
        colorClasses = "bg-emerald-100 text-emerald-800";
        sublabel = `${diasRestantes} días restantes`;
        break;
    }
  }

  if (estado === "vencida") {
    colorClasses = "bg-gray-100 text-gray-500";
    sublabel = "(silencio = aceptación)";
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClasses}`}
      >
        {showPulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
        {label}
        {sublabel && (
          <span className="font-normal ml-1 opacity-80">{sublabel}</span>
        )}
      </span>

      {esExtemporanea && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
          ⏰ Extemporánea
        </span>
      )}
    </div>
  );
}
