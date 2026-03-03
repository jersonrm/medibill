"use client";

import type { ResultadoValidacion } from "@/lib/types/glosas";

interface BotonEnvioProps {
  resultado: ResultadoValidacion;
  onEnviar: () => void;
}

export default function BotonEnvio({ resultado, onEnviar }: BotonEnvioProps) {
  const { puede_radicar, errores, advertencias } = resultado;

  if (!puede_radicar) {
    return (
      <button
        disabled
        className="w-full py-3 px-6 rounded-xl text-sm font-bold bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
      >
        Corregir {errores} error{errores !== 1 ? "es" : ""} para enviar
      </button>
    );
  }

  if (advertencias > 0) {
    return (
      <button
        onClick={onEnviar}
        className="w-full py-3 px-6 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-lg shadow-amber-600/30"
      >
        Enviar con {advertencias} advertencia{advertencias !== 1 ? "s" : ""} →
      </button>
    );
  }

  return (
    <button
      onClick={onEnviar}
      className="w-full py-3 px-6 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/30"
    >
      Enviar a radicación →
    </button>
  );
}
