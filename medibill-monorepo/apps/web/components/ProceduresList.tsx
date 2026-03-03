"use client";

import React, { useState } from "react";
import type { ProcedimientoUI, AlternativaIA } from "@/lib/types/ui";

interface ProceduresListProps {
  procedimientos: ProcedimientoUI[];
  onCambiar: (index: number, alternativa: AlternativaIA) => void;
  onEliminar: (index: number) => void;
  onAgregar: (procedimiento: ProcedimientoUI) => void;
}

export default function ProceduresList({
  procedimientos,
  onCambiar,
  onEliminar,
  onAgregar,
}: ProceduresListProps) {
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [nuevaCant, setNuevaCant] = useState(1);

  const handleAgregar = () => {
    if (!nuevoCodigo.trim() || !nuevaDesc.trim() || nuevaCant < 1) {
      alert("Debes ingresar el código, descripción y una cantidad válida.");
      return;
    }
    onAgregar({
      codigo_cups: nuevoCodigo.toUpperCase().trim(),
      descripcion: nuevaDesc.trim(),
      cantidad: nuevaCant,
      alternativas: [],
    });
    setNuevoCodigo("");
    setNuevaDesc("");
    setNuevaCant(1);
    setMostrarAgregar(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
      <div className="bg-medi-primary px-8 py-5 flex justify-between items-center text-white">
        <h4 className="font-bold text-lg uppercase tracking-wider">Procedimientos (CUPS)</h4>
      </div>
      <div className="p-4 bg-medi-light/10">
        {procedimientos.map((proc, idx) => (
          <div
            key={idx}
            className="bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-accent relative group"
          >
            <div className="flex items-center gap-4 sm:gap-6 p-5">
              <div className="text-xl font-black text-medi-primary bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center">
                {proc.codigo_cups}
              </div>
              <div className="flex-grow text-lg font-semibold text-medi-deep italic">
                {proc.descripcion}
              </div>
              <div className="text-sm font-black text-white bg-medi-primary px-4 py-2 rounded-full border border-medi-primary/50 whitespace-nowrap flex-shrink-0">
                Cant: {proc.cantidad}
              </div>
              <button
                onClick={() => onEliminar(idx)}
                className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors shadow-sm ml-2 flex-shrink-0"
                title="Eliminar este procedimiento"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>

            {proc.alternativas && proc.alternativas.length > 0 && (
              <details className="group/details border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                  <span className="group-open/details:rotate-90 transition-transform">▶</span> Ver alternativas
                  sugeridas (Reemplazar)
                </summary>
                <div className="p-4 pt-0 flex flex-col gap-2">
                  {proc.alternativas.map((alt, altIdx) => (
                    <button
                      key={altIdx}
                      onClick={() => onCambiar(idx, alt)}
                      className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-accent hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn"
                    >
                      <span className="font-black text-medi-dark group-hover/btn:text-medi-accent">
                        {alt.codigo}
                      </span>
                      <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                      <span className="ml-auto text-xs text-medi-accent opacity-0 group-hover/btn:opacity-100 font-bold">
                        Reemplazar por este ↑
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {/* Agregar procedimiento manual */}
        <div className="mt-4 border-t border-medi-light/50 pt-4">
          {!mostrarAgregar ? (
            <button onClick={() => setMostrarAgregar(true)} className="text-xs font-bold text-medi-primary flex items-center gap-2 hover:bg-medi-light/50 px-4 py-3 rounded-xl transition-colors w-full justify-center border border-dashed border-medi-primary/50">
              + Agregar Procedimiento Manualmente
            </button>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-medi-primary/50 shadow-sm flex flex-col gap-3">
              <h5 className="text-xs font-bold text-medi-dark uppercase mb-1">Añadir Nuevo CUPS</h5>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="Cód. Ej: 890201" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm sm:w-1/4 outline-none focus:border-medi-primary uppercase font-bold text-medi-deep" />
                <input type="text" placeholder="Descripción..." value={nuevaDesc} onChange={(e) => setNuevaDesc(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm flex-grow outline-none focus:border-medi-primary font-medium text-medi-deep" />
                <input type="number" min="1" value={nuevaCant} onChange={(e) => setNuevaCant(parseInt(e.target.value) || 1)} className="p-3 border-2 border-medi-light rounded-xl text-sm w-20 outline-none focus:border-medi-primary font-bold text-center text-medi-deep" title="Cantidad" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setMostrarAgregar(false)} className="px-4 py-2 text-xs font-bold text-medi-dark hover:bg-medi-light/50 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleAgregar} className="px-4 py-2 text-xs font-black bg-medi-primary text-white hover:bg-medi-deep rounded-xl transition-colors shadow-md">Guardar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
