"use client";

import React, { useEffect } from "react";
import type {
  ResultadoAnalisis,
  DiagnosticoUI,
  ProcedimientoUI,
  AlternativaIA,
  AtencionUI,
  DatosPaciente,
} from "@/lib/types/ui";
import DiagnosticsList from "@/components/DiagnosticsList";
import ProceduresList from "@/components/ProceduresList";
import PreInvoiceCard from "@/components/PreInvoiceCard";

interface AnalysisResultsProps {
  resultado: ResultadoAnalisis | null;
  datosPaciente: DatosPaciente;
  onResultadoChange: (resultado: ResultadoAnalisis) => void;
  onExportarExcel: () => void;
}

export default function AnalysisResults({
  resultado,
  datosPaciente,
  onResultadoChange,
  onExportarExcel,
}: AnalysisResultsProps) {
  // Cerrar todos los <details> cuando cambia el resultado
  useEffect(() => {
    const detalles = document.querySelectorAll("details");
    detalles.forEach((detalle) => detalle.removeAttribute("open"));
  }, [resultado]);

  if (!resultado) {
    return (
      <div className="h-[780px] bg-white border-2 border-dashed border-medi-light rounded-3xl flex flex-col items-center justify-center text-medi-dark/60 text-center px-10 shadow-sm">
        <p className="font-bold text-medi-dark text-lg">Esperando Análisis Clínico</p>
        <p className="text-sm mt-2">Diligencie los datos y la nota para generar el reporte técnico.</p>
      </div>
    );
  }

  const handleCambiarDiagnostico = (index: number, alternativa: AlternativaIA) => {
    const nuevoResultado = structuredClone(resultado);
    const diag = nuevoResultado.diagnosticos[index];
    if (!diag) return;
    diag.codigo_cie10 = alternativa.codigo;
    diag.descripcion = alternativa.descripcion;
    onResultadoChange(nuevoResultado);
  };

  const handleCambiarProcedimiento = (index: number, alternativa: AlternativaIA) => {
    const nuevoResultado = structuredClone(resultado);
    const proc = nuevoResultado.procedimientos[index];
    if (!proc) return;
    proc.codigo_cups = alternativa.codigo;
    proc.descripcion = alternativa.descripcion;
    onResultadoChange(nuevoResultado);
  };

  const handleEliminarDiagnostico = (index: number) => {
    if (confirm("¿Estás seguro de eliminar este diagnóstico?")) {
      const nuevoResultado = structuredClone(resultado);
      nuevoResultado.diagnosticos.splice(index, 1);
      onResultadoChange(nuevoResultado);
    }
  };

  const handleEliminarProcedimiento = (index: number) => {
    if (confirm("¿Estás seguro de eliminar este procedimiento?")) {
      const nuevoResultado = structuredClone(resultado);
      nuevoResultado.procedimientos.splice(index, 1);
      onResultadoChange(nuevoResultado);
    }
  };

  const handleAgregarDiagnostico = (diagnostico: DiagnosticoUI) => {
    const nuevoResultado = structuredClone(resultado);
    nuevoResultado.diagnosticos.push(diagnostico);
    onResultadoChange(nuevoResultado);
  };

  const handleReordenarDiagnostico = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= resultado.diagnosticos.length) return;
    const nuevoResultado = structuredClone(resultado);
    const [movido] = nuevoResultado.diagnosticos.splice(fromIndex, 1);
    if (!movido) return;
    nuevoResultado.diagnosticos.splice(toIndex, 0, movido);
    // Actualizar roles: el primero siempre es principal
    nuevoResultado.diagnosticos.forEach((d: DiagnosticoUI, i: number) => {
      if (i === 0) d.rol = "principal";
      else if (d.rol === "principal") d.rol = "relacionado";
    });
    onResultadoChange(nuevoResultado);
  };

  const handleAgregarProcedimiento = (procedimiento: ProcedimientoUI) => {
    const nuevoResultado = structuredClone(resultado);
    nuevoResultado.procedimientos.push(procedimiento);
    onResultadoChange(nuevoResultado);
  };

  const handleActualizarAtencion = (campo: keyof AtencionUI, valor: string | number) => {
    const nuevoResultado = structuredClone(resultado);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nuevoResultado.atencion as unknown as Record<string, string | number>)[campo] = valor;
    onResultadoChange(nuevoResultado);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
      <PreInvoiceCard
        atencion={resultado.atencion}
        datosPaciente={datosPaciente}
        onActualizarAtencion={handleActualizarAtencion}
        onExportarExcel={onExportarExcel}
        diagnosticos={resultado.diagnosticos}
        procedimientos={resultado.procedimientos}
      />

      <DiagnosticsList
        diagnosticos={resultado.diagnosticos}
        onCambiar={handleCambiarDiagnostico}
        onEliminar={handleEliminarDiagnostico}
        onAgregar={handleAgregarDiagnostico}
        onReordenar={handleReordenarDiagnostico}
      />

      <ProceduresList
        procedimientos={resultado.procedimientos}
        onCambiar={handleCambiarProcedimiento}
        onEliminar={handleEliminarProcedimiento}
        onAgregar={handleAgregarProcedimiento}
      />
    </div>
  );
}
