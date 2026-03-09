"use client";

import React from "react";
import { ESTADO_INFO, type FacturaData } from "./types";

interface FacturaHeaderProps {
  factura: FacturaData;
  editMode: boolean;
  onIniciarEdicion: () => void;
  onVolver: () => void;
}

export default function FacturaHeader({ factura, editMode, onIniciarEdicion, onVolver }: FacturaHeaderProps) {
  const est = ESTADO_INFO[factura.estado] ?? { label: "Desconocido", className: "bg-gray-100 text-gray-500 border-gray-300", step: 0 };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={onVolver} className="text-xs text-medi-primary font-bold mb-2 hover:underline">← Volver a facturas</button>
          <h1 className="text-3xl font-black text-medi-deep">
            {factura.num_factura.startsWith("BORR-")
              ? <>Borrador <span className="text-medi-dark/40 text-lg">(sin número asignado)</span></>
              : <>Factura {factura.num_factura}</>
            }
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {factura.estado === "borrador" && !editMode && (
            <button onClick={onIniciarEdicion} className="px-4 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 rounded-full hover:bg-amber-100 transition-colors">
              ✏️ Editar
            </button>
          )}
          <span className={`text-sm font-black uppercase px-5 py-2 rounded-full border ${est.className}`}>{est.label}</span>
        </div>
      </div>

      {/* Timeline del estado */}
      <div className="flex items-center gap-2 mb-8">
        {["Borrador", "Aprobada", "Descargada", "Radicada", "Pagada"].map((step, i) => (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-2 ${est.step >= i ? "text-medi-primary" : "text-medi-dark/20"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                est.step >= i ? "bg-medi-primary text-white" : "bg-medi-light/50 text-medi-dark/40"
              }`}>{i + 1}</div>
              <span className="text-xs font-bold">{step}</span>
            </div>
            {i < 4 && <div className={`flex-grow h-0.5 ${est.step > i ? "bg-medi-primary" : "bg-medi-light"}`} />}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
