"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { guardarTarifaUsuario, obtenerTarifasUsuario, eliminarTarifaUsuario } from "../actions";

export default function ConfiguracionPage() {
  const [tarifas, setTarifas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [buscandoIA, setBuscandoIA] = useState(false);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [valorReal, setValorReal] = useState(0);

  useEffect(() => {
    cargarTarifas();
  }, []);

  const cargarTarifas = async () => {
    const datos = await obtenerTarifasUsuario();
    setTarifas(datos || []);
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const numberValue = parseInt(rawValue) || 0;
    setValorReal(numberValue);
    setValorDisplay(numberValue.toLocaleString('es-CO'));
  };

  const invocarVarita = async () => {
    if (descripcion.length < 3) return alert("Escribe el nombre del servicio para buscar.");
    setBuscandoIA(true);
    setSugerencias([]);
    
    try {
      const res = await fetch('/api/ai-helper', {
        method: 'POST',
        body: JSON.stringify({ prompt: descripcion })
      });
      const data = await res.json();
      
      if (data.opciones && data.opciones.length > 0) {
        setSugerencias(data.opciones);
      } else {
        alert("No encontré códigos exactos. Intenta con otra palabra.");
      }
    } catch (err) {
      alert("Error al conectar con la IA.");
    } finally {
      setBuscandoIA(false);
    }
  };

  const seleccionarSugerencia = (sug: any) => {
    setCodigo(sug.codigo);
    setDescripcion(sug.desc);
    setSugerencias([]);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !descripcion || valorReal <= 0) return alert("Diligencie todos los campos.");

    setCargando(true);
    const respuesta = await guardarTarifaUsuario(codigo, descripcion, valorReal);
    if (respuesta.exito) {
      setCodigo("");
      setDescripcion("");
      setValorDisplay("");
      setValorReal(0);
      await cargarTarifas();
    }
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-medi-light/30 text-medi-deep font-sans pb-20">
      <header className="bg-white border-b border-medi-light px-8 py-4 shadow-sm mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">⚙️ Configuración de Tarifas</h1>
          <Link href="/"><button className="text-sm font-bold text-medi-primary px-4 py-2 rounded-xl border-2 border-medi-light hover:bg-medi-light/50 transition-all">← Volver</button></Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-medi-light/50 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">Nueva Tarifa</h2>
              {/* RESTAURADO ESTILO ANTERIOR DEL BOTÓN IA HELPER */}
              <button 
                type="button"
                onClick={invocarVarita}
                disabled={buscandoIA}
                className="text-[10px] bg-medi-light text-medi-primary px-3 py-1.5 rounded-lg font-black hover:bg-medi-primary hover:text-white transition-all shadow-sm"
              >
                {buscandoIA ? "Buscando..." : "🪄 IA Helper"}
              </button>
            </div>
            
            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              <div className="relative">
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Descripción del Servicio</label>
                <input 
                  type="text" 
                  placeholder="Ej: Hemograma..." 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary text-sm font-medium"
                />

                {/* MENU DE SUGERENCIAS IA */}
                {sugerencias.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-2 bg-white border-2 border-medi-primary rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <p className="text-[9px] font-black bg-medi-primary text-white px-4 py-2 uppercase tracking-tighter">Seleccione el procedimiento exacto:</p>
                    {sugerencias.map((s, i) => (
                      <button 
                        key={i} 
                        type="button"
                        onClick={() => seleccionarSugerencia(s)}
                        className="w-full text-left px-4 py-3 text-xs border-b border-medi-light hover:bg-medi-light/60 transition-colors flex flex-col gap-1"
                      >
                        <span className="font-black text-medi-primary">{s.codigo}</span>
                        <span className="font-semibold text-medi-deep leading-tight line-clamp-2">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Código CUPS</label>
                <input type="text" readOnly value={codigo} placeholder="Auto-completado" className="w-full p-3 bg-medi-light/40 border-2 border-medi-light rounded-xl font-bold text-medi-deep opacity-70" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-medi-dark uppercase ml-1">Tarifa ($)</label>
                <input type="text" value={valorDisplay} onChange={handleMoneyChange} className="w-full p-3 bg-medi-light/20 border-2 border-medi-light rounded-xl font-black text-2xl text-medi-deep" placeholder="0" />
              </div>

              <button type="submit" disabled={cargando} className="bg-medi-primary hover:bg-medi-deep text-white font-black py-4 rounded-2xl shadow-lg mt-2 active:scale-95 transition-all">
                {cargando ? "Guardando..." : "Guardar Precio"}
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-medi-light/50">
            <h2 className="text-lg font-black mb-6">Mis Tarifas Personalizadas</h2>
            <div className="flex flex-col gap-3">
              {tarifas.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-5 border border-medi-light/40 rounded-2xl hover:bg-medi-light/10 transition-all group">
                  <div className="flex items-center gap-5 min-w-0 flex-grow">
                    <div className="bg-medi-light/30 text-medi-primary font-black px-3 py-2 rounded-lg text-sm min-w-[85px] text-center shrink-0">
                      {item.codigo_cups}
                    </div>
                    {/* ARREGLO DE OVERFLOW: break-words y flex-1 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-medi-deep text-sm leading-snug break-words">
                        {item.descripcion}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 ml-4">
                    <span className="font-black text-xl text-medi-deep">${item.tarifa.toLocaleString('es-CO')}</span>
                    <button onClick={() => eliminarTarifaUsuario(item.id).then(() => cargarTarifas())} className="text-red-300 hover:text-red-500 p-2 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}