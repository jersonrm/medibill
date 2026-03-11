"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ProcedimientoUI, AlternativaIA, FuenteTarifa } from "@/lib/types/ui";
import type { ResultadoBusqueda } from "@/components/ModalBusquedaCodigo";
import { buscarCupsAction } from "@/app/actions/busqueda-codigos";

const ModalBusquedaCodigo = dynamic(() => import("@/components/ModalBusquedaCodigo"), { ssr: false });

interface ProceduresListProps {
  procedimientos: ProcedimientoUI[];
  onCambiar: (index: number, alternativa: AlternativaIA) => void;
  onEliminar: (index: number) => void;
  onAgregar: (procedimiento: ProcedimientoUI) => void;
  onActualizarTarifa: (index: number, valor: number, fuente: FuenteTarifa) => void;
}

export default function ProceduresList({
  procedimientos,
  onCambiar,
  onEliminar,
  onAgregar,
  onActualizarTarifa,
}: ProceduresListProps) {
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [nuevaCant, setNuevaCant] = useState(1);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [editandoTarifa, setEditandoTarifa] = useState<number | null>(null);
  const [valorTarifaTemp, setValorTarifaTemp] = useState("");

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
        codigo_cups: codigo,
        descripcion,
        cantidad: 1,
        alternativas: [],
        manual: true,
      });
      setNotificacion(`✅ Procedimiento ${codigo} agregado. Verifique que sea correcto.`);
      setTimeout(() => setNotificacion(null), 5000);
    } else if (modalModo === "editar" && modalEditIndex !== null) {
      onCambiar(modalEditIndex, { codigo, descripcion });
    }
  };

  const buscarCups = useCallback(async (termino: string): Promise<ResultadoBusqueda[]> => {
    const resultados = await buscarCupsAction(termino, 15);
    return resultados.map((r) => ({
      codigo: r.codigo,
      descripcion: r.descripcion,
      extra: r.seccion_nombre || undefined,
    }));
  }, []);

  const handleAgregar = () => {
    if (!nuevoCodigo.trim() || !nuevaDesc.trim() || nuevaCant < 1) {
      alert("Debes ingresar el código, descripción y una cantidad válida.");
      return;
    }
    const codigo = nuevoCodigo.toUpperCase().trim();
    onAgregar({
      codigo_cups: codigo,
      descripcion: nuevaDesc.trim(),
      cantidad: nuevaCant,
      alternativas: [],
      manual: true,
    });
    setNotificacion(`✅ Código ${codigo} agregado manualmente. Verifique que sea correcto.`);
    setTimeout(() => setNotificacion(null), 5000);
    setNuevoCodigo("");
    setNuevaDesc("");
    setNuevaCant(1);
    setMostrarAgregar(false);
  };

  const handleGuardarTarifa = (idx: number) => {
    const valor = parseFloat(valorTarifaTemp);
    if (isNaN(valor) || valor < 0) return;
    onActualizarTarifa(idx, valor, "manual");
    setEditandoTarifa(null);
    setValorTarifaTemp("");
  };

  const subtotal = procedimientos.reduce((s, p) => {
    const val = p.valor_unitario || p.valor_procedimiento || 0;
    return s + val * (p.cantidad || 1);
  }, 0);

  return (
    <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
      <div className="bg-medi-primary px-8 py-5 flex justify-between items-center text-white">
        <h4 className="font-bold text-lg uppercase tracking-wider">Procedimientos (CUPS)</h4>
        {subtotal > 0 && (
          <span className="text-sm font-black bg-white/20 px-4 py-1.5 rounded-full">
            Subtotal: ${subtotal.toLocaleString("es-CO")}
          </span>
        )}
      </div>
      <div className="p-4 bg-medi-light/10">
        {notificacion && (
          <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium animate-in fade-in slide-in-from-top-2">
            <span>{notificacion}</span>
            <button onClick={() => setNotificacion(null)} className="ml-auto text-amber-500 hover:text-amber-700 font-bold">✕</button>
          </div>
        )}
        {procedimientos.map((proc, idx) => (
          <div
            key={idx}
            className={`bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-accent relative group ${proc.manual ? "border-l-4 border-l-amber-400" : ""}`}
          >
            <div className="flex items-center gap-4 sm:gap-6 p-5">
              <div className="text-xl font-black text-medi-primary bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center flex items-center justify-center">
                {proc.codigo_cups}
              </div>
              <div className="flex-grow">
                <div className="text-lg font-semibold text-medi-deep italic">
                  {proc.descripcion}
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
              <div className="text-sm font-black text-white bg-medi-primary px-4 py-2 rounded-full border border-medi-primary/50 whitespace-nowrap flex-shrink-0">
                Cant: {proc.cantidad}
              </div>
              {proc.manual && (
                <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Manual</span>
              )}
              {proc.valor_unitario != null && proc.valor_unitario > 0 ? (
                <div className="flex flex-col items-end flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditandoTarifa(idx);
                      setValorTarifaTemp(String(proc.valor_unitario));
                    }}
                    className="text-sm font-black text-medi-deep hover:text-medi-primary transition-colors cursor-pointer"
                    title="Clic para editar tarifa"
                  >
                    ${proc.valor_unitario.toLocaleString("es-CO")}
                  </button>
                  {proc.fuente_tarifa && (
                    <span className={`text-[8px] font-bold uppercase ${
                      proc.fuente_tarifa === "pactada" ? "text-green-600" :
                      proc.fuente_tarifa === "propia" ? "text-blue-600" : "text-gray-500"
                    }`}>
                      {proc.fuente_tarifa === "pactada" ? "Tarifa pactada" :
                       proc.fuente_tarifa === "propia" ? "Tarifa propia" : "Manual"}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditandoTarifa(idx);
                    setValorTarifaTemp("");
                  }}
                  className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors flex-shrink-0"
                >
                  Sin tarifa — Ingresar
                </button>
              )}
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

            {/* Editor inline de tarifa */}
            {editandoTarifa === idx && (
              <div className="border-t border-medi-light/50 bg-blue-50/50 px-5 py-3 flex items-center gap-3 animate-in fade-in">
                <span className="text-xs font-bold text-medi-dark/70">Tarifa unitaria:</span>
                <span className="text-medi-dark/50">$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  autoFocus
                  value={valorTarifaTemp}
                  onChange={(e) => setValorTarifaTemp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGuardarTarifa(idx); if (e.key === "Escape") setEditandoTarifa(null); }}
                  placeholder="Ej: 50000"
                  className="p-2 border-2 border-medi-light rounded-lg text-sm w-36 outline-none focus:border-medi-primary font-bold text-medi-deep"
                />
                <button
                  onClick={() => handleGuardarTarifa(idx)}
                  className="px-3 py-1.5 text-xs font-black bg-medi-primary text-white rounded-lg hover:bg-medi-deep transition-colors"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditandoTarifa(null)}
                  className="px-3 py-1.5 text-xs font-bold text-medi-dark/60 hover:bg-medi-light/50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

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
          <div className="flex gap-2">
            <button
              onClick={abrirModalAgregar}
              className="text-xs font-bold text-white bg-medi-primary flex items-center gap-2 hover:bg-medi-deep px-4 py-3 rounded-xl transition-colors flex-1 justify-center shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              + Agregar Procedimiento (Buscar CUPS)
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

      <ModalBusquedaCodigo
        tipo="cups"
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onSeleccionar={handleSeleccionModal}
        buscar={buscarCups}
      />
    </div>
  );
}
