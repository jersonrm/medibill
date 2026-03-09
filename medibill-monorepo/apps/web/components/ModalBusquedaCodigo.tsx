"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface ResultadoBusqueda {
  codigo: string;
  descripcion: string;
  extra?: string;
}

interface ModalBusquedaCodigoProps {
  tipo: "cie10" | "cups";
  abierto: boolean;
  onCerrar: () => void;
  onSeleccionar: (codigo: string, descripcion: string) => void;
  buscar: (termino: string) => Promise<ResultadoBusqueda[]>;
}

export default function ModalBusquedaCodigo({
  tipo,
  abierto,
  onCerrar,
  onSeleccionar,
  buscar,
}: ModalBusquedaCodigoProps) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const titulo = tipo === "cie10" ? "Buscar Diagnóstico (CIE-10)" : "Buscar Procedimiento (CUPS)";
  const placeholder = tipo === "cie10" ? "Ej: hipertensión, diabetes, S42..." : "Ej: consulta, ecografía, 890201...";

  useEffect(() => {
    if (abierto) {
      setTermino("");
      setResultados([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto]);

  const ejecutarBusqueda = useCallback(
    async (texto: string) => {
      if (texto.trim().length < 2) {
        setResultados([]);
        return;
      }
      setBuscando(true);
      try {
        const res = await buscar(texto.trim());
        setResultados(res);
      } finally {
        setBuscando(false);
      }
    },
    [buscar]
  );

  const handleInput = (valor: string) => {
    setTermino(valor);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => ejecutarBusqueda(valor), 350);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCerrar();
    if (e.key === "Enter" && termino.trim().length >= 2) {
      if (timerRef.current) clearTimeout(timerRef.current);
      ejecutarBusqueda(termino);
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-medi-light/50 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-medi-deep px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button
            onClick={onCerrar}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-medi-light/30">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-medi-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={termino}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-4 py-3 border-2 border-medi-light rounded-xl text-sm outline-none focus:border-medi-primary font-medium text-medi-deep"
            />
            {buscando && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-medi-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px] max-h-[50vh]">
          {resultados.length === 0 && !buscando && termino.length >= 2 && (
            <div className="flex items-center justify-center h-32 text-medi-dark/50 text-sm">
              No se encontraron resultados para &quot;{termino}&quot;
            </div>
          )}
          {resultados.length === 0 && termino.length < 2 && (
            <div className="flex items-center justify-center h-32 text-medi-dark/40 text-sm">
              Escriba al menos 2 caracteres para buscar
            </div>
          )}
          {resultados.map((r, i) => (
            <button
              key={`${r.codigo}-${i}`}
              onClick={() => {
                onSeleccionar(r.codigo, r.descripcion);
                onCerrar();
              }}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-medi-light/40 transition-colors flex items-center gap-4 group border border-transparent hover:border-medi-primary/30"
            >
              <span className="font-black text-medi-deep bg-medi-light/40 px-3 py-1.5 rounded-lg min-w-[90px] text-center text-sm group-hover:bg-medi-primary group-hover:text-white transition-colors">
                {r.codigo}
              </span>
              <div className="flex-grow">
                <span className="font-medium text-medi-deep text-sm">{r.descripcion}</span>
                {r.extra && (
                  <span className="block text-[10px] text-medi-dark/50 mt-0.5">{r.extra}</span>
                )}
              </div>
              <span className="text-xs text-medi-primary opacity-0 group-hover:opacity-100 font-bold transition-opacity whitespace-nowrap">
                Seleccionar →
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-medi-light/30 px-6 py-3 flex justify-end">
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-xs font-bold text-medi-dark hover:bg-medi-light/50 rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
