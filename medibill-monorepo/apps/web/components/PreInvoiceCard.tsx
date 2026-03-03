"use client";

import React from "react";
import type { AtencionUI, DatosPaciente } from "@/lib/types/ui";
import {
  DICCIONARIO_MODALIDAD,
  DICCIONARIO_CAUSAS,
  DICCIONARIO_TIPO_DIAG,
  DICCIONARIO_TIPO_SERVICIO,
} from "@/lib/types/ui";
import DownloadRipsButton from "@/components/DownloadRipsButton";

interface PreInvoiceCardProps {
  atencion: AtencionUI;
  datosPaciente: DatosPaciente;
  onActualizarAtencion: (campo: keyof AtencionUI, valor: string | number) => void;
  onExportarExcel: () => void;
  diagnosticos: { codigo_cie10: string; descripcion: string; alternativas: { codigo: string; descripcion: string }[] }[];
  procedimientos: { codigo_cups: string; descripcion: string; cantidad: number; alternativas: { codigo: string; descripcion: string }[] }[];
}

export default function PreInvoiceCard({
  atencion,
  datosPaciente,
  onActualizarAtencion,
  onExportarExcel,
  diagnosticos,
  procedimientos,
}: PreInvoiceCardProps) {
  return (
    <div className="bg-medi-deep text-white p-6 rounded-3xl shadow-xl border-t-4 border-medi-accent transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1 w-2/3">
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">
            Liquidación (Editable)
          </h3>

          {/* Valor Consulta */}
          <div className="flex items-center">
            <span className="text-4xl font-black mr-1">$</span>
            <input
              type="number"
              value={atencion.valor_consulta}
              onChange={(e) => onActualizarAtencion("valor_consulta", parseInt(e.target.value) || 0)}
              className="bg-transparent text-4xl font-black outline-none w-full border-b border-transparent focus:border-white/30 transition-colors"
              title="Valor Total Consulta"
            />
          </div>

          {/* Cuota Moderadora */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold opacity-80 uppercase">Cuota Mod: $</span>
            <input
              type="number"
              value={atencion.valor_cuota}
              onChange={(e) => onActualizarAtencion("valor_cuota", parseInt(e.target.value) || 0)}
              className="bg-transparent text-[10px] font-bold outline-none border-b border-transparent focus:border-white/30 w-24"
              title="Cuota Moderadora / Copago"
            />
          </div>

          {/* Neto */}
          <p className="text-[10px] font-bold mt-2 opacity-100 uppercase text-medi-accent">
            Neto a Facturar: ${((atencion.valor_consulta - atencion.valor_cuota) || 0).toLocaleString()}{" "}
            (Cód. 890201)
          </p>
        </div>

        {/* Modalidad */}
        <div className="text-right flex flex-col gap-2">
          <select
            value={atencion.modalidad}
            onChange={(e) => onActualizarAtencion("modalidad", e.target.value)}
            className="bg-white/10 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-medi-accent cursor-pointer appearance-none text-center"
          >
            {Object.entries(DICCIONARIO_MODALIDAD).map(([key, value]) => (
              <option key={key} value={key} className="text-medi-deep bg-white">
                {value}
              </option>
            ))}
          </select>
          {/* Tipo de Servicio */}
          <select
            value={atencion.tipo_servicio || "consulta"}
            onChange={(e) => onActualizarAtencion("tipo_servicio", e.target.value)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-medi-accent cursor-pointer appearance-none text-center ${
              atencion.tipo_servicio === "urgencias"
                ? "bg-red-500/80 text-white ring-1 ring-red-300"
                : "bg-white/10 text-white"
            }`}
          >
            {Object.entries(DICCIONARIO_TIPO_SERVICIO).map(([key, value]) => (
              <option key={key} value={key} className="text-medi-deep bg-white">
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10 my-4">
        {/* Causa */}
        <div>
          <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Causa</p>
          <select
            value={atencion.causa}
            onChange={(e) => onActualizarAtencion("causa", e.target.value)}
            className="bg-transparent text-xs font-bold text-white w-full outline-none border-b border-transparent focus:border-white/30 cursor-pointer"
          >
            {Object.entries(DICCIONARIO_CAUSAS).map(([key, value]) => (
              <option key={key} value={key} className="text-medi-deep bg-white">
                {value}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo Diagnóstico */}
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Tipo Diagnóstico</p>
          <select
            value={atencion.tipo_diagnostico}
            onChange={(e) => onActualizarAtencion("tipo_diagnostico", e.target.value)}
            className="bg-transparent text-xs font-bold text-white w-full outline-none border-b border-transparent focus:border-white/30 cursor-pointer text-right"
          >
            {Object.entries(DICCIONARIO_TIPO_DIAG).map(([key, value]) => (
              <option key={key} value={key} className="text-medi-deep bg-white">
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <DownloadRipsButton
          tipoDocumentoPaciente={datosPaciente.tipoDocumento as "CC"}
          documentoPaciente={datosPaciente.cedulaPaciente}
          fechaNacimientoPaciente={datosPaciente.fechaNacimiento}
          sexoPaciente={datosPaciente.sexoPaciente as "M"}
          tipoUsuarioPaciente={datosPaciente.tipoUsuario as "01"}
          codPaisResidencia={datosPaciente.codPaisResidencia}
          codMunicipioResidencia={datosPaciente.codMunicipioResidencia}
          codZonaTerritorialResidencia={datosPaciente.codZonaTerritorial as "U"}
          incapacidad={datosPaciente.incapacidad as "NO"}
          diagnosticos={diagnosticos}
          procedimientos={procedimientos}
          atencionIA={atencion}
        />
        <button
          onClick={onExportarExcel}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-lg transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          EXCEL
        </button>
      </div>
    </div>
  );
}
