"use client";

import React, { useEffect, useState } from "react";
import { obtenerResumenBenchmarks } from "@/app/actions/benchmarks";
import { obtenerConsentimientoDatos } from "@/app/actions/perfil";
import type { ResumenBenchmark } from "@/app/actions/benchmarks";

type Estado = "cargando" | "sin-compartir" | "sin-datos" | "con-datos";

export default function BenchmarkPanel() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [benchmarks, setBenchmarks] = useState<ResumenBenchmark[]>([]);

  useEffect(() => {
    const load = async () => {
      const [consent, data] = await Promise.all([
        obtenerConsentimientoDatos(),
        obtenerResumenBenchmarks(),
      ]);
      if (!consent) {
        setEstado("sin-compartir");
      } else if (data.length === 0) {
        setEstado("sin-datos");
      } else {
        setBenchmarks(data);
        setEstado("con-datos");
      }
    };
    load();
  }, []);

  if (estado === "cargando") return null;

  return (
    <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm mb-8">
      <h3 className="text-xs font-black text-medi-dark uppercase mb-4 flex items-center gap-2">
        📊 Inteligencia Colectiva
      </h3>

      {estado === "sin-compartir" && (
        <div className="text-center py-6">
          <p className="text-sm text-medi-dark/60 mb-3">
            Activa la opción de compartir datos para ver benchmarks comparativos de tu EPS.
          </p>
          <a
            href="/configuracion/perfil"
            className="inline-block px-4 py-2 text-xs font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent transition-all"
          >
            Activar en Perfil →
          </a>
        </div>
      )}

      {estado === "sin-datos" && (
        <p className="text-sm text-medi-dark/40 text-center py-6">
          Datos insuficientes — se necesitan al menos 3 usuarios por EPS para generar benchmarks.
        </p>
      )}

      {estado === "con-datos" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benchmarks.map((b) => (
            <BenchmarkCard key={b.eps_codigo} benchmark={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BenchmarkCard({ benchmark }: { benchmark: ResumenBenchmark }) {
  const { eps_nombre, tasa_glosa_comunidad, tasa_glosa_usuario, promedio_dias_pago, dias_pago_usuario, causal_principal } = benchmark;

  const deltaGlosa = tasa_glosa_usuario - tasa_glosa_comunidad;
  const deltaDias = dias_pago_usuario - promedio_dias_pago;

  return (
    <div className="border border-medi-light/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-medi-primary/10 text-medi-primary">
          {eps_nombre}
        </span>
      </div>

      {/* Tasa de glosa */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-medi-dark/60">Tasa glosas</span>
        <div className="text-right">
          <span className="text-sm font-bold text-medi-deep">{tasa_glosa_usuario}%</span>
          <span className="text-[10px] text-medi-dark/40 ml-1">
            vs {tasa_glosa_comunidad}%
          </span>
          {deltaGlosa !== 0 && (
            <span className={`ml-1 text-[10px] font-bold ${deltaGlosa > 0 ? "text-red-500" : "text-green-500"}`}>
              {deltaGlosa > 0 ? "↑" : "↓"}{Math.abs(deltaGlosa).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Días de pago */}
      {promedio_dias_pago > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-medi-dark/60">Días pago</span>
          <div className="text-right">
            <span className="text-sm font-bold text-medi-deep">
              {dias_pago_usuario > 0 ? `${dias_pago_usuario}d` : "—"}
            </span>
            <span className="text-[10px] text-medi-dark/40 ml-1">
              vs {promedio_dias_pago}d prom.
            </span>
            {dias_pago_usuario > 0 && deltaDias !== 0 && (
              <span className={`ml-1 text-[10px] font-bold ${deltaDias > 0 ? "text-red-500" : "text-green-500"}`}>
                {deltaDias > 0 ? "↑" : "↓"}{Math.abs(deltaDias)}d
              </span>
            )}
          </div>
        </div>
      )}

      {/* Causal principal */}
      {causal_principal && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-medi-dark/60">Causal frecuente</span>
          <span className="text-xs font-mono font-bold text-amber-600">
            {causal_principal}
          </span>
        </div>
      )}
    </div>
  );
}
