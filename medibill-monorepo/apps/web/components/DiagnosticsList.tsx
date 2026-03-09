"use client";

import React, { useState, useCallback } from "react";
import type { DiagnosticoUI, AlternativaIA } from "@/lib/types/ui";
import ModalBusquedaCodigo, { type ResultadoBusqueda } from "@/components/ModalBusquedaCodigo";
import { buscarCie10Action } from "@/app/actions/busqueda-codigos";

const ROL_LABELS: Record<string, { label: string; color: string }> = {
  principal: { label: "PRINCIPAL", color: "bg-blue-600 text-white" },
  relacionado: { label: "RELACIONADO", color: "bg-gray-200 text-gray-700" },
  causa_externa: { label: "CAUSA EXTERNA", color: "bg-amber-100 text-amber-800" },
};

interface DiagnosticsListProps {
  diagnosticos: DiagnosticoUI[];
  onCambiar: (index: number, alternativa: AlternativaIA) => void;
  onEliminar: (index: number) => void;
  onAgregar: (diagnostico: DiagnosticoUI) => void;
  onReordenar: (fromIndex: number, toIndex: number) => void;
}

export default function DiagnosticsList({
  diagnosticos,
  onCambiar,
  onEliminar,
  onAgregar,
  onReordenar,
}: DiagnosticsListProps) {
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Search modal state
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalModo, setModalModo] = useState<"agregar" | "editar">("agregar");
  const [modalEditIndex, setModalEditIndex] = useState<number | null>(null);

  const abrirModalAgregar = () => {
    setModalModo("agregar");
    setModalEditIndex(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (idx: number) => {
    setModalModo("editar");
    setModalEditIndex(idx);
    setModalAbierto(true);
  };

  const handleSeleccionModal = (codigo: string, descripcion: string) => {
    if (modalModo === "agregar") {
      onAgregar({
        codigo_cie10: codigo,
        descripcion,
        rol: "relacionado",
        alternativas: [],
        manual: true,
      });
      setNotificacion(`✅ Código ${codigo} agregado. Verifique que sea correcto.`);
      setTimeout(() => setNotificacion(null), 5000);
    } else if (modalModo === "editar" && modalEditIndex !== null) {
      onCambiar(modalEditIndex, { codigo, descripcion });
    }
  };

  const buscarCie10 = useCallback(async (termino: string): Promise<ResultadoBusqueda[]> => {
    const resultados = await buscarCie10Action(termino, 15);
    return resultados.map((r) => ({
      codigo: r.codigo,
      descripcion: r.descripcion,
      extra: r.nombre_capitulo ? `Cap. ${r.capitulo} — ${r.nombre_capitulo}` : undefined,
    }));
  }, []);

  const handleAgregar = () => {
    if (!nuevoCodigo.trim() || !nuevaDesc.trim()) {
      alert("Debes ingresar el código y la descripción.");
      return;
    }
    const codigo = nuevoCodigo.toUpperCase().trim();
    onAgregar({
      codigo_cie10: codigo,
      descripcion: nuevaDesc.trim(),
      rol: "relacionado",
      alternativas: [],
      manual: true,
    });
    setNotificacion(`✅ Código ${codigo} agregado manualmente. Verifique que sea correcto.`);
    setTimeout(() => setNotificacion(null), 5000);
    setNuevoCodigo("");
    setNuevaDesc("");
    setMostrarAgregar(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
      <div className="bg-medi-deep px-8 py-5 flex justify-between items-center text-white">
        <h4 className="font-bold text-lg uppercase tracking-wider">Diagnósticos (CIE-10)</h4>
      </div>
      <div className="p-4 bg-medi-light/10">
        {notificacion && (
          <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium animate-in fade-in slide-in-from-top-2">
            <span>{notificacion}</span>
            <button onClick={() => setNotificacion(null)} className="ml-auto text-amber-500 hover:text-amber-700 font-bold">✕</button>
          </div>
        )}
        {diagnosticos.map((diag, idx) => (
          <div
            key={idx}
            className={`bg-white mb-3 rounded-2xl border shadow-sm overflow-hidden transition-all hover:border-medi-primary relative group ${
              idx === 0 ? "border-blue-400 ring-1 ring-blue-200" : "border-medi-light/50"
            } ${diag.manual ? "border-l-4 border-l-amber-400" : ""}`}
          >
            <div className="flex items-center gap-4 p-5">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onReordenar(idx, idx - 1)}
                  disabled={idx === 0}
                  className="text-medi-dark/40 hover:text-medi-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
                  title="Mover arriba"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onReordenar(idx, idx + 1)}
                  disabled={idx === diagnosticos.length - 1}
                  className="text-medi-dark/40 hover:text-medi-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
                  title="Mover abajo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <div className="text-xl font-black text-medi-deep bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center flex items-center justify-center">
                {diag.codigo_cie10}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const rolKey = diag.rol as keyof typeof ROL_LABELS;
                    const rolInfo = ROL_LABELS[rolKey] || { label: "RELACIONADO", color: "bg-gray-200 text-gray-700" };
                    return (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${rolInfo.color}`}>
                        {rolInfo.label}
                      </span>
                    );
                  })()}
                  {idx === 0 && (
                    <span className="text-[9px] font-bold text-blue-600 uppercase">
                      → Dx Principal en RIPS
                    </span>
                  )}
                  {diag.manual && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Manual</span>
                  )}
                </div>
                <div className="text-lg font-semibold text-medi-deep italic">
                  {diag.descripcion}
                </div>
              </div>

              <button
                onClick={() => abrirModalEditar(idx)}
                className="bg-blue-50 text-blue-500 hover:bg-blue-100 p-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
                title="Buscar y reemplazar desde catálogo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => onEliminar(idx)}
                className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors shadow-sm"
                title="Eliminar este código"
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

            {diag.alternativas && diag.alternativas.length > 0 && (
              <details className="group/details border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                  <span className="group-open/details:rotate-90 transition-transform">▶</span> Ver alternativas
                  sugeridas (Reemplazar)
                </summary>
                <div className="p-4 pt-0 flex flex-col gap-2">
                  {diag.alternativas.map((alt, altIdx) => (
                    <button
                      key={altIdx}
                      onClick={() => onCambiar(idx, alt)}
                      className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-primary hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn"
                    >
                      <span className="font-black text-medi-dark group-hover/btn:text-medi-primary">
                        {alt.codigo}
                      </span>
                      <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                      <span className="ml-auto text-xs text-medi-primary opacity-0 group-hover/btn:opacity-100 font-bold">
                        Reemplazar por este ↑
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {/* Agregar diagnóstico manual */}
        <div className="mt-4 border-t border-medi-light/50 pt-4">
          <div className="flex gap-2">
            <button
              onClick={abrirModalAgregar}
              className="text-xs font-bold text-white bg-medi-primary flex items-center gap-2 hover:bg-medi-deep px-4 py-3 rounded-xl transition-colors flex-1 justify-center shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              + Agregar Diagnóstico (Buscar CIE-10)
            </button>
            <button
              onClick={() => setMostrarAgregar(!mostrarAgregar)}
              className="text-xs font-bold text-medi-primary flex items-center gap-2 hover:bg-medi-light/50 px-4 py-3 rounded-xl transition-colors border border-dashed border-medi-primary/50"
              title="Ingresar código manualmente"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manual
            </button>
          </div>
          {mostrarAgregar && (
            <div className="bg-white p-5 rounded-2xl border border-medi-primary/50 shadow-sm flex flex-col gap-3 mt-3">
              <h5 className="text-xs font-bold text-medi-dark uppercase mb-1">Añadir Nuevo CIE-10</h5>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Cód. Ej: I10"
                  value={nuevoCodigo}
                  onChange={(e) => setNuevoCodigo(e.target.value)}
                  className="p-3 border-2 border-medi-light rounded-xl text-sm sm:w-1/4 outline-none focus:border-medi-primary uppercase font-bold text-medi-deep"
                />
                <input
                  type="text"
                  placeholder="Descripción del diagnóstico..."
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  className="p-3 border-2 border-medi-light rounded-xl text-sm flex-grow outline-none focus:border-medi-primary font-medium text-medi-deep"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setMostrarAgregar(false)}
                  className="px-4 py-2 text-xs font-bold text-medi-dark hover:bg-medi-light/50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAgregar}
                  className="px-4 py-2 text-xs font-black bg-medi-primary text-white hover:bg-medi-deep rounded-xl transition-colors shadow-md"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ModalBusquedaCodigo
        tipo="cie10"
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onSeleccionar={handleSeleccionModal}
        buscar={buscarCie10}
      />
    </div>
  );
}
