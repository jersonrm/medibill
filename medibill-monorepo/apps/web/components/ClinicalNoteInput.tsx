"use client";

import React from "react";

interface ClinicalNoteInputProps {
  nota: string;
  cargando: boolean;
  onNotaChange: (valor: string) => void;
  onEjecutarAnalisis: () => void;
  onNuevaConsulta: () => void;
  readOnly?: boolean;
}

export default function ClinicalNoteInput({
  nota,
  cargando,
  onNotaChange,
  onEjecutarAnalisis,
  onNuevaConsulta,
  readOnly = false,
}: ClinicalNoteInputProps) {
  return (
    <>
      <textarea
        value={nota}
        onChange={(e) => onNotaChange(e.target.value)}
        readOnly={readOnly}
        className={`flex-grow w-full p-6 text-xl border-2 border-medi-light rounded-2xl outline-none focus:border-medi-primary transition-all text-medi-deep leading-relaxed bg-white font-medium shadow-inner min-h-[200px] ${readOnly ? "opacity-70 cursor-default" : ""}`}
        placeholder="Describa la atención aquí..."
      />

      {!readOnly && (
      <div className="grid grid-cols-4 gap-4 mt-6">
        <button
          onClick={onEjecutarAnalisis}
          disabled={cargando || !nota.trim()}
          className="col-span-3 bg-medi-primary hover:bg-medi-deep text-white font-black text-xl py-5 rounded-2xl shadow-xl shadow-medi-primary/30 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {cargando ? "Analizando..." : "Ejecutar Análisis RIPS"}
        </button>
        <button
          onClick={onNuevaConsulta}
          className="col-span-1 bg-medi-light/40 hover:bg-medi-light text-medi-dark font-bold py-5 rounded-2xl transition-all active:scale-[0.98]"
          title="Limpiar todo"
        >
          <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
      )}
    </>
  );
}
