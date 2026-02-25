"use client";

import React, { useState, useEffect } from "react";
import { clasificarTextoMedico, obtenerHistorialAuditorias, buscarPacientePorCedula } from "./actions";
import { cerrarSesion } from "./login/actions";
import DownloadRipsButton from "../components/DownloadRipsButton"; 
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

  useEffect(() => {
    // Si el resultado cambia, buscamos todas las pestañas <details> y las cerramos
    const detalles = document.querySelectorAll('details');
    detalles.forEach(detalle => detalle.removeAttribute('open'));
  }, [resultado]);

  const cargarHistorial = async () => {
    const datos = await obtenerHistorialAuditorias();
    setHistorial(datos);
  };

  const handleBuscarPaciente = async () => {
    if (cedulaPaciente.trim().length < 5) return;
    const infoPaciente = await buscarPacientePorCedula(cedulaPaciente);
    if (infoPaciente) {
      setNombrePaciente(infoPaciente.nombre);
      setHistorial(infoPaciente.historial);
    } else {
      await cargarHistorial();
    }
  };

  const nuevaConsulta = async () => {
    setNota("");
    setNombrePaciente("");
    setCedulaPaciente("");
    setResultado(null);
    await cargarHistorial();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerarRIPS = async () => {
    if (!nota.trim()) return;
    setCargando(true);
    setResultado(null);
    
    const respuesta = await clasificarTextoMedico(nota, nombrePaciente, cedulaPaciente);
    
    if (respuesta.exito) {
      setResultado(respuesta.datos);
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
    <div className="min-h-screen bg-medi-light/30 text-medi-deep font-sans pb-20">
      <header className="bg-white border-b border-medi-light px-8 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-medi-primary text-white p-2 rounded-lg shadow-lg shadow-medi-light">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-medi-deep">Medibill</h1>
              <p className="text-[10px] text-medi-dark uppercase tracking-widest font-bold font-sans">Health-Tech Pasto</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={nuevaConsulta}
              className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all"
            >
              + Nueva Consulta
            </button>
            <form action={cerrarSesion}>
              <button type="submit" className="text-sm font-bold text-medi-dark opacity-70 hover:opacity-100 hover:text-red-500 transition-colors py-2">
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="flex flex-col gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-lg shadow-medi-light/50 border border-medi-light/50 flex flex-col h-[780px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-medi-deep flex items-center gap-3 tracking-tight">
                <div className="w-2 h-8 bg-medi-accent rounded-full"></div>
                Identificación y Nota
              </h2>
              <button onClick={nuevaConsulta} className="text-xs font-bold text-medi-dark opacity-60 hover:opacity-100 uppercase tracking-tighter transition-colors">
                Limpiar campos
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-medi-dark uppercase ml-1">Documento / Cédula</label>
                <input 
                  type="text"
                  value={cedulaPaciente}
                  onChange={(e) => setCedulaPaciente(e.target.value)}
                  onBlur={handleBuscarPaciente}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscarPaciente()}
                  placeholder="1.085..."
                  className="p-4 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-lg text-medi-deep"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-medi-dark uppercase ml-1">Nombre Completo</label>
                <input 
                  type="text"
                  value={nombrePaciente}
                  onChange={(e) => setNombrePaciente(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="p-4 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-lg text-medi-deep"
                />
              </div>
            </div>
            
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="flex-grow w-full p-6 text-xl border-2 border-medi-light rounded-2xl outline-none focus:border-medi-primary transition-all text-medi-deep leading-relaxed bg-white font-medium shadow-inner"
              placeholder="Describa la atención aquí..."
            ></textarea>
            
            <div className="grid grid-cols-4 gap-4 mt-8">
              <button
                onClick={handleGenerarRIPS}
                disabled={cargando || !nota.trim()}
                className="col-span-3 bg-medi-primary hover:bg-medi-deep text-white font-black text-xl py-5 rounded-2xl shadow-xl shadow-medi-primary/30 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {cargando ? "Analizando..." : "Ejecutar Análisis RIPS"}
              </button>
              <button
                onClick={nuevaConsulta}
                className="col-span-1 bg-medi-light/40 hover:bg-medi-light text-medi-dark font-bold py-5 rounded-2xl transition-all active:scale-[0.98]"
                title="Limpiar todo"
              >
                <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-md border border-medi-light/50">
            <h3 className="text-base font-bold text-medi-dark uppercase mb-6 tracking-widest flex items-center justify-between opacity-80">
              {cedulaPaciente && nombrePaciente ? (
                <span className="text-medi-primary">Historial del Paciente</span>
              ) : (
                <span>Auditorías Recientes</span>
              )}
            </h3>
            <div className="flex flex-col gap-4">
              {historial.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-medi-light rounded-xl font-medium text-medi-dark/60 italic">
                  No hay registros para mostrar.
                </div>
              ) : (
                historial.map((item, i) => (
                  <div key={i} onClick={() => cargarAuditoriaAntigua(item)} className="p-5 border border-medi-light rounded-xl hover:bg-medi-light/20 cursor-pointer transition-all group">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-medi-deep bg-medi-light/50 px-3 py-1.5 rounded-lg border border-medi-light">
                          {item.resultado_ia.diagnosticos?.[0]?.codigo_cie10 || "S/C"}
                        </span>
                        {item.resultado_ia.diagnosticos?.length > 1 && (
                          <span className="text-[11px] font-extrabold text-medi-primary bg-white px-2 py-1 rounded-md border-2 border-medi-light uppercase">+ {item.resultado_ia.diagnosticos.length - 1} DIAG</span>
                        )}
                        {item.resultado_ia.procedimientos?.length > 0 && (
                          <span className="text-[11px] font-extrabold text-medi-primary bg-white px-2 py-1 rounded-md border-2 border-medi-light uppercase">+ {item.resultado_ia.procedimientos.length} PROC</span>
                        )}
                      </div>
                      <span className="text-xs text-medi-dark/60 font-bold">{new Date(item.creado_en).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[13px] text-medi-deep line-clamp-2">"{item.nota_original}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          {!resultado ? (
            <div className="h-[780px] bg-white border-2 border-dashed border-medi-light rounded-3xl flex flex-col items-center justify-center text-medi-dark/60 text-center px-10 shadow-sm">
              <p className="font-bold text-medi-dark text-lg">Esperando Análisis Clínico</p>
              <p className="text-sm mt-2">Diligencie los datos del paciente y la nota médica para generar el reporte técnico.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-white p-6 rounded-3xl shadow-md border border-medi-light/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-medi-dark/70 uppercase mb-1">Calidad RIPS</h3>
                  <p className="text-5xl font-black text-medi-deep">92<span className="text-medi-light text-2xl">/100</span></p>
                </div>
                <div className="flex gap-3">
                  <DownloadRipsButton 
                    documentoPaciente={cedulaPaciente}
                    diagnosticos={resultado.diagnosticos || []}
                    procedimientos={resultado.procedimientos || []}
                  />
                  {/* EL BOTÓN DE EXCEL CON VERDE VIBRANTE */}
                  <button onClick={exportarExcel} className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-lg shadow-green-500/30 transition-all active:scale-95">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel
                  </button>
                </div>
              </div>

              {/* TARJETA DIAGNÓSTICOS (Encabezado Azul Noche - El más oscuro) */}
              <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden mb-4">
                <div className="bg-medi-deep px-8 py-5 flex justify-between items-center text-white">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Diagnósticos (CIE-10)</h4>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 opacity-70">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <div className="p-4 bg-medi-light/10">
                  {resultado.diagnosticos.map((diag: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-primary">
                      <div className="flex items-center gap-6 p-5">
                        <div className="text-xl font-black text-medi-deep bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center">{diag.codigo_cie10}</div>
                        <div className="text-lg font-semibold text-medi-deep italic flex-grow">{diag.descripcion}</div>
                      </div>
                      
                      {diag.alternativas && diag.alternativas.length > 0 && (
                        <details className="group border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                          <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                            <span className="group-open:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {diag.alternativas.map((alt: any, altIdx: number) => (
                              <button 
                                key={altIdx} 
                                onClick={() => cambiarDiagnostico(idx, alt)}
                                className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-primary hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn"
                              >
                                <span className="font-black text-medi-dark group-hover/btn:text-medi-primary">{alt.codigo}</span>
                                <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-medi-primary opacity-0 group-hover/btn:opacity-100 font-bold">Usar este ↑</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SEPARADOR VISUAL */}
              <div className="flex items-center gap-4 my-2">
                <div className="h-px bg-medi-light flex-grow"></div>
                <span className="text-xs font-bold text-medi-dark opacity-60 uppercase tracking-widest">Procedimientos y Servicios</span>
                <div className="h-px bg-medi-light flex-grow"></div>
              </div>

              {/* TARJETA PROCEDIMIENTOS (Encabezado Azul Rey) */}
              <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
                <div className="bg-medi-primary px-8 py-5 flex justify-between items-center text-white border-b border-medi-light/50">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Procedimientos (CUPS)</h4>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 opacity-70">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 21h15.006A2.25 2.25 0 0021 18.75V3.75A2.25 2.25 0 0018.75 1.5h-13.5A2.25 2.25 0 003 3.75z" />
                  </svg>
                </div>
                <div className="p-4 bg-medi-light/10">
                  {resultado.procedimientos.map((proc: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-accent">
                      <div className="flex items-center gap-6 p-5">
                        <div className="text-xl font-black text-medi-primary bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center">{proc.codigo_cups}</div>
                        <div className="flex-grow text-lg font-semibold text-medi-deep italic">{proc.descripcion}</div>
                        <div className="text-sm font-black text-white bg-medi-primary px-4 py-2 rounded-full border border-medi-primary/50">Cant: {proc.cantidad}</div>
                      </div>
                      
                      {proc.alternativas && proc.alternativas.length > 0 && (
                        <details className="group border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                          <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                            <span className="group-open:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {proc.alternativas.map((alt: any, altIdx: number) => (
                              <button 
                                key={altIdx} 
                                onClick={() => cambiarProcedimiento(idx, alt)}
                                className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-accent hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn"
                              >
                                <span className="font-black text-medi-dark group-hover/btn:text-medi-accent">{alt.codigo}</span>
                                <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-medi-accent opacity-0 group-hover/btn:opacity-100 font-bold">Usar este ↑</span>
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