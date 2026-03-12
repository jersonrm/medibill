"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { AtencionUI, DatosPaciente } from "@/lib/types/ui";
import {
  DICCIONARIO_MODALIDAD,
  DICCIONARIO_CAUSAS,
  DICCIONARIO_TIPO_DIAG,
  DICCIONARIO_TIPO_SERVICIO,
} from "@/lib/types/ui";
import { buscarCupsAction } from "@/app/actions/busqueda-codigos";

const ModalBusquedaCodigo = dynamic(() => import("@/components/ModalBusquedaCodigo"), { ssr: false });

/* Diccionario de códigos de consulta por especialidad */
const CODIGOS_CONSULTA: Record<string, string> = {
  "890201": "Medicina General",
  "890241": "Cardiología",
  "890261": "Urología",
  "890271": "Neumología",
  "890281": "Ginecología / Obstetricia",
  "890291": "Dermatología",
  "890301": "Pediatría",
  "890311": "Oftalmología",
  "890321": "Otorrinolaringología",
  "890331": "Neurología",
  "890341": "Cirugía General",
  "890351": "Medicina Interna",
  "890361": "Anestesiología",
  "890371": "Psiquiatría",
  "890381": "Ortopedia / Traumatología",
  "890391": "Fisiatría / Rehabilitación",
  "890411": "Gastroenterología",
  "890421": "Endocrinología",
  "890431": "Nefrología",
  "890441": "Reumatología",
  "890451": "Cirugía Plástica",
  "890461": "Neurocirugía",
  "890471": "Cirugía Cardiovascular",
  "890481": "Oncología",
  "890491": "Hematología",
  "890501": "Infectología",
  "890701": "Odontología General",
  "890702": "Ortodoncia",
  "890703": "Endodoncia",
  "890704": "Periodoncia",
  "890705": "Cirugía Oral",
};

/* ── Custom Dropdown para la card oscura ── */
function CardDropdown({
  value,
  options,
  onChange,
  className = "",
  align = "left",
  disabled,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (val: string) => void;
  className?: string;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = options[value] || value;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide outline-none focus:ring-2 focus:ring-medi-accent transition-all w-full justify-center ${disabled ? "opacity-70 cursor-default" : "cursor-pointer"}`}
      >
        <span className="truncate">{label}</span>
        <svg className={`w-3 h-3 opacity-60 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute z-50 mt-1.5 min-w-[180px] bg-medi-deep/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[240px] overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}>
          {Object.entries(options).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                key === value
                  ? "bg-medi-accent/20 text-medi-accent"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PreInvoiceCardProps {
  atencion: AtencionUI;
  datosPaciente: DatosPaciente;
  numFactura: string;
  numObligacion?: string;
  onActualizarAtencion: (campo: keyof AtencionUI, valor: string | number) => void;
  diagnosticos: { codigo_cie10: string; descripcion: string; alternativas: { codigo: string; descripcion: string }[] }[];
  procedimientos: { codigo_cups: string; descripcion: string; cantidad: number; valor_unitario?: number; valor_procedimiento?: number; diagnostico_asociado?: string; numAutorizacion?: string; alternativas: { codigo: string; descripcion: string }[] }[];
  readOnly?: boolean;
}

export default function PreInvoiceCard({
  atencion,
  datosPaciente,
  numFactura,
  numObligacion,
  onActualizarAtencion,
  diagnosticos,
  procedimientos,
  readOnly,
}: PreInvoiceCardProps) {
  const [modalCupsAbierto, setModalCupsAbierto] = useState(false);
  const [dropdownCupsAbierto, setDropdownCupsAbierto] = useState(false);
  const dropdownCupsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownCupsRef.current && !dropdownCupsRef.current.contains(e.target as Node)) setDropdownCupsAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buscarCups = useCallback(async (termino: string) => {
    const res = await buscarCupsAction(termino);
    return res.map((r) => ({ codigo: r.codigo, descripcion: r.descripcion }));
  }, []);

  const codConsulta = atencion.codConsultaCups || "890201";
  const nombreEspecialidad = CODIGOS_CONSULTA[codConsulta] || codConsulta;

  return (
    <div className="bg-medi-deep text-white p-6 rounded-3xl shadow-xl border-t-4 border-medi-accent transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1 w-2/3">
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">
            {readOnly ? "Liquidación (Solo lectura)" : "Liquidación (Editable)"}
          </h3>

          {/* Valor Consulta */}
          <div className="flex items-center">
            <span className="text-4xl font-black mr-1">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={atencion.valor_consulta === 0 ? "" : atencion.valor_consulta}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                onActualizarAtencion("valor_consulta", raw === "" ? 0 : parseInt(raw, 10));
              }}
              placeholder="0"
              readOnly={readOnly}
              className={`bg-transparent text-4xl font-black outline-none w-full border-b border-transparent focus:border-white/30 transition-colors ${readOnly ? "opacity-70 cursor-default" : ""}`}
              title="Valor Total Consulta"
            />
          </div>

          {/* Cuota Moderadora */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold opacity-80 uppercase">Cuota Mod: $</span>
            <input
              type="text"
              inputMode="numeric"
              value={atencion.valor_cuota === 0 ? "" : atencion.valor_cuota}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                onActualizarAtencion("valor_cuota", raw === "" ? 0 : parseInt(raw, 10));
              }}
              placeholder="0"
              readOnly={readOnly}
              className={`bg-transparent text-[10px] font-bold outline-none border-b border-transparent focus:border-white/30 w-24 ${readOnly ? "opacity-70 cursor-default" : ""}`}
              title="Cuota Moderadora / Copago"
            />
          </div>

          {/* Neto + Código consulta */}
          <p className="text-[10px] font-bold mt-2 uppercase text-medi-accent">
            Neto a Facturar: ${((atencion.valor_consulta - atencion.valor_cuota) || 0).toLocaleString()}
          </p>
          <div ref={dropdownCupsRef} className="relative mt-1.5">
            <button
              type="button"
              onClick={() => !readOnly && setDropdownCupsAbierto(!dropdownCupsAbierto)}
              className={`flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold outline-none focus:ring-2 focus:ring-medi-accent transition-all ${readOnly ? "opacity-70 cursor-default" : "cursor-pointer"}`}
            >
              <span className="font-black">{codConsulta}</span>
              <span className="opacity-70 truncate max-w-[140px]">{nombreEspecialidad}</span>
              <svg className={`w-2.5 h-2.5 opacity-60 flex-shrink-0 transition-transform ${dropdownCupsAbierto ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownCupsAbierto && (
              <div className="absolute z-50 mt-1.5 w-[280px] bg-medi-deep/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl py-1.5 max-h-[280px] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setDropdownCupsAbierto(false); setModalCupsAbierto(true); }}
                  className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-medi-accent hover:bg-medi-accent/10 flex items-center gap-2 border-b border-white/10 mb-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Buscar otro código CUPS…
                </button>
                {Object.entries(CODIGOS_CONSULTA).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onActualizarAtencion("codConsultaCups", key); setDropdownCupsAbierto(false); }}
                    className={`w-full text-left px-4 py-2 text-[11px] transition-colors ${
                      key === codConsulta
                        ? "bg-medi-accent/20 text-medi-accent font-black"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="font-black mr-2">{key}</span>
                    <span className="opacity-70">{val}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modalidad */}
        <div className="text-right flex flex-col gap-2">
          <CardDropdown
            value={atencion.modalidad}
            options={DICCIONARIO_MODALIDAD}
            onChange={(val) => onActualizarAtencion("modalidad", val)}
            align="right"
            disabled={readOnly}
          />
          {/* Tipo de Servicio */}
          {atencion.tipo_servicio === "urgencias" ? (
            <CardDropdown
              value={atencion.tipo_servicio}
              options={DICCIONARIO_TIPO_SERVICIO}
              onChange={(val) => onActualizarAtencion("tipo_servicio", val)}
              align="right"
              className="[&>button]:bg-red-500/80 [&>button]:ring-1 [&>button]:ring-red-300 [&>button]:hover:bg-red-500"
              disabled={readOnly}
            />
          ) : (
            <CardDropdown
              value={atencion.tipo_servicio || "consulta"}
              options={DICCIONARIO_TIPO_SERVICIO}
              onChange={(val) => onActualizarAtencion("tipo_servicio", val)}
              align="right"
              disabled={readOnly}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10 my-4">
        {/* Causa */}
        <div>
          <p className="text-[10px] uppercase opacity-50 font-bold mb-1.5">Causa</p>
          <CardDropdown
            value={atencion.causa}
            options={DICCIONARIO_CAUSAS}
            onChange={(val) => onActualizarAtencion("causa", val)}
            className="[&>button]:bg-white/5 [&>button]:rounded-xl [&>button]:justify-start [&>button]:text-left"
            disabled={readOnly}
          />
        </div>

        {/* Tipo Diagnóstico */}
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-50 font-bold mb-1.5">Tipo Diagnóstico</p>
          <CardDropdown
            value={atencion.tipo_diagnostico}
            options={DICCIONARIO_TIPO_DIAG}
            onChange={(val) => onActualizarAtencion("tipo_diagnostico", val)}
            align="right"
            className="[&>button]:bg-white/5 [&>button]:rounded-xl"
            disabled={readOnly}
          />
        </div>
      </div>

      <ModalBusquedaCodigo
        tipo="cups"
        abierto={modalCupsAbierto}
        onCerrar={() => setModalCupsAbierto(false)}
        onSeleccionar={(codigo) => { onActualizarAtencion("codConsultaCups", codigo); setModalCupsAbierto(false); }}
        buscar={buscarCups}
      />
    </div>
  );
}
