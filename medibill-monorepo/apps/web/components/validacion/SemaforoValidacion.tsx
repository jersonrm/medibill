"use client";

import type { ResultadoValidacion } from "@/lib/types/glosas";

interface SemaforoValidacionProps {
  resultado: ResultadoValidacion;
}

export default function SemaforoValidacion({ resultado }: SemaforoValidacionProps) {
  const { puede_radicar, advertencias, errores } = resultado;

  let colorCirculo: string;
  let colorPulso: string;
  let texto: string;
  let textColor: string;

  if (puede_radicar && advertencias === 0) {
    colorCirculo = "bg-emerald-500";
    colorPulso = "bg-emerald-400";
    texto = "APROBADA";
    textColor = "text-emerald-400";
  } else if (puede_radicar && advertencias > 0) {
    colorCirculo = "bg-amber-500";
    colorPulso = "bg-amber-400";
    texto = "CON ADVERTENCIAS";
    textColor = "text-amber-400";
  } else {
    colorCirculo = "bg-red-500";
    colorPulso = "bg-red-400";
    texto = "BLOQUEADA";
    textColor = "text-red-400";
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="relative flex items-center justify-center">
        {/* Pulso */}
        <span className={`absolute inline-flex h-16 w-16 rounded-full ${colorPulso} opacity-30 animate-ping`} />
        {/* Círculo principal */}
        <span className={`relative inline-flex h-16 w-16 rounded-full ${colorCirculo} shadow-lg shadow-current/20`}>
          {puede_radicar && errores === 0 && advertencias === 0 ? (
            <svg className="w-8 h-8 text-white m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : puede_radicar ? (
            <svg className="w-8 h-8 text-white m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </span>
      </div>
      <span className={`text-sm font-bold tracking-widest ${textColor}`}>
        {texto}
      </span>
    </div>
  );
}
