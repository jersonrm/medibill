"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { clasificarTextoMedico, obtenerHistorialAuditorias, buscarPacientePorCedula } from "./actions";
import { cerrarSesion } from "./login/actions";
import DownloadRipsButton from "../components/DownloadRipsButton"; 
import * as XLSX from "xlsx";

// DICCIONARIOS DE RESOLUCIÓN 2275 PARA LA INTERFAZ
const DICCIONARIO_CAUSAS: Record<string, string> = {
  "15": "Enfermedad General",
  "01": "Accidente de Trabajo",
  "02": "Accidente de Tránsito",
  "03": "Accidente Rábico",
  "04": "Accidente Ofídico",
  "05": "Otro Accidente",
  "06": "Evento Catastrófico",
  "07": "Lesión por Agresión",
  "08": "Lesión Autoinfligida",
  "09": "Sospecha Maltrato Físico",
  "10": "Sospecha Abuso Sexual",
  "11": "Sospecha Violencia Sexual",
  "12": "Sospecha Maltrato Emocional",
  "13": "Enfermedad Profesional"
};

const DICCIONARIO_TIPO_DIAG: Record<string, string> = {
  "01": "Impresión Diagnóstica",
  "02": "Confirmado Nuevo",
  "03": "Confirmado Repetido"
};

const DICCIONARIO_MODALIDAD: Record<string, string> = {
  "01": "Presencial",
  "02": "Extramural",
  "03": "Hogar",
  "04": "Telemedicina"
};

export default function MedibillHome() {
  const [nota, setNota] = useState("");
  const [nombrePaciente, setNombrePaciente] = useState("");
  const [cedulaPaciente, setCedulaPaciente] = useState("");
  
  const [tipoDocumento, setTipoDocumento] = useState("CC");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexoPaciente, setSexoPaciente] = useState("M");
  const [tipoUsuario, setTipoUsuario] = useState("01"); 
  
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);

  const [mostrarAgregarDiag, setMostrarAgregarDiag] = useState(false);
  const [nuevoDiagCodigo, setNuevoDiagCodigo] = useState("");
  const [nuevoDiagDesc, setNuevoDiagDesc] = useState("");

  const [mostrarAgregarProc, setMostrarAgregarProc] = useState(false);
  const [nuevoProcCodigo, setNuevoProcCodigo] = useState("");
  const [nuevoProcDesc, setNuevoProcDesc] = useState("");
  const [nuevoProcCant, setNuevoProcCant] = useState(1);

  useEffect(() => {
    const inicializar = async () => {
      await cargarHistorial();
    };
    inicializar();
  }, []);

  useEffect(() => {
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
    setTipoDocumento("CC");
    setFechaNacimiento("");
    setSexoPaciente("M");
    setTipoUsuario("01");
    setResultado(null);
    setMostrarAgregarDiag(false);
    setMostrarAgregarProc(false);
    await cargarHistorial();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerarRIPS = async () => {
    if (!nota.trim()) return;
    setCargando(true);
    setResultado(null);
    setMostrarAgregarDiag(false);
    setMostrarAgregarProc(false);
    
    const respuesta = await clasificarTextoMedico(nota, nombrePaciente, cedulaPaciente);
    
    if (respuesta.exito) {
      const datosSeguros = { ...respuesta.datos };
      if (!datosSeguros.atencion) {
        datosSeguros.atencion = { modalidad: "01", causa: "15", finalidad: "10", tipo_diagnostico: "01", valor_consulta: 50000, valor_cuota: 0 };
      }
      if (!datosSeguros.diagnosticos) datosSeguros.diagnosticos = [];
      if (!datosSeguros.procedimientos) datosSeguros.procedimientos = [];

      setResultado(datosSeguros);
      
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
    setNota(auditoria.nota_original || "");
    setMostrarAgregarDiag(false);
    setMostrarAgregarProc(false);
    
    const resultadoNormalizado = auditoria.resultado_ia ? { ...auditoria.resultado_ia } : {};
    
    if (!resultadoNormalizado.atencion) {
      resultadoNormalizado.atencion = { modalidad: "01", causa: "15", finalidad: "10", tipo_diagnostico: "01", valor_consulta: 50000, valor_cuota: 0 };
    }
    if (!resultadoNormalizado.diagnosticos) resultadoNormalizado.diagnosticos = [];
    if (!resultadoNormalizado.procedimientos) resultadoNormalizado.procedimientos = [];
    
    setResultado(resultadoNormalizado);
    setNombrePaciente(auditoria.nombre_paciente || "");
    setCedulaPaciente(auditoria.documento_paciente || "");
    setTipoDocumento("CC"); 
    setFechaNacimiento("");
    setSexoPaciente("M");
    setTipoUsuario("01");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cambiarDiagnostico = (indexBase: number, nuevaAlternativa: any) => {
    if (!resultado || !resultado.diagnosticos) return;
    const nuevoResultado = { ...resultado };
    nuevoResultado.diagnosticos[indexBase].codigo_cie10 = nuevaAlternativa.codigo;
    nuevoResultado.diagnosticos[indexBase].descripcion = nuevaAlternativa.descripcion;
    setResultado(nuevoResultado);
  };

  const cambiarProcedimiento = (indexBase: number, nuevaAlternativa: any) => {
    if (!resultado || !resultado.procedimientos) return;
    const nuevoResultado = { ...resultado };
    nuevoResultado.procedimientos[indexBase].codigo_cups = nuevaAlternativa.codigo;
    nuevoResultado.procedimientos[indexBase].descripcion = nuevaAlternativa.descripcion;
    setResultado(nuevoResultado);
  };

  const eliminarDiagnostico = (index: number) => {
    if (!resultado || !resultado.diagnosticos) return;
    if (confirm("¿Estás seguro de eliminar este diagnóstico?")) {
      const nuevoResultado = { ...resultado };
      nuevoResultado.diagnosticos.splice(index, 1);
      setResultado(nuevoResultado);
    }
  };

  const eliminarProcedimiento = (index: number) => {
    if (!resultado || !resultado.procedimientos) return;
    if (confirm("¿Estás seguro de eliminar este procedimiento?")) {
      const nuevoResultado = { ...resultado };
      nuevoResultado.procedimientos.splice(index, 1);
      setResultado(nuevoResultado);
    }
  };

  const agregarDiagnosticoManual = () => {
    if (!nuevoDiagCodigo.trim() || !nuevoDiagDesc.trim()) {
      alert("Debes ingresar el código y la descripción.");
      return;
    }
    const nuevoResultado = { ...resultado };
    nuevoResultado.diagnosticos.push({
      codigo_cie10: nuevoDiagCodigo.toUpperCase().trim(),
      descripcion: nuevoDiagDesc.trim(),
      alternativas: []
    });
    setResultado(nuevoResultado);
    setNuevoDiagCodigo("");
    setNuevoDiagDesc("");
    setMostrarAgregarDiag(false);
  };

  const agregarProcedimientoManual = () => {
    if (!nuevoProcCodigo.trim() || !nuevoProcDesc.trim() || nuevoProcCant < 1) {
      alert("Debes ingresar el código, descripción y una cantidad válida.");
      return;
    }
    const nuevoResultado = { ...resultado };
    nuevoResultado.procedimientos.push({
      codigo_cups: nuevoProcCodigo.toUpperCase().trim(),
      descripcion: nuevoProcDesc.trim(),
      cantidad: nuevoProcCant,
      alternativas: []
    });
    setResultado(nuevoResultado);
    setNuevoProcCodigo("");
    setNuevoProcDesc("");
    setNuevoProcCant(1);
    setMostrarAgregarProc(false);
  };

  // 🟢 NUEVA FUNCIÓN: Actualizar datos de Atención y Liquidación
  const actualizarAtencion = (campo: string, valor: any) => {
    if (!resultado || !resultado.atencion) return;
    const nuevoResultado = { ...resultado };
    nuevoResultado.atencion[campo] = valor;
    setResultado(nuevoResultado);
  };

  const exportarExcel = () => {
    if (!resultado) return;
    const wb = XLSX.utils.book_new();
    const titulo = [["MEDIBILL - REPORTE DE AUDITORÍA TÉCNICA RIPS"]];
    const infoGeneral = [
      ["Referencia:", "Resolución 2275 de 2023"],
      ["Fecha de Reporte:", new Date().toLocaleDateString()],
      ["Auditor:", "Sistema Inteligente Medibill"],
      [""],
      ["DATOS DEL PACIENTE"],
      ["Nombre:", nombrePaciente || "No especificado"],
      ["Identificación:", cedulaPaciente || "No especificado"],
      [""]
    ];
    
    const diagSeguros = resultado.diagnosticos || [];
    const procSeguros = resultado.procedimientos || [];
    
    const tablaDiag = [["DIAGNÓSTICOS (CIE-10)"], ["CÓDIGO", "DESCRIPCIÓN"], ...diagSeguros.map((d: any) => [d.codigo_cie10, d.descripcion])];
    const tablaProc = [[""], ["PROCEDIMIENTOS (CUPS)"], ["CÓDIGO", "DESCRIPCIÓN", "CANT."], ...procSeguros.map((p: any) => [p.codigo_cups, p.descripcion, p.cantidad])];
    
    const ws = XLSX.utils.aoa_to_sheet([...titulo, [""], ...infoGeneral, ...tablaDiag, ...tablaProc]);
    ws['!cols'] = [{ wch: 20 }, { wch: 65 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, `Reporte_Medibill_${cedulaPaciente || 'RIPS'}_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-medi-light/30 text-medi-deep font-sans pb-20">
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
          <div className="flex gap-4">
            <button onClick={nuevaConsulta} className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all">+ Nueva Consulta</button>
            <Link href="/configuracion">
              <button className="px-4 py-2 text-sm font-bold text-medi-primary border-2 border-medi-light rounded-xl hover:bg-medi-light/50 transition-all mr-2">
                Tarifas
              </button>
            </Link>
            <form action={cerrarSesion}><button type="submit" className="text-sm font-bold text-medi-dark opacity-70 hover:text-red-500 py-2 transition-colors">Cerrar Sesión</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* ============================== */}
        {/* LADO IZQUIERDO: FORMULARIO */}
        {/* ============================== */}
        <section className="flex flex-col gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-lg border border-medi-light/50 flex flex-col min-h-[780px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-medi-deep flex items-center gap-3 tracking-tight">
                <div className="w-2 h-8 bg-medi-accent rounded-full"></div> Identificación y Nota
              </h2>
              <button onClick={nuevaConsulta} className="text-xs font-bold text-medi-dark opacity-60 hover:opacity-100 uppercase tracking-tighter transition-colors">
                Limpiar campos
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-3">
              <div className="flex flex-col gap-1 col-span-1">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Tipo</label>
                <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep cursor-pointer">
                  <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option><option value="RC">RC</option><option value="PA">PA</option><option value="PT">PT</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Documento / Cédula</label>
                <input type="text" value={cedulaPaciente} onChange={(e) => setCedulaPaciente(e.target.value)} onBlur={handleBuscarPaciente} onKeyDown={(e) => e.key === 'Enter' && handleBuscarPaciente()} placeholder="1.085..." className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-base text-medi-deep" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Tipo Usuario (Régimen)</label>
                <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value)} className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-xs text-medi-deep cursor-pointer">
                  <option value="01">01 - Contributivo</option><option value="02">02 - Subsidiado</option><option value="03">03 - Especial / Excepción</option><option value="04">04 - Particular</option><option value="05">05 - No asegurado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-6">
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Fecha Nac.</label>
                <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep" />
              </div>
              <div className="flex flex-col gap-1 col-span-1">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Sexo</label>
                <select value={sexoPaciente} onChange={(e) => setSexoPaciente(e.target.value)} className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep cursor-pointer"><option value="M">M</option><option value="F">F</option></select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Nombre Completo</label>
                <input type="text" value={nombrePaciente} onChange={(e) => setNombrePaciente(e.target.value)} placeholder="Ej: Juan Pérez" className="p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-semibold text-sm text-medi-deep" />
              </div>
            </div>
            
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} className="flex-grow w-full p-6 text-xl border-2 border-medi-light rounded-2xl outline-none focus:border-medi-primary transition-all text-medi-deep leading-relaxed bg-white font-medium shadow-inner min-h-[200px]" placeholder="Describa la atención aquí..."></textarea>
            
            <div className="grid grid-cols-4 gap-4 mt-6">
              <button onClick={handleGenerarRIPS} disabled={cargando || !nota.trim()} className="col-span-3 bg-medi-primary hover:bg-medi-deep text-white font-black text-xl py-5 rounded-2xl shadow-xl shadow-medi-primary/30 transition-all active:scale-[0.98] disabled:opacity-70">
                {cargando ? "Analizando..." : "Ejecutar Análisis RIPS"}
              </button>
              <button onClick={nuevaConsulta} className="col-span-1 bg-medi-light/40 hover:bg-medi-light text-medi-dark font-bold py-5 rounded-2xl transition-all active:scale-[0.98]" title="Limpiar todo">
                <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          {/* HISTORIAL DEL PACIENTE */}
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

        {/* ============================== */}
        {/* LADO DERECHO: RESULTADOS */}
        {/* ============================== */}
        <section className="flex flex-col gap-8">
          {!resultado ? (
            <div className="h-[780px] bg-white border-2 border-dashed border-medi-light rounded-3xl flex flex-col items-center justify-center text-medi-dark/60 text-center px-10 shadow-sm">
              <p className="font-bold text-medi-dark text-lg">Esperando Análisis Clínico</p>
              <p className="text-sm mt-2">Diligencie los datos y la nota para generar el reporte técnico.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
              
              {/* TARJETA DE LIQUIDACIÓN SUGERIDA (PRE-FACTURA) - 🟢 AHORA ES EDITABLE */}
              <div className="bg-medi-deep text-white p-6 rounded-3xl shadow-xl border-t-4 border-medi-accent transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1 w-2/3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">Liquidación (Editable)</h3>
                    
                    {/* INPUT VALOR CONSULTA */}
                    <div className="flex items-center">
                      <span className="text-4xl font-black mr-1">$</span>
                      <input 
                        type="number" 
                        value={resultado.atencion?.valor_consulta || 0}
                        onChange={(e) => actualizarAtencion('valor_consulta', parseInt(e.target.value) || 0)}
                        className="bg-transparent text-4xl font-black outline-none w-full border-b border-transparent focus:border-white/30 transition-colors"
                        title="Valor Total Consulta"
                      />
                    </div>
                    
                    {/* INPUT CUOTA MODERADORA */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold opacity-80 uppercase">Cuota Mod: $</span>
                      <input 
                        type="number" 
                        value={resultado.atencion?.valor_cuota || 0}
                        onChange={(e) => actualizarAtencion('valor_cuota', parseInt(e.target.value) || 0)}
                        className="bg-transparent text-[10px] font-bold outline-none border-b border-transparent focus:border-white/30 w-24"
                        title="Cuota Moderadora / Copago"
                      />
                    </div>
                    
                    {/* CÁLCULO NETO */}
                    <p className="text-[10px] font-bold mt-2 opacity-100 uppercase text-medi-accent">
                      Neto a Facturar: ${(resultado.atencion?.valor_consulta - resultado.atencion?.valor_cuota || 0).toLocaleString()} (Cód. 890201)
                    </p>
                  </div>
                  
                  {/* SELECT MODALIDAD */}
                  <div className="text-right">
                    <select
                      value={resultado.atencion?.modalidad || '01'}
                      onChange={(e) => actualizarAtencion('modalidad', e.target.value)}
                      className="bg-white/10 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-medi-accent cursor-pointer appearance-none text-center"
                    >
                      {Object.entries(DICCIONARIO_MODALIDAD).map(([key, value]) => (
                        <option key={key} value={key} className="text-medi-deep bg-white">{value}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10 my-4">
                  {/* SELECT CAUSA */}
                  <div>
                    <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Causa</p>
                    <select
                      value={resultado.atencion?.causa || '15'}
                      onChange={(e) => actualizarAtencion('causa', e.target.value)}
                      className="bg-transparent text-xs font-bold text-white w-full outline-none border-b border-transparent focus:border-white/30 cursor-pointer"
                    >
                      {Object.entries(DICCIONARIO_CAUSAS).map(([key, value]) => (
                        <option key={key} value={key} className="text-medi-deep bg-white">{value}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* SELECT TIPO DIAGNÓSTICO */}
                  <div className="text-right">
                    <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Tipo Diagnóstico</p>
                    <select
                      value={resultado.atencion?.tipo_diagnostico || '01'}
                      onChange={(e) => actualizarAtencion('tipo_diagnostico', e.target.value)}
                      className="bg-transparent text-xs font-bold text-white w-full outline-none border-b border-transparent focus:border-white/30 cursor-pointer text-right"
                    >
                      {Object.entries(DICCIONARIO_TIPO_DIAG).map(([key, value]) => (
                        <option key={key} value={key} className="text-medi-deep bg-white">{value}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <DownloadRipsButton 
                    tipoDocumentoPaciente={tipoDocumento} documentoPaciente={cedulaPaciente} fechaNacimientoPaciente={fechaNacimiento}
                    sexoPaciente={sexoPaciente} tipoUsuarioPaciente={tipoUsuario} diagnosticos={resultado.diagnosticos || []}
                    procedimientos={resultado.procedimientos || []} atencionIA={resultado.atencion}
                  />
                  <button onClick={exportarExcel} className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-lg transition-all active:scale-95">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    EXCEL
                  </button>
                </div>
              </div>

              {/* TARJETA DIAGNÓSTICOS CON BOTÓN ELIMINAR Y AGREGAR */}
              <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
                <div className="bg-medi-deep px-8 py-5 flex justify-between items-center text-white">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Diagnósticos (CIE-10)</h4>
                </div>
                <div className="p-4 bg-medi-light/10">
                  {resultado.diagnosticos?.map((diag: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-primary relative group">
                      <div className="flex items-center gap-6 p-5">
                        <div className="text-xl font-black text-medi-deep bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center">{diag.codigo_cie10}</div>
                        <div className="text-lg font-semibold text-medi-deep italic flex-grow">{diag.descripcion}</div>
                        
                        <button onClick={() => eliminarDiagnostico(idx)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors shadow-sm" title="Eliminar este código">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      
                      {diag.alternativas && diag.alternativas.length > 0 && (
                        <details className="group/details border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                          <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                            <span className="group-open/details:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas (Reemplazar)
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {diag.alternativas.map((alt: any, altIdx: number) => (
                              <button key={altIdx} onClick={() => cambiarDiagnostico(idx, alt)} className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-primary hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn">
                                <span className="font-black text-medi-dark group-hover/btn:text-medi-primary">{alt.codigo}</span>
                                <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-medi-primary opacity-0 group-hover/btn:opacity-100 font-bold">Reemplazar por este ↑</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}

                  {/* MÓDULO AGREGAR DIAGNÓSTICO MANUAL */}
                  <div className="mt-4 border-t border-medi-light/50 pt-4">
                    {!mostrarAgregarDiag ? (
                      <button onClick={() => setMostrarAgregarDiag(true)} className="text-xs font-bold text-medi-primary flex items-center gap-2 hover:bg-medi-light/50 px-4 py-3 rounded-xl transition-colors w-full justify-center border border-dashed border-medi-primary/50">
                        + Agregar Diagnóstico Manualmente
                      </button>
                    ) : (
                      <div className="bg-white p-5 rounded-2xl border border-medi-primary/50 shadow-sm flex flex-col gap-3">
                        <h5 className="text-xs font-bold text-medi-dark uppercase mb-1">Añadir Nuevo CIE-10</h5>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="text" placeholder="Cód. Ej: I10" value={nuevoDiagCodigo} onChange={(e) => setNuevoDiagCodigo(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm sm:w-1/4 outline-none focus:border-medi-primary uppercase font-bold text-medi-deep" />
                          <input type="text" placeholder="Descripción del diagnóstico..." value={nuevoDiagDesc} onChange={(e) => setNuevoDiagDesc(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm flex-grow outline-none focus:border-medi-primary font-medium text-medi-deep" />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setMostrarAgregarDiag(false)} className="px-4 py-2 text-xs font-bold text-medi-dark hover:bg-medi-light/50 rounded-xl transition-colors">Cancelar</button>
                          <button onClick={agregarDiagnosticoManual} className="px-4 py-2 text-xs font-black bg-medi-primary text-white hover:bg-medi-deep rounded-xl transition-colors shadow-md">Guardar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TARJETA PROCEDIMIENTOS CON BOTÓN ELIMINAR Y AGREGAR */}
              <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
                <div className="bg-medi-primary px-8 py-5 flex justify-between items-center text-white">
                  <h4 className="font-bold text-lg uppercase tracking-wider">Procedimientos (CUPS)</h4>
                </div>
                <div className="p-4 bg-medi-light/10">
                  {resultado.procedimientos?.map((proc: any, idx: number) => (
                    <div key={idx} className="bg-white mb-3 rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden transition-all hover:border-medi-accent relative group">
                      <div className="flex items-center gap-4 sm:gap-6 p-5">
                        <div className="text-xl font-black text-medi-primary bg-medi-light/40 px-5 py-3 rounded-xl min-w-[100px] text-center">{proc.codigo_cups}</div>
                        <div className="flex-grow text-lg font-semibold text-medi-deep italic">{proc.descripcion}</div>
                        <div className="text-sm font-black text-white bg-medi-primary px-4 py-2 rounded-full border border-medi-primary/50 whitespace-nowrap flex-shrink-0">Cant: {proc.cantidad}</div>
                        <button onClick={() => eliminarProcedimiento(idx)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors shadow-sm ml-2 flex-shrink-0" title="Eliminar este procedimiento">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      
                      {proc.alternativas && proc.alternativas.length > 0 && (
                        <details className="group/details border-t border-medi-light/50 bg-medi-light/20 cursor-pointer">
                          <summary className="text-xs font-bold text-medi-primary uppercase px-6 py-3 list-none flex items-center gap-2 hover:bg-medi-light/40 transition-colors">
                            <span className="group-open/details:rotate-90 transition-transform">▶</span> Ver alternativas sugeridas (Reemplazar)
                          </summary>
                          <div className="p-4 pt-0 flex flex-col gap-2">
                            {proc.alternativas.map((alt: any, altIdx: number) => (
                              <button key={altIdx} onClick={() => cambiarProcedimiento(idx, alt)} className="text-left px-4 py-3 rounded-lg border border-medi-light/50 hover:border-medi-accent hover:bg-medi-light/30 transition-all text-sm flex gap-4 items-center group/btn">
                                <span className="font-black text-medi-dark group-hover/btn:text-medi-accent">{alt.codigo}</span>
                                <span className="font-medium text-medi-deep">{alt.descripcion}</span>
                                <span className="ml-auto text-xs text-medi-accent opacity-0 group-hover/btn:opacity-100 font-bold">Reemplazar por este ↑</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}

                  {/* MÓDULO AGREGAR PROCEDIMIENTO MANUAL */}
                  <div className="mt-4 border-t border-medi-light/50 pt-4">
                    {!mostrarAgregarProc ? (
                      <button onClick={() => setMostrarAgregarProc(true)} className="text-xs font-bold text-medi-primary flex items-center gap-2 hover:bg-medi-light/50 px-4 py-3 rounded-xl transition-colors w-full justify-center border border-dashed border-medi-primary/50">
                        + Agregar Procedimiento Manualmente
                      </button>
                    ) : (
                      <div className="bg-white p-5 rounded-2xl border border-medi-primary/50 shadow-sm flex flex-col gap-3">
                        <h5 className="text-xs font-bold text-medi-dark uppercase mb-1">Añadir Nuevo CUPS</h5>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="text" placeholder="Cód. Ej: 890201" value={nuevoProcCodigo} onChange={(e) => setNuevoProcCodigo(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm sm:w-1/4 outline-none focus:border-medi-primary uppercase font-bold text-medi-deep" />
                          <input type="text" placeholder="Descripción del procedimiento..." value={nuevoProcDesc} onChange={(e) => setNuevoProcDesc(e.target.value)} className="p-3 border-2 border-medi-light rounded-xl text-sm flex-grow outline-none focus:border-medi-primary font-medium text-medi-deep" />
                          <input type="number" min="1" value={nuevoProcCant} onChange={(e) => setNuevoProcCant(parseInt(e.target.value) || 1)} className="p-3 border-2 border-medi-light rounded-xl text-sm w-20 outline-none focus:border-medi-primary font-bold text-center text-medi-deep" title="Cantidad" />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setMostrarAgregarProc(false)} className="px-4 py-2 text-xs font-bold text-medi-dark hover:bg-medi-light/50 rounded-xl transition-colors">Cancelar</button>
                          <button onClick={agregarProcedimientoManual} className="px-4 py-2 text-xs font-black bg-medi-primary text-white hover:bg-medi-deep rounded-xl transition-colors shadow-md">Guardar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
}