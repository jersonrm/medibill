"use client";

import React, { useState, useEffect } from "react";
// IMPORTANTE: Asegúrate de tener exportada buscarPacientePorCedula en tu actions.ts
import { clasificarTextoMedico, obtenerHistorialAuditorias, buscarPacientePorCedula } from "./actions";
import { cerrarSesion } from "./login/actions";
import * as XLSX from "xlsx";

export default function MedibillHome() {
  const [nota, setNota] = useState("");
  const [nombrePaciente, setNombrePaciente] = useState("");
  const [cedulaPaciente, setCedulaPaciente] = useState("");
  
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    const inicializar = async () => {
      await cargarHistorial();
    };
    inicializar();
  }, []);

  const cargarHistorial = async () => {
    const datos = await obtenerHistorialAuditorias();
    setHistorial(datos);
  };

  // NUEVA FUNCIÓN: Busca al paciente al terminar de escribir la cédula
  const handleBuscarPaciente = async () => {
    if (cedulaPaciente.trim().length < 5) return; // Evitar búsquedas con 1 o 2 números

    const infoPaciente = await buscarPacientePorCedula(cedulaPaciente);

    if (infoPaciente) {
      // Autocompleta el nombre
      setNombrePaciente(infoPaciente.nombre);
      // Reemplaza el historial general por el historial exclusivo de este paciente
      setHistorial(infoPaciente.historial);
    } else {
      // Si es nuevo o no lo encuentra, vuelve a cargar el historial general
      await cargarHistorial();
    }
  };

  const nuevaConsulta = async () => {
    setNota("");
    setNombrePaciente("");
    setCedulaPaciente("");
    setResultado(null);
    await cargarHistorial(); // Volvemos a mostrar las últimas 5 generales
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerarRIPS = async () => {
    if (!nota.trim()) return;
    setCargando(true);
    setResultado(null);
    
    const respuesta = await clasificarTextoMedico(nota, nombrePaciente, cedulaPaciente);
    
    if (respuesta.exito) {
      setResultado(respuesta.datos);
      // Si el paciente tiene cédula, recargamos su historial específico, si no, el general
      if (cedulaPaciente.trim().length >= 5) {
        await handleBuscarPaciente();
      } else {
        await cargarHistorial();
      }
    } else {
      alert("Error: " + respuesta.error);
    }
    setCargando(false);
  };

  const cargarAuditoriaAntigua = (auditoria: any) => {
    setNota(auditoria.nota_original);
    setResultado(auditoria.resultado_ia);
    setNombrePaciente(auditoria.nombre_paciente || "");
    setCedulaPaciente(auditoria.documento_paciente || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cambiarDiagnostico = (indexBase: number, nuevaAlternativa: any) => {
    const nuevoResultado = { ...resultado };
    nuevoResultado.diagnosticos[indexBase].codigo_cie10 = nuevaAlternativa.codigo;
    nuevoResultado.diagnosticos[indexBase].descripcion = nuevaAlternativa.descripcion;
    setResultado(nuevoResultado);
  };

  const cambiarProcedimiento = (indexBase: number, nuevaAlternativa: any) => {
    const nuevoResultado = { ...resultado };
    nuevoResultado.procedimientos[indexBase].codigo_cups = nuevaAlternativa.codigo;
    nuevoResultado.procedimientos[indexBase].descripcion = nuevaAlternativa.descripcion;
    setResultado(nuevoResultado);
  };

  const exportarExcel = () => {
    if (!resultado) return;
    const titulo = [["MEDIBILL - REPORTE DE AUDITORÍA TÉCNICA RIPS"]];
    const infoGeneral = [
      ["Referencia:", "Resolución 2275 de 2023"],
      ["Fecha de Reporte:", new Date().toLocaleDateString()],
      ["Auditor:", "Jerson Reyes Muñoz"],
      [""],
      ["DATOS DEL PACIENTE"],
      ["Nombre:", nombrePaciente || "No especificado"],
      ["Identificación:", cedulaPaciente || "No especificado"],
      ["Score:", "92/100"],
      [""]
    ];
    const tablaDiag = [["DIAGNÓSTICOS (CIE-10)"], ["CÓDIGO", "DESCRIPCIÓN"], ...resultado.diagnosticos.map((d: any) => [d.codigo_cie10, d.descripcion])];
    const tablaProc = [[""], ["PROCEDIMIENTOS (CUPS)"], ["CÓDIGO", "DESCRIPCIÓN", "CANT."], ...resultado.procedimientos.map((p: any) => [p.codigo_cups, p.descripcion, p.cantidad])];
    
    const ws = XLSX.utils.aoa_to_sheet([...titulo, [""], ...infoGeneral, ...tablaDiag, ...tablaProc]);
    ws['!cols'] = [{ wch: 20 }, { wch: 65 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, `Reporte_${cedulaPaciente || 'RIPS'}_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-200">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Medibill</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-sans">Health-Tech Pasto</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={nuevaConsulta}
              className="px-4 py-2 text-sm font-bold text-blue-600 border-2 border-blue-100 rounded-xl hover:bg-blue-50 transition-all"
            >
              + Nueva Consulta
            </button>
            <form action={cerrarSesion}>
              <button type="submit" className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors py-2">
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="flex flex-col gap-8">
          {/* Identificación y Nota */}
          <div className="bg-white p-8 rounded-3xl shadow-md border border-slate-200 flex flex-col h-[780px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                Identificación y Nota
              </h2>
              <button onClick={nuevaConsulta} className="text-xs font-bold text-slate-400 hover:text-red-400 uppercase tracking-tighter transition-colors">
                Limpiar campos
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Documento / Cédula</label>
                <input 
                  type="text"
                  value={cedulaPaciente}
                  onChange={(e) => setCedulaPaciente(e.target.value)}
                  onBlur={handleBuscarPaciente}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscarPaciente()}
                  placeholder="1.085..."
                  className="p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-lg"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nombre Completo</label>
                <input 
                  type="text"
                  value={nombrePaciente}
                  onChange={(e) => setNombrePaciente(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="p-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-lg"
                />
              </div>
            </div>
            
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="flex-grow w-full p-6 text-xl border-2 border-slate-100 rounded-2xl outline-none transition-all text-slate-700 leading-relaxed bg-slate-50/30 font-medium"
              placeholder="Describa la atención aquí..."
            ></textarea>
            
            <div className="grid grid-cols-4 gap-4 mt-8">
              <button
                onClick={handleGenerarRIPS}
                disabled={cargando || !nota.trim()}
                className="col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98]"
              >
                {cargando ? "Analizando..." : "Ejecutar Análisis RIPS"}
              </button>
              <button
                onClick={nuevaConsulta}
                className="col-span-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-5 rounded-2xl transition-all active:scale-[0.98]"
                title="Limpiar todo"
              >
                <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Historial Dinámico */}
          <div className="bg-white p-8 rounded-3xl shadow-md border border-slate-200">
            <h3 className="text-base font-bold text-slate-500 uppercase mb-6 tracking-widest flex items-center justify-between">
              {cedulaPaciente && nombrePaciente ? (
                <span className="text-blue-600">Historial del Paciente</span>
              ) : (
                <span>Auditorías Recientes</span>
              )}
            </h3>
            <div className="flex flex-col gap-4">
              {historial.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl font-medium text-slate-400 italic">
                  No hay registros para mostrar.
                </div>
              ) : (
                historial.map((item, i) => (
                  <div key={i} onClick={() => cargarAuditoriaAntigua(item)} className="p-5 border border-slate-200 rounded-xl hover:bg-blue-50 cursor-pointer transition-all group">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200">
                          {item.resultado_ia.diagnosticos?.[0]?.codigo_cie10 || "S/C"}
                        </span>
                        {item.resultado_ia.diagnosticos?.length > 1 && (
                          <span className="text-[11px] font-extrabold text-blue-600 bg-white px-2 py-1 rounded-md border-2 border-blue-100 uppercase">+ {item.resultado_ia.diagnosticos.length - 1} DIAG</span>
                        )}
                        {item.resultado_ia.procedimientos?.length > 0 && (
                          <span className="text-[11px] font-extrabold text-teal-600 bg-white px-2 py-1 rounded-md border-2 border-teal-100 uppercase">+ {item.resultado_ia.procedimientos.length} PROC</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-bold">{new Date(item.creado_en).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[13px] text-slate-700 line-clamp-2">"{item.nota_original}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Columna Derecha: Resultados */}
        <section className="flex flex-col gap-8">
          {!resultado ? (
            <div className="h-[780px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 text-center px-10">
              <p className="font-bold text-slate-600 text-lg">Esperando Análisis Clínico</p>
              <p className="text-sm mt-2">Diligencie los datos del paciente y la nota médica para generar el reporte técnico.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-1">Calidad RIPS</h3>
                  <p className="text-5xl font-black text-slate-900">92<span className="text-slate-200 text-2xl">/100</span></p>
                </div>
                <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar Excel
                </button>
              </div>

              {/* Diagnósticos con Alternativas */}
              <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
                <div className="bg-[#1E40AF] px-8 py-5 flex justify-between items-center text-white">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Diagnósticos (CIE-10)</h4>
                </div>
                <div className="p-4 bg-slate-50/30">
                  {resultado.diagnosticos.map((diag: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-blue-200">
                      <div className="flex items-center gap-6 p-5">
                        <div className="text-xl font-black text-blue-800 bg-blue-50 px-5 py-3 rounded-xl min-w-[100px] text-center shadow-inner">{diag.codigo_cie10}</div>
                        <div className="text-lg font-semibold text-slate-800 italic flex-grow">{diag.descripcion}</div>
                      </div>
                      
                      {diag.alternativas && diag.alternativas.length > 0 && (
                        <details className="group border-t border-slate-100 bg-slate-50 cursor-pointer">
                          <summary className="text-xs font-bold text-blue-500 uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <span className="group-open:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {diag.alternativas.map((alt: any, altIdx: number) => (
                              <button 
                                key={altIdx} 
                                onClick={() => cambiarDiagnostico(idx, alt)}
                                className="text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm flex gap-4 items-center group/btn"
                              >
                                <span className="font-black text-slate-500 group-hover/btn:text-blue-700">{alt.codigo}</span>
                                <span className="font-medium text-slate-600">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-blue-600 opacity-0 group-hover/btn:opacity-100 font-bold">Usar este ↑</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Procedimientos con Alternativas */}
              <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
                <div className="bg-[#0F766E] px-8 py-5 flex justify-between items-center text-white">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Procedimientos (CUPS)</h4>
                </div>
                <div className="p-4 bg-slate-50/30">
                  {resultado.procedimientos.map((proc: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-teal-200">
                      <div className="flex items-center gap-6 p-5">
                        <div className="text-xl font-black text-teal-800 bg-teal-50 px-5 py-3 rounded-xl min-w-[100px] text-center shadow-inner">{proc.codigo_cups}</div>
                        <div className="flex-grow text-lg font-semibold text-slate-800 italic">{proc.descripcion}</div>
                        <div className="text-sm font-black text-teal-600 bg-teal-50 px-4 py-2 rounded-full border border-teal-100">Cant: {proc.cantidad}</div>
                      </div>
                      
                      {proc.alternativas && proc.alternativas.length > 0 && (
                        <details className="group border-t border-slate-100 bg-slate-50 cursor-pointer">
                          <summary className="text-xs font-bold text-teal-600 uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <span className="group-open:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {proc.alternativas.map((alt: any, altIdx: number) => (
                              <button 
                                key={altIdx} 
                                onClick={() => cambiarProcedimiento(idx, alt)}
                                className="text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-sm flex gap-4 items-center group/btn"
                              >
                                <span className="font-black text-slate-500 group-hover/btn:text-teal-700">{alt.codigo}</span>
                                <span className="font-medium text-slate-600">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-teal-600 opacity-0 group-hover/btn:opacity-100 font-bold">Usar este ↑</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
}