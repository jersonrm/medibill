"use client";

import React from "react";
import { DEPARTAMENTOS, MUNICIPIOS } from "@/lib/data/divipola";
import type { DatosPaciente } from "@/lib/types/ui";

interface PatientFormProps {
  datos: DatosPaciente;
  onChange: <K extends keyof DatosPaciente>(campo: K, valor: DatosPaciente[K]) => void;
  onBuscarPaciente: () => void;
}

const LBL = "text-[11px] font-bold text-medi-dark uppercase ml-1";
const SEL = "p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep cursor-pointer";
const INP = "p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep";

export default function PatientForm({ datos, onChange, onBuscarPaciente }: PatientFormProps) {
  return (
    <>
      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="flex flex-col gap-1 col-span-1">
          <label className={LBL}>Tipo</label>
          <select value={datos.tipoDocumento} onChange={(e) => onChange("tipoDocumento", e.target.value)} className={SEL}>
            <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option>
            <option value="RC">RC</option><option value="PA">PA</option><option value="PT">PT</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Documento / Cédula</label>
          <input type="text" value={datos.cedulaPaciente} onChange={(e) => onChange("cedulaPaciente", e.target.value)}
            onBlur={onBuscarPaciente} onKeyDown={(e) => e.key === "Enter" && onBuscarPaciente()}
            placeholder="1.085..." className={`${INP} text-base`} />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Tipo Usuario (Régimen)</label>
          <select value={datos.tipoUsuario} onChange={(e) => onChange("tipoUsuario", e.target.value)} className={`${SEL} text-xs`}>
            <option value="01">01 - Contributivo</option><option value="02">02 - Subsidiado</option>
            <option value="03">03 - Especial / Excepción</option><option value="04">04 - Particular</option>
            <option value="05">05 - No asegurado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Fecha Nac.</label>
          <input type="date" value={datos.fechaNacimiento} onChange={(e) => onChange("fechaNacimiento", e.target.value)}
            min="1900-01-01" max={new Date().toISOString().split('T')[0]} className={INP} />
        </div>
        <div className="flex flex-col gap-1 col-span-1">
          <label className={LBL}>Sexo</label>
          <select value={datos.sexoPaciente} onChange={(e) => onChange("sexoPaciente", e.target.value)} className={SEL}>
            <option value="M">M</option><option value="F">F</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Nombre Completo</label>
          <input type="text" value={datos.nombrePaciente} onChange={(e) => onChange("nombrePaciente", e.target.value)} placeholder="Ej: Juan Pérez" className={INP} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className={LBL}>Departamento</label>
          <select value={datos.departamentoSeleccionado} onChange={(e) => { onChange("departamentoSeleccionado", e.target.value); onChange("codMunicipioResidencia", ""); }} className={`${SEL} text-xs`}>
            <option value="">-- Seleccionar --</option>
            {DEPARTAMENTOS.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LBL}>Municipio</label>
          <select value={datos.codMunicipioResidencia} onChange={(e) => onChange("codMunicipioResidencia", e.target.value)}
            disabled={!datos.departamentoSeleccionado} className={`${SEL} text-xs disabled:opacity-50`}>
            <option value="">-- Seleccionar --</option>
            {datos.departamentoSeleccionado && MUNICIPIOS[datos.departamentoSeleccionado]?.map((m) => (
              <option key={m.codigo} value={m.codigo}>{m.nombre} ({m.codigo})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LBL}>Zona</label>
          <select value={datos.codZonaTerritorial} onChange={(e) => onChange("codZonaTerritorial", e.target.value)} className={SEL}>
            <option value="U">Urbano</option><option value="R">Rural</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LBL}>Incapacidad</label>
          <select value={datos.incapacidad} onChange={(e) => onChange("incapacidad", e.target.value)} className={SEL}>
            <option value="NO">NO</option><option value="SI">SI</option>
          </select>
        </div>
      </div>
    </>
  );
}
