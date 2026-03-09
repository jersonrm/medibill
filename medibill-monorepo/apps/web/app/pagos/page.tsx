"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  obtenerCarteraPendiente,
  listarEPSUsuario,
} from "@/app/actions/pagos";
import { formatCOP, formatFechaCO } from "@/lib/formato";
import type { ItemCartera, FiltrosCartera, ResumenCartera } from "@/lib/types/pago";

const RANGOS_ANTIGUEDAD = [
  { label: "Todas", min: undefined, max: undefined },
  { label: "0–30 días", min: 0, max: 30 },
  { label: "31–60 días", min: 31, max: 60 },
  { label: "61–90 días", min: 61, max: 90 },
  { label: "+90 días", min: 91, max: undefined },
];

export default function PagosPage() {
  const [items, setItems] = useState<ItemCartera[]>([]);
  const [resumen, setResumen] = useState<ResumenCartera>({
    total_pendiente: 0,
    total_facturas: 0,
    promedio_dias: 0,
  });
  const [epsList, setEpsList] = useState<{ nit_erp: string; eps_nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroEPS, setFiltroEPS] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"pendiente" | "parcial" | "todas">("todas");
  const [filtroAntiguedad, setFiltroAntiguedad] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    const rango = RANGOS_ANTIGUEDAD[filtroAntiguedad]!;
    const filtros: FiltrosCartera = {
      estado: filtroEstado,
      eps: filtroEPS || undefined,
      antiguedad_min: rango.min,
      antiguedad_max: rango.max,
    };
    const result = await obtenerCarteraPendiente(filtros);
    setItems(result.items);
    setResumen(result.resumen);
    setCargando(false);
  }, [filtroEPS, filtroEstado, filtroAntiguedad]);

  useEffect(() => {
    listarEPSUsuario().then(setEpsList).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-black text-medi-deep flex items-center gap-3">
          <div className="w-2 h-8 bg-emerald-500 rounded-full" /> Cartera Pendiente
        </h1>
        <Link
          href="/pagos/importar"
          className="px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Importar sábana EPS
        </Link>
      </div>
      <p className="text-sm text-medi-dark/50 mb-8">
        Seguimiento de pagos de facturas radicadas ante EPS
      </p>

      {/* Alerta de cartera vencida */}
      {(() => {
        const vencidas60 = items.filter((i) => i.dias_antiguedad > 60);
        const vencidas90 = items.filter((i) => i.dias_antiguedad > 90);
        if (vencidas60.length === 0) return null;
        const montoRiesgo = vencidas60.reduce((s, i) => s + i.saldo_pendiente, 0);
        return (
          <div className={`rounded-xl border p-4 mb-6 ${vencidas90.length > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{vencidas90.length > 0 ? "🚨" : "⚠️"}</span>
              <div>
                <p className={`text-sm font-bold ${vencidas90.length > 0 ? "text-red-800" : "text-amber-800"}`}>
                  {vencidas60.length} factura{vencidas60.length !== 1 ? "s" : ""} con más de 60 días sin pago — {formatCOP(montoRiesgo)} en riesgo
                </p>
                {vencidas90.length > 0 && (
                  <p className="text-xs text-red-700 mt-1">
                    {vencidas90.length} de ellas supera{vencidas90.length === 1 ? "" : "n"} los 90 días. Considere gestión de cobro urgente.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm">
          <div className="w-10 h-1.5 rounded-full bg-emerald-500 mb-3" />
          <div className="text-3xl font-black text-medi-deep">
            {formatCOP(resumen.total_pendiente)}
          </div>
          <div className="text-xs font-bold text-medi-dark/60 uppercase mt-1">
            Total pendiente
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm">
          <div className="w-10 h-1.5 rounded-full bg-blue-500 mb-3" />
          <div className="text-3xl font-black text-medi-deep">
            {resumen.total_facturas}
          </div>
          <div className="text-xs font-bold text-medi-dark/60 uppercase mt-1">
            Facturas en cartera
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm">
          <div className="w-10 h-1.5 rounded-full bg-amber-500 mb-3" />
          <div className="text-3xl font-black text-medi-deep">
            {resumen.promedio_dias} días
          </div>
          <div className="text-xs font-bold text-medi-dark/60 uppercase mt-1">
            Antigüedad promedio
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm mb-6">
        <h3 className="text-xs font-black text-medi-dark uppercase mb-4">
          Filtros
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* EPS */}
          <div>
            <label className="block text-xs font-bold text-medi-dark/60 mb-1">
              EPS
            </label>
            <select
              value={filtroEPS}
              onChange={(e) => setFiltroEPS(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-medi-light rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary/30"
            >
              <option value="">Todas las EPS</option>
              {epsList.map((eps) => (
                <option key={eps.nit_erp} value={eps.nit_erp}>
                  {eps.eps_nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Estado pago */}
          <div>
            <label className="block text-xs font-bold text-medi-dark/60 mb-1">
              Estado de pago
            </label>
            <select
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(
                  e.target.value as "pendiente" | "parcial" | "todas"
                )
              }
              className="w-full px-3 py-2 text-sm border border-medi-light rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary/30"
            >
              <option value="todas">Todas</option>
              <option value="pendiente">Sin pagos</option>
              <option value="parcial">Con abono parcial</option>
            </select>
          </div>

          {/* Antigüedad */}
          <div>
            <label className="block text-xs font-bold text-medi-dark/60 mb-1">
              Antigüedad
            </label>
            <select
              value={filtroAntiguedad}
              onChange={(e) => setFiltroAntiguedad(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-medi-light rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary/30"
            >
              {RANGOS_ANTIGUEDAD.map((r, i) => (
                <option key={i} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de cartera */}
      <div className="bg-white rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="text-center py-16 text-medi-dark/50 animate-pulse">
            Cargando cartera...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-medi-dark/50 text-sm">
              No hay facturas pendientes de pago
            </p>
            <p className="text-xs text-medi-dark/30 mt-1">
              Las facturas aparecerán aquí una vez radicadas ante la EPS
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-medi-deep text-white text-xs uppercase">
                  <th className="px-4 py-3 text-left font-bold">Factura</th>
                  <th className="px-4 py-3 text-left font-bold">EPS</th>
                  <th className="px-4 py-3 text-left font-bold">Paciente</th>
                  <th className="px-4 py-3 text-right font-bold">Valor</th>
                  <th className="px-4 py-3 text-right font-bold">Pagado</th>
                  <th className="px-4 py-3 text-right font-bold">Pendiente</th>
                  <th className="px-4 py-3 text-center font-bold">Días</th>
                  <th className="px-4 py-3 text-center font-bold">Estado</th>
                  <th className="px-4 py-3 text-center font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.factura_id}
                    className="border-t border-medi-light/30 hover:bg-medi-light/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/facturas/${item.factura_id}`}
                        className="font-bold text-medi-primary hover:underline"
                      >
                        {item.num_factura}
                      </Link>
                      <div className="text-[10px] text-medi-dark/40">
                        {formatFechaCO(item.fecha_expedicion)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-medi-deep">
                      {item.eps_nombre}
                    </td>
                    <td className="px-4 py-3 text-medi-dark/70">
                      {item.paciente_nombre}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-medi-deep">
                      {formatCOP(item.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      {item.total_pagado > 0
                        ? formatCOP(item.total_pagado)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600">
                      {formatCOP(item.saldo_pendiente)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-black px-2 py-1 rounded-full ${
                          item.dias_antiguedad > 90
                            ? "bg-red-100 text-red-700"
                            : item.dias_antiguedad > 60
                              ? "bg-amber-100 text-amber-700"
                              : item.dias_antiguedad > 30
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.dias_antiguedad}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          item.total_pagado > 0
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {item.total_pagado > 0 ? "Parcial" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/facturas/${item.factura_id}`}
                        className="text-xs font-bold text-medi-primary hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
