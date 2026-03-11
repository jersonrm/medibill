"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { clasificarTextoMedico, obtenerHistorialAuditorias, buscarPacientePorCedula, obtenerSiguienteNumeroFactura } from "@/app/actions";
import type {
  DatosPaciente,
  ResultadoAnalisis,
  AuditoriaHistorial,
} from "@/lib/types/ui";
import { DATOS_PACIENTE_DEFAULT, ATENCION_DEFAULT } from "@/lib/types/ui";

import PatientForm from "@/components/PatientForm";
import ClinicalNoteInput from "@/components/ClinicalNoteInput";
import PatientHistory from "@/components/PatientHistory";
import AnalysisResults from "@/components/AnalysisResults";
import AlertaCoherenciaPaciente from "@/components/AlertaCoherenciaPaciente";
import { detectarIncoherenciasPaciente } from "@/lib/validar-coherencia-paciente";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useBeforeUnload } from "@/lib/hooks/use-before-unload";

export default function MedibillApp() {
  const [nota, setNota] = useState("");
  const [datosPaciente, setDatosPaciente] = useState<DatosPaciente>(DATOS_PACIENTE_DEFAULT);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [historial, setHistorial] = useState<AuditoriaHistorial[]>([]);
  const [numFactura, setNumFactura] = useState("");
  const [trialMensaje, setTrialMensaje] = useState<string | null>(null);

  // Protección contra cierre accidental con datos sin guardar
  useBeforeUnload(nota.trim().length > 0 && resultado === null);

  // Debounce de la nota para no recalcular validación en cada keystroke
  const notaDebounced = useDebouncedValue(nota, 500);

  // Validación cruzada nota vs datos del paciente (Nivel 1 — pre-IA)
  const alertasCoherencia = useMemo(
    () =>
      detectarIncoherenciasPaciente(
        notaDebounced,
        datosPaciente.sexoPaciente,
        datosPaciente.fechaNacimiento,
        datosPaciente.nombrePaciente
      ),
    [notaDebounced, datosPaciente.sexoPaciente, datosPaciente.fechaNacimiento, datosPaciente.nombrePaciente]
  );

  useEffect(() => { cargarHistorial(); }, []);

  const cargarHistorial = async () => {
    const datos = await obtenerHistorialAuditorias();
    setHistorial(datos as AuditoriaHistorial[]);
  };

  const handleBuscarPaciente = useCallback(async () => {
    if (datosPaciente.cedulaPaciente.trim().length < 5) return;
    const info = await buscarPacientePorCedula(datosPaciente.cedulaPaciente);
    if (info) {
      setDatosPaciente((prev) => ({ ...prev, nombrePaciente: info.nombre }));
      setHistorial(info.historial as AuditoriaHistorial[]);
    } else {
      await cargarHistorial();
    }
  }, [datosPaciente.cedulaPaciente]);

  const nuevaConsulta = async () => {
    setNota("");
    setDatosPaciente(DATOS_PACIENTE_DEFAULT);
    setResultado(null);
    setNumFactura("");
    await cargarHistorial();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerarRIPS = async () => {
    if (!nota.trim()) return;
    setCargando(true);
    setResultado(null);
    setTrialMensaje(null);
    const [resp, facturaInfo] = await Promise.all([
      clasificarTextoMedico(nota, datosPaciente.nombrePaciente, datosPaciente.cedulaPaciente),
      obtenerSiguienteNumeroFactura(),
    ]);
    if (facturaInfo.error) {
      alert("⚠️ " + facturaInfo.error);
    }
    setNumFactura(facturaInfo.numero);
    if (resp.success) {
      const d = { ...resp.datos } as ResultadoAnalisis;
      if (!d.atencion) d.atencion = { ...ATENCION_DEFAULT };
      if (!d.diagnosticos) d.diagnosticos = [];
      if (!d.procedimientos) d.procedimientos = [];
      setResultado(d);
      if ('trial_parcial' in resp && resp.trial_parcial) {
        setTrialMensaje((resp as { trial_mensaje?: string }).trial_mensaje || "Activa tu plan para ver los códigos completos.");
      } else if ('trial_restante' in resp) {
        const restante = (resp as { trial_restante?: number }).trial_restante ?? 0;
        setTrialMensaje(`Período de prueba: te quedan ${restante} clasificaciones completas.`);
      }
      datosPaciente.cedulaPaciente.trim().length >= 5 ? await handleBuscarPaciente() : await cargarHistorial();
    } else {
      alert("Error: " + resp.error);
    }
    setCargando(false);
  };

  const cargarAuditoriaAntigua = (a: AuditoriaHistorial) => {
    setNota(a.nota_original || "");
    const r = a.resultado_ia ? { ...a.resultado_ia } : ({} as ResultadoAnalisis);
    if (!r.atencion) r.atencion = { ...ATENCION_DEFAULT };
    if (!r.diagnosticos) r.diagnosticos = [];
    if (!r.procedimientos) r.procedimientos = [];
    setResultado(r);
    setDatosPaciente({ ...DATOS_PACIENTE_DEFAULT, nombrePaciente: a.nombre_paciente || "", cedulaPaciente: a.documento_paciente || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDatosPacienteChange = <K extends keyof DatosPaciente>(campo: K, valor: DatosPaciente[K]) => {
    setDatosPaciente((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="min-h-screen bg-medi-light/30 text-medi-deep font-sans pb-20">
      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Form */}
        <section className="flex flex-col gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-lg border border-medi-light/50 flex flex-col min-h-[780px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-medi-deep flex items-center gap-3 tracking-tight">
                <div className="w-2 h-8 bg-medi-accent rounded-full" /> Identificación y Nota
              </h2>
              <button onClick={nuevaConsulta} className="text-xs font-bold text-medi-dark opacity-60 hover:opacity-100 uppercase tracking-tighter transition-colors">
                Limpiar campos
              </button>
            </div>
            <PatientForm datos={datosPaciente} onChange={handleDatosPacienteChange} onBuscarPaciente={handleBuscarPaciente} />
            <AlertaCoherenciaPaciente alertas={alertasCoherencia} />
            <ClinicalNoteInput nota={nota} cargando={cargando} onNotaChange={setNota} onEjecutarAnalisis={handleGenerarRIPS} onNuevaConsulta={nuevaConsulta} />
          </div>
          <PatientHistory historial={historial} cedulaPaciente={datosPaciente.cedulaPaciente} nombrePaciente={datosPaciente.nombrePaciente} onCargarAuditoria={cargarAuditoriaAntigua} />
        </section>

        {/* Right: Results */}
        <section className="flex flex-col gap-8">
          {trialMensaje && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-sm font-medium text-amber-800">{trialMensaje}</p>
                <a
                  href="/configuracion/suscripcion"
                  className="mt-1 inline-block text-xs font-bold text-medi-primary hover:text-medi-accent transition-colors"
                >
                  Ver planes →
                </a>
              </div>
            </div>
          )}
          <AnalysisResults resultado={resultado} datosPaciente={datosPaciente} numFactura={numFactura} onResultadoChange={setResultado} nota={nota} />
        </section>
      </main>
    </div>
  );
}
