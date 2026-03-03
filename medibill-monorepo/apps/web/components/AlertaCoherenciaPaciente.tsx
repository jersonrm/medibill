"use client";

import React from "react";
import type { IncoherenciaPaciente } from "@/lib/validar-coherencia-paciente";

interface AlertaCoherenciaPacienteProps {
  alertas: IncoherenciaPaciente[];
}

/**
 * Banner de advertencia que muestra inconsistencias detectadas
 * entre la nota clínica y los datos del formulario del paciente.
 * Si no hay alertas, no renderiza nada.
 */
export default function AlertaCoherenciaPaciente({
  alertas,
}: AlertaCoherenciaPacienteProps) {
  if (alertas.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
      <div className="text-amber-800 font-bold text-sm flex items-center gap-2">
        ⚠️ Inconsistencias detectadas entre la nota y los datos del paciente
      </div>
      {alertas.map((a, i) => (
        <div
          key={i}
          className={`text-sm ${a.severidad === "error" ? "text-red-700" : "text-amber-700"}`}
        >
          <span className="font-mono font-bold">
            {a.campo.toUpperCase()}:
          </span>{" "}
          {a.mensaje}
        </div>
      ))}
      <div className="text-xs text-amber-600">
        Corrija estos datos antes de ejecutar el análisis para evitar glosas por
        inconsistencia (Causal DE16 Res. 2284/2023)
      </div>
    </div>
  );
}
