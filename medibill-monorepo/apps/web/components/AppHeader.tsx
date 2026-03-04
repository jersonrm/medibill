"use client";

import React from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/login/actions";

interface AppHeaderProps {
  onNuevaConsulta: () => void;
}

export default function AppHeader({ onNuevaConsulta }: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-medi-light px-8 py-4 shadow-sm sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-medi-primary text-white p-2 rounded-lg shadow-lg">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-medi-deep">Medibill</h1>
            <p className="text-[10px] text-medi-dark uppercase tracking-widest font-bold">Health-Tech Pasto</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={onNuevaConsulta}
            className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
          >
            + Nueva Consulta
          </button>
          <Link
            href="/glosas"
            className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
          >
            Gestión Glosas
          </Link>
          <Link
            href="/validar-factura"
            className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
          >
            Validar Factura
          </Link>
          <Link
            href="/configuracion/acuerdos"
            className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
          >
            Acuerdos
          </Link>
          <Link
            href="/configuracion"
            className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
          >
            Tarifas
          </Link>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-sm font-bold text-medi-dark opacity-70 hover:text-red-500 py-2 transition-colors"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
