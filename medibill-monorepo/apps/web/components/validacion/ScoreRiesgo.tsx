"use client";

interface ScoreRiesgoProps {
  puntaje: number;
}

export default function ScoreRiesgo({ puntaje }: ScoreRiesgoProps) {
  let colorTexto: string;
  let colorBorde: string;
  let label: string;

  if (puntaje <= 30) {
    colorTexto = "text-emerald-400";
    colorBorde = "border-emerald-500/40";
    label = "Bajo";
  } else if (puntaje <= 60) {
    colorTexto = "text-amber-400";
    colorBorde = "border-amber-500/40";
    label = "Medio";
  } else {
    colorTexto = "text-red-400";
    colorBorde = "border-red-500/40";
    label = "Alto";
  }

  return (
    <div className={`bg-medi-deep/80 border ${colorBorde} rounded-xl p-5 flex flex-col items-center gap-1`}>
      <span className={`text-5xl font-mono font-bold ${colorTexto}`}>
        {puntaje}
      </span>
      <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
        Riesgo de Glosa
      </span>
      <span className={`text-xs font-bold ${colorTexto} mt-1 px-2 py-0.5 rounded-full bg-current/10`}>
        {label}
      </span>
    </div>
  );
}
