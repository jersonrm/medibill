"use client";

import React, { useState, useCallback } from "react";
import { DEPARTAMENTOS, MUNICIPIOS } from "@/lib/data/divipola";
import { buscarPacientePorDocumento } from "@/app/actions/pacientes";
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
  const [estadoPaciente, setEstadoPaciente] = useState<"idle" | "encontrado" | "nuevo">("idle");
  const [buscando, setBuscando] = useState(false);

  const handleBuscarPacienteDB = useCallback(async () => {
    if (datos.cedulaPaciente.trim().length < 5) {
      setEstadoPaciente("idle");
      onBuscarPaciente();
      return;
    }

    setBuscando(true);
    const paciente = await buscarPacientePorDocumento(
      datos.tipoDocumento,
      datos.cedulaPaciente
    );

    if (paciente) {
      setEstadoPaciente("encontrado");
      // Autocompletar campos
      const nombreCompleto = [
        paciente.primer_nombre,
        paciente.segundo_nombre,
        paciente.primer_apellido,
        paciente.segundo_apellido,
      ].filter(Boolean).join(" ");
      onChange("nombrePaciente", nombreCompleto);
      if (paciente.fecha_nacimiento) onChange("fechaNacimiento", paciente.fecha_nacimiento);
      if (paciente.sexo) onChange("sexoPaciente", paciente.sexo);
      if (paciente.tipo_usuario) onChange("tipoUsuario", paciente.tipo_usuario);
      if (paciente.zona_territorial) onChange("codZonaTerritorial", paciente.zona_territorial);
      if (paciente.departamento_residencia_codigo) {
        onChange("departamentoSeleccionado", paciente.departamento_residencia_codigo);
      }
      if (paciente.municipio_residencia_codigo) {
        onChange("codMunicipioResidencia", paciente.municipio_residencia_codigo);
      }
      if (paciente.eps_nombre) onChange("epsNombre", paciente.eps_nombre);
      if (paciente.eps_codigo) onChange("epsCodigo", paciente.eps_codigo);
      if (paciente.telefono) onChange("telefono", paciente.telefono);
      if (paciente.email) onChange("email", paciente.email);
      if (paciente.direccion) onChange("direccion", paciente.direccion);
    } else {
      setEstadoPaciente("nuevo");
    }

    setBuscando(false);
    // También ejecutar la búsqueda original en auditorías
    onBuscarPaciente();
  }, [datos.cedulaPaciente, datos.tipoDocumento, onChange, onBuscarPaciente]);

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
          <label className={LBL}>
            Documento / Cédula
            {buscando && <span className="ml-2 text-medi-primary animate-pulse">Buscando...</span>}
          </label>
          <input type="text" value={datos.cedulaPaciente} onChange={(e) => { onChange("cedulaPaciente", e.target.value); setEstadoPaciente("idle"); }}
            onBlur={handleBuscarPacienteDB} onKeyDown={(e) => e.key === "Enter" && handleBuscarPacienteDB()}
            placeholder="1.085..." className={`${INP} text-base`} />
          {/* Badge de estado del paciente */}
          {estadoPaciente === "encontrado" && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Paciente encontrado
            </span>
          )}
          {estadoPaciente === "nuevo" && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Paciente nuevo
            </span>
          )}
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

      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="flex flex-col gap-1 col-span-3">
          <label className={LBL}>EPS / Aseguradora <span className="text-red-500">*</span></label>
          <input type="text" value={datos.epsNombre} onChange={(e) => onChange("epsNombre", e.target.value)}
            placeholder="Ej: Nueva EPS, Sanitas, Emssanar..." className={INP} />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Código EPS</label>
          <input type="text" value={datos.epsCodigo} onChange={(e) => onChange("epsCodigo", e.target.value)}
            placeholder="Ej: EPS-S03" className={INP} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="flex flex-col gap-1 col-span-2">
          <label className={LBL}>Fecha Nac. <span className="text-red-500">*</span></label>
          <input type="date" value={datos.fechaNacimiento} onChange={(e) => onChange("fechaNacimiento", e.target.value)}
            min="1900-01-01" max={new Date().toISOString().split('T')[0]} required className={INP} />
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

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className={LBL}>Teléfono</label>
          <input type="tel" value={datos.telefono} onChange={(e) => onChange("telefono", e.target.value)}
            placeholder="Ej: 3001234567" className={INP} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LBL}>Email</label>
          <input type="email" value={datos.email} onChange={(e) => onChange("email", e.target.value)}
            placeholder="Ej: paciente@correo.com" className={INP} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LBL}>Dirección</label>
          <input type="text" value={datos.direccion} onChange={(e) => onChange("direccion", e.target.value)}
            placeholder="Ej: Calle 10 #20-30" className={INP} />
        </div>
      </div>
    </>
  );
}
