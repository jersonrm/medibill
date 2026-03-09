"use client";

import React, { useState, useEffect, useCallback } from "react";
import { listarPacientes, obtenerHistorialPaciente } from "@/app/actions/pacientes";
import { formatFechaCO } from "@/lib/formato";
import type { PacienteDB } from "@/lib/types/paciente";

interface HistorialItem {
  id: string;
  tipo: "auditoria" | "factura";
  fecha: string;
  detalle: string;
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<PacienteDB[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Record<string, HistorialItem[]>>({});

  const porPagina = 15;

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listarPacientes({ busqueda: busqueda || undefined, pagina, porPagina });
    setPacientes(res.pacientes as PacienteDB[]);
    setTotal(res.total);
    setCargando(false);
  }, [busqueda, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleHistorial = async (pacienteId: string) => {
    if (expandido === pacienteId) {
      setExpandido(null);
      return;
    }
    setExpandido(pacienteId);
    if (!historial[pacienteId]) {
      const h = await obtenerHistorialPaciente(pacienteId);
      const items: HistorialItem[] = [
        ...(h.auditorias || []).map((a: { id: string; creado_en: string; nota_original?: string }) => ({
          id: a.id,
          tipo: "auditoria" as const,
          fecha: a.creado_en,
          detalle: a.nota_original?.slice(0, 120) || "Auditoría RIPS",
        })),
        ...(h.facturas || []).map((f: { id: string; created_at: string; num_factura?: string; estado?: string; valor_total?: number }) => ({
          id: f.id,
          tipo: "factura" as const,
          fecha: f.created_at,
          detalle: `Factura ${f.num_factura || "S/N"} — ${f.estado || ""} — $${f.valor_total || 0}`,
        })),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setHistorial((prev) => ({ ...prev, [pacienteId]: items }));
    }
  };

  const totalPaginas = Math.ceil(total / porPagina);

  const handleBusqueda = (v: string) => {
    setBusqueda(v);
    setPagina(1);
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      <h1 className="text-3xl font-black text-medi-deep mb-6 flex items-center gap-3">
        <div className="w-2 h-8 bg-medi-accent rounded-full" /> Directorio de Pacientes
      </h1>

      {/* Buscador */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o documento..."
          value={busqueda}
          onChange={(e) => handleBusqueda(e.target.value)}
          className="w-full max-w-md p-3 bg-white border-2 border-medi-light rounded-xl outline-none focus:border-medi-primary transition-all font-medium text-sm text-medi-deep"
        />
        <span className="ml-4 text-sm text-medi-dark/60">{total} paciente{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-medi-deep text-white text-left">
              <th className="px-6 py-4 font-bold uppercase text-xs tracking-wider">Paciente</th>
              <th className="px-4 py-4 font-bold uppercase text-xs tracking-wider">Documento</th>
              <th className="px-4 py-4 font-bold uppercase text-xs tracking-wider">EPS</th>
              <th className="px-4 py-4 font-bold uppercase text-xs tracking-wider">Última actividad</th>
              <th className="px-4 py-4 font-bold uppercase text-xs tracking-wider w-10" />
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={5} className="text-center py-12 text-medi-dark/50">Cargando...</td></tr>
            ) : pacientes.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-medi-dark/50">No se encontraron pacientes</td></tr>
            ) : (
              pacientes.map((p) => (
                <React.Fragment key={p.id}>
                  <tr
                    className="border-t border-medi-light/30 hover:bg-medi-light/10 cursor-pointer transition-colors"
                    onClick={() => toggleHistorial(p.id)}
                  >
                    <td className="px-6 py-4 font-semibold text-medi-deep">
                      {[p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-bold text-medi-dark/50 mr-1">{p.tipo_documento}</span>
                      {p.numero_documento}
                    </td>
                    <td className="px-4 py-4 text-xs">{p.eps_nombre || "-"}</td>
                    <td className="px-4 py-4 text-xs text-medi-dark/60">
                      {p.updated_at ? formatFechaCO(p.updated_at.split("T")[0] ?? p.updated_at) : "-"}
                    </td>
                    <td className="px-4 py-4 text-medi-primary">
                      <span className={`transition-transform inline-block ${expandido === p.id ? "rotate-90" : ""}`}>▶</span>
                    </td>
                  </tr>
                  {expandido === p.id && (
                    <tr>
                      <td colSpan={5} className="bg-medi-light/10 px-8 py-4">
                        <h5 className="text-xs font-bold text-medi-dark uppercase mb-3">Historial de atenciones</h5>
                        {!historial[p.id] ? (
                          <p className="text-xs text-medi-dark/50 animate-pulse">Cargando historial...</p>
                        ) : (historial[p.id]?.length ?? 0) === 0 ? (
                          <p className="text-xs text-medi-dark/50">Sin historial registrado</p>
                        ) : (
                          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {(historial[p.id] ?? []).map((h) => (
                              <div key={h.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2 border border-medi-light/30 text-xs">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  h.tipo === "factura" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                                }`}>
                                  {h.tipo === "factura" ? "Factura" : "Auditoría"}
                                </span>
                                <span className="text-medi-dark/50">{formatFechaCO(h.fecha.split("T")[0] ?? h.fecha)}</span>
                                <span className="text-medi-deep truncate flex-grow">{h.detalle}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1}
            className="px-4 py-2 text-xs font-bold bg-white border border-medi-light rounded-lg disabled:opacity-30 hover:bg-medi-light/30 transition-colors"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-xs font-bold text-medi-dark/60">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            className="px-4 py-2 text-xs font-bold bg-white border border-medi-light rounded-lg disabled:opacity-30 hover:bg-medi-light/30 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
