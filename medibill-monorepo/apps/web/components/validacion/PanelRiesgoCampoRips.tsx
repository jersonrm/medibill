"use client";

import { useState, useMemo } from "react";
import type { Alerta, GlosaRelacionadaMapeo } from "@/lib/types/glosas";

interface PanelRiesgoCampoRipsProps {
  alertas: Alerta[];
}

interface CampoAgrupado {
  campo_rips_codigo: string;
  alertas: Alerta[];
  glosas_unicas: GlosaRelacionadaMapeo[];
  glosas_prevenidas: string[];
  max_severidad: "error" | "warning" | "info";
}

const SEVERIDAD_ORDEN: Record<string, number> = { error: 0, warning: 1, info: 2 };

export default function PanelRiesgoCampoRips({ alertas }: PanelRiesgoCampoRipsProps) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const camposAgrupados = useMemo(() => {
    const mapa = new Map<string, CampoAgrupado>();

    for (const alerta of alertas) {
      if (!alerta.campo_rips_codigo) continue;

      const codigo = alerta.campo_rips_codigo;
      if (!mapa.has(codigo)) {
        mapa.set(codigo, {
          campo_rips_codigo: codigo,
          alertas: [],
          glosas_unicas: [],
          glosas_prevenidas: [],
          max_severidad: "info",
        });
      }

      const grupo = mapa.get(codigo)!;
      grupo.alertas.push(alerta);
      grupo.glosas_prevenidas.push(alerta.codigo_glosa);

      if (SEVERIDAD_ORDEN[alerta.tipo]! < SEVERIDAD_ORDEN[grupo.max_severidad]!) {
        grupo.max_severidad = alerta.tipo;
      }

      if (alerta.glosas_relacionadas_mapeo) {
        for (const g of alerta.glosas_relacionadas_mapeo) {
          const yaExiste = grupo.glosas_unicas.some(
            (u) => u.codigo_glosa === g.codigo_glosa
          );
          if (!yaExiste) {
            grupo.glosas_unicas.push(g);
          }
        }
      }
    }

    return [...mapa.values()].sort(
      (a, b) =>
        SEVERIDAD_ORDEN[a.max_severidad]! - SEVERIDAD_ORDEN[b.max_severidad]! ||
        b.glosas_unicas.length - a.glosas_unicas.length
    );
  }, [alertas]);

  if (camposAgrupados.length === 0) return null;

  const totalCampos = camposAgrupados.length;
  const totalGlosasRiesgo = new Set(
    camposAgrupados.flatMap((c) => c.glosas_unicas.map((g) => g.codigo_glosa))
  ).size;
  const totalPrevenidas = new Set(
    camposAgrupados.flatMap((c) => c.glosas_prevenidas)
  ).size;

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>
            <strong className="text-gray-200">{totalCampos}</strong> campo(s)
            RIPS con riesgo
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>
            <strong className="text-gray-200">{totalGlosasRiesgo}</strong>{" "}
            glosa(s) potenciales
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            <strong className="text-gray-200">{totalPrevenidas}</strong>{" "}
            detectada(s)
          </span>
        </div>
      </div>

      {/* Lista de campos */}
      <div className="space-y-2">
        {camposAgrupados.map((grupo) => {
          const isExpanded = expandido === grupo.campo_rips_codigo;
          const borderColor =
            grupo.max_severidad === "error"
              ? "border-red-500/40"
              : grupo.max_severidad === "warning"
              ? "border-amber-500/40"
              : "border-blue-500/30";
          const bgColor =
            grupo.max_severidad === "error"
              ? "bg-red-900/20"
              : grupo.max_severidad === "warning"
              ? "bg-amber-900/20"
              : "bg-blue-900/15";
          const badgeColor =
            grupo.max_severidad === "error"
              ? "bg-red-600"
              : grupo.max_severidad === "warning"
              ? "bg-amber-600"
              : "bg-blue-600";

          const primerAlerta = grupo.alertas[0]!;
          const nombreCampo = primerAlerta.mensaje
            .match(/campo "([^"]+)"/)?.[1] ?? grupo.campo_rips_codigo;

          return (
            <div
              key={grupo.campo_rips_codigo}
              className={`${bgColor} border ${borderColor} rounded-xl overflow-hidden transition-all duration-200`}
            >
              <button
                onClick={() =>
                  setExpandido(
                    isExpanded ? null : grupo.campo_rips_codigo
                  )
                }
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
              >
                <span
                  className={`${badgeColor} text-white text-xs font-mono font-bold px-2 py-1 rounded-md shrink-0`}
                >
                  {grupo.campo_rips_codigo}
                </span>
                <span className="text-sm text-gray-200 flex-1 truncate">
                  {nombreCampo}
                </span>
                <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                  {grupo.glosas_unicas.length + grupo.glosas_prevenidas.length}{" "}
                  glosa(s)
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 animate-in fade-in-0 duration-200">
                  {/* Glosas detectadas por el validador */}
                  {grupo.glosas_prevenidas.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">
                        Detectadas por el validador ({grupo.glosas_prevenidas.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set(grupo.glosas_prevenidas)].map((codigo) => (
                          <span
                            key={codigo}
                            className="bg-emerald-900/40 text-emerald-300 text-xs font-mono px-2 py-0.5 rounded-md border border-emerald-700/30"
                          >
                            {codigo}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Glosas adicionales del mapeo normativo */}
                  {grupo.glosas_unicas.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">
                        Glosas potenciales del mapeo normativo (
                        {grupo.glosas_unicas.length})
                      </h4>
                      <div className="space-y-1.5">
                        {grupo.glosas_unicas.map((g) => (
                          <div
                            key={g.codigo_glosa}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="bg-amber-900/40 text-amber-300 font-mono px-1.5 py-0.5 rounded shrink-0 border border-amber-700/30">
                              {g.codigo_glosa}
                            </span>
                            <span className="text-gray-400 leading-relaxed">
                              {g.descripcion}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fuente */}
                  <div className="text-[10px] text-gray-600 pt-1">
                    Fuente: Res. 2275/2023, Anexo — Relacionamiento Glosas vs
                    RIPS
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
