"use client";

import React from "react";
import type { AuditoriaHistorial } from "@/lib/types/ui";

interface PatientHistoryProps {
  historial: AuditoriaHistorial[];
  cedulaPaciente: string;
  nombrePaciente: string;
  onCargarAuditoria: (auditoria: AuditoriaHistorial) => void;
}

export default function PatientHistory({
  historial,
  cedulaPaciente,
  nombrePaciente,
  onCargarAuditoria,
}: PatientHistoryProps) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-md border border-medi-light/50">
      <h3 className="text-base font-bold text-medi-dark uppercase mb-6 tracking-widest flex items-center justify-between opacity-80">
        {cedulaPaciente && nombrePaciente ? (
          <span className="text-medi-primary">Historial del Paciente</span>
        ) : (
          <span>Auditorías Recientes</span>
        )}
      </h3>
      <div className="flex flex-col gap-4">
        {historial.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-medi-light rounded-xl font-medium text-medi-dark/60 italic">
            No hay registros para mostrar.
          </div>
        ) : (
          historial.map((item, i) => (
            <div
              key={i}
              onClick={() => onCargarAuditoria(item)}
              className="p-5 border border-medi-light rounded-xl hover:bg-medi-light/20 cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-medi-deep bg-medi-light/50 px-3 py-1.5 rounded-lg border border-medi-light">
                    {item.resultado_ia.diagnosticos?.[0]?.codigo_cie10 || "S/C"}
                  </span>
                  {item.resultado_ia.diagnosticos?.length > 1 && (
                    <span className="text-[11px] font-extrabold text-medi-primary bg-white px-2 py-1 rounded-md border-2 border-medi-light uppercase">
                      + {item.resultado_ia.diagnosticos.length - 1} DIAG
                    </span>
                  )}
                  {item.resultado_ia.procedimientos?.length > 0 && (
                    <span className="text-[11px] font-extrabold text-medi-primary bg-white px-2 py-1 rounded-md border-2 border-medi-light uppercase">
                      + {item.resultado_ia.procedimientos.length} PROC
                    </span>
                  )}
                </div>
                <span className="text-xs text-medi-dark/60 font-bold">
                  {new Date(item.creado_en).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[13px] text-medi-deep line-clamp-2">&ldquo;{item.nota_original}&rdquo;</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
