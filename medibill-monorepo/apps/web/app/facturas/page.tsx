"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { listarFacturas, anularFactura } from "@/app/actions/facturas";
import { formatCOP, formatFechaCO } from "@/lib/formato";
import type { EstadoFacturaMVP } from "@/lib/types/factura";

const TABS: { label: string; estado: EstadoFacturaMVP | "todas" }[] = [
  { label: "Todas", estado: "todas" },
  { label: "Borradores", estado: "borrador" },
  { label: "Aprobadas", estado: "aprobada" },
  { label: "Descargadas", estado: "descargada" },
];

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  aprobada: { label: "Aprobada", className: "bg-green-100 text-green-800" },
  descargada: { label: "Descargada", className: "bg-blue-100 text-blue-800" },
  anulada: { label: "Anulada", className: "bg-red-100 text-red-700" },
};

const DIAN_BADGE: Record<string, { label: string; className: string }> = {
  enviada: { label: "Enviada", className: "bg-indigo-100 text-indigo-800" },
  aceptada: { label: "DIAN ✓", className: "bg-green-200 text-green-900" },
  rechazada: { label: "Rechazada", className: "bg-red-200 text-red-900" },
  pendiente: { label: "Pendiente", className: "bg-gray-100 text-gray-600" },
};

interface FacturaRow {
  id: string;
  num_factura: string;
  fecha_expedicion: string;
  nit_erp: string;
  valor_total: number;
  estado: string;
  estado_dian?: string | null;
  metadata: Record<string, string> | null;
  pacientes: { primer_nombre: string; primer_apellido: string; numero_documento: string }[] | { primer_nombre: string; primer_apellido: string; numero_documento: string } | null;
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [tabActivo, setTabActivo] = useState<EstadoFacturaMVP | "todas">("todas");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const porPagina = 20;

  const cargar = useCallback(async () => {
    setCargando(true);
    const filtro: { estado?: EstadoFacturaMVP; pagina: number; porPagina: number } = { pagina, porPagina };
    if (tabActivo !== "todas") filtro.estado = tabActivo;
    const res = await listarFacturas(filtro);
    setFacturas(res.facturas as FacturaRow[]);
    setTotal(res.total);
    setCargando(false);
  }, [tabActivo, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAnular = async (id: string) => {
    if (!confirm("¿Anular esta factura borrador?")) return;
    const res = await anularFactura(id);
    if (res.success) cargar();
    else alert(res.error);
  };

  const totalPaginas = Math.ceil(total / porPagina);

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      <h1 className="text-3xl font-black text-medi-deep mb-6 flex items-center gap-3">
        <div className="w-2 h-8 bg-medi-accent rounded-full" /> Facturas
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.estado}
            onClick={() => { setTabActivo(t.estado); setPagina(1); }}
            className={`px-5 py-2 text-xs font-bold uppercase rounded-full transition-all ${
              tabActivo === t.estado
                ? "bg-medi-primary text-white shadow-md"
                : "bg-white text-medi-dark/60 border border-medi-light hover:bg-medi-light/30"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-medi-dark/50 self-center">{total} factura{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-medi-deep text-white text-left">
              <th className="px-6 py-4 font-bold uppercase text-xs">N° Factura</th>
              <th className="px-4 py-4 font-bold uppercase text-xs">Fecha</th>
              <th className="px-4 py-4 font-bold uppercase text-xs">Paciente</th>
              <th className="px-4 py-4 font-bold uppercase text-xs">EPS</th>
              <th className="px-4 py-4 font-bold uppercase text-xs text-right">Valor</th>
              <th className="px-4 py-4 font-bold uppercase text-xs text-center">Estado</th>
              <th className="px-4 py-4 font-bold uppercase text-xs text-center">DIAN</th>
              <th className="px-4 py-4 font-bold uppercase text-xs text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} className="text-center py-12 text-medi-dark/50">Cargando...</td></tr>
            ) : facturas.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-medi-dark/50">No se encontraron facturas</td></tr>
            ) : (
              facturas.map((f) => (
                <tr key={f.id} className="border-t border-medi-light/30 hover:bg-medi-light/10 transition-colors">
                  <td className="px-6 py-4 font-black text-medi-deep">
                    <Link href={`/facturas/${f.id}`} className="hover:text-medi-primary transition-colors">
                      {f.num_factura.startsWith("BORR-") ? (
                        <span className="text-amber-600 italic">Borrador</span>
                      ) : f.num_factura}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-xs text-medi-dark/60">{formatFechaCO(f.fecha_expedicion)}</td>
                  <td className="px-4 py-4">
                    {(() => {
                      const p = Array.isArray(f.pacientes) ? f.pacientes[0] : f.pacientes;
                      return p ? `${p.primer_nombre} ${p.primer_apellido}` : <span className="text-medi-dark/30 italic">-</span>;
                    })()}
                  </td>
                  <td className="px-4 py-4 text-xs">{(f.metadata as Record<string, string>)?.eps_nombre || f.nit_erp || "-"}</td>
                  <td className="px-4 py-4 text-right font-bold">{formatCOP(f.valor_total)}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${ESTADO_BADGE[f.estado]?.className || "bg-gray-100 text-gray-500"}`}>
                      {ESTADO_BADGE[f.estado]?.label || f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {f.estado_dian ? (
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${DIAN_BADGE[f.estado_dian]?.className || "bg-gray-100 text-gray-500"}`}>
                        {DIAN_BADGE[f.estado_dian]?.label || f.estado_dian}
                      </span>
                    ) : (
                      <span className="text-medi-dark/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/facturas/${f.id}`}
                        className="text-[10px] font-bold text-medi-primary hover:underline"
                      >
                        Ver
                      </Link>
                      {f.estado === "borrador" && (
                        <button
                          onClick={() => handleAnular(f.id)}
                          className="text-[10px] font-bold text-red-500 hover:underline"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}
            className="px-4 py-2 text-xs font-bold bg-white border border-medi-light rounded-lg disabled:opacity-30">← Anterior</button>
          <span className="px-4 py-2 text-xs font-bold text-medi-dark/60">Página {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
            className="px-4 py-2 text-xs font-bold bg-white border border-medi-light rounded-lg disabled:opacity-30">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
