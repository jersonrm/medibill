"use client";

import { useState, useMemo } from "react";
import type { Alerta, CategoriaAlerta } from "@/lib/types/glosas";

interface ListaAlertasProps {
  alertas: Alerta[];
}

const COLORES_CATEGORIA: Record<CategoriaAlerta, { bg: string; border: string; badge: string }> = {
  devolucion: { bg: "bg-red-900/30", border: "border-red-500/40", badge: "bg-red-600" },
  facturacion: { bg: "bg-orange-900/30", border: "border-orange-500/40", badge: "bg-orange-600" },
  tarifa: { bg: "bg-amber-900/30", border: "border-amber-500/40", badge: "bg-amber-600" },
  soporte: { bg: "bg-blue-900/30", border: "border-blue-500/40", badge: "bg-blue-600" },
  autorizacion: { bg: "bg-purple-900/30", border: "border-purple-500/40", badge: "bg-purple-600" },
  pertinencia: { bg: "bg-cyan-900/30", border: "border-cyan-500/40", badge: "bg-cyan-600" },
  seguimiento: { bg: "bg-gray-900/30", border: "border-gray-500/40", badge: "bg-gray-600" },
};

const LABELS_CATEGORIA: Record<CategoriaAlerta, string> = {
  devolucion: "Devoluciones",
  facturacion: "Facturación",
  tarifa: "Tarifas",
  soporte: "Soportes",
  autorizacion: "Autorización",
  pertinencia: "Pertinencia",
  seguimiento: "Seguimiento",
};

type FiltroActivo = "todas" | "errores" | "warnings" | CategoriaAlerta;

const FILTROS: { key: FiltroActivo; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "errores", label: "Errores" },
  { key: "warnings", label: "Warnings" },
  { key: "devolucion", label: "Devoluciones" },
  { key: "facturacion", label: "Facturación" },
  { key: "tarifa", label: "Tarifas" },
  { key: "soporte", label: "Soportes" },
  { key: "autorizacion", label: "Autorización" },
  { key: "pertinencia", label: "Pertinencia" },
];

export default function ListaAlertas({ alertas }: ListaAlertasProps) {
  const [filtro, setFiltro] = useState<FiltroActivo>("todas");
  const [expandida, setExpandida] = useState<string | null>(null);

  const alertasFiltradas = useMemo(() => {
    if (filtro === "todas") return alertas;
    if (filtro === "errores") return alertas.filter((a) => a.tipo === "error");
    if (filtro === "warnings") return alertas.filter((a) => a.tipo === "warning");
    return alertas.filter((a) => a.categoria === filtro);
  }, [alertas, filtro]);

  const conteoFiltros = useMemo(() => {
    const conteo: Record<string, number> = { todas: alertas.length };
    conteo.errores = alertas.filter((a) => a.tipo === "error").length;
    conteo.warnings = alertas.filter((a) => a.tipo === "warning").length;
    for (const cat of Object.keys(COLORES_CATEGORIA)) {
      conteo[cat] = alertas.filter((a) => a.categoria === cat).length;
    }
    return conteo;
  }, [alertas]);

  const toggleExpand = (key: string) => {
    setExpandida((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => {
          const count = conteoFiltros[f.key] ?? 0;
          const activo = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                activo
                  ? "bg-medi-accent text-white shadow-lg shadow-medi-accent/30"
                  : "bg-medi-deep/80 text-gray-400 hover:text-gray-200 hover:bg-medi-dark/80 border border-medi-dark/50"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activo ? "bg-white/20" : "bg-medi-dark"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista de alertas */}
      {alertasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl block mb-3">🎉</span>
          <p className="text-sm font-semibold">Sin alertas en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertasFiltradas.map((alerta, idx) => {
            const key = `${alerta.codigo_glosa}-${idx}`;
            const isExpanded = expandida === key;
            const colors = COLORES_CATEGORIA[alerta.categoria] ?? COLORES_CATEGORIA.facturacion;
            const tipoBadge =
              alerta.tipo === "error"
                ? "bg-red-600 text-white"
                : alerta.tipo === "warning"
                ? "bg-amber-600 text-white"
                : "bg-blue-600 text-white";

            return (
              <div
                key={key}
                className={`${colors.bg} border ${colors.border} rounded-xl overflow-hidden transition-all duration-200`}
              >
                {/* Header clickeable */}
                <button
                  onClick={() => toggleExpand(key)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  {/* Badge código */}
                  <span className={`${colors.badge} text-white text-xs font-mono font-bold px-2 py-1 rounded-md shrink-0`}>
                    {alerta.codigo_glosa}
                  </span>
                  {/* Badge tipo */}
                  <span className={`${tipoBadge} text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0`}>
                    {alerta.tipo}
                  </span>
                  {/* Mensaje */}
                  <span className="text-sm text-gray-200 flex-1 truncate">
                    {alerta.mensaje}
                  </span>
                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 animate-in fade-in-0 duration-200">
                    {/* Detalle */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Detalle</h4>
                      <p className="text-sm text-gray-300">{alerta.detalle}</p>
                    </div>
                    {/* Cómo resolver */}
                    <div>
                      <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wide mb-1">Cómo resolver</h4>
                      <p className="text-sm text-gray-300">{alerta.como_resolver}</p>
                    </div>
                    {/* Norma legal */}
                    <div className="flex items-start gap-4 text-xs text-gray-500">
                      <div>
                        <span className="font-bold uppercase tracking-wide">Norma: </span>
                        <span>{alerta.norma_legal}</span>
                      </div>
                      {alerta.servicio_afectado && (
                        <div>
                          <span className="font-bold uppercase tracking-wide">CUPS: </span>
                          <span className="font-mono">{alerta.servicio_afectado}</span>
                        </div>
                      )}
                    </div>
                    {/* Campo RIPS y glosas relacionadas */}
                    {alerta.campo_rips_codigo && (
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campo RIPS: </span>
                        <span className="text-xs text-gray-400 font-mono">{alerta.campo_rips_codigo}</span>
                        {alerta.glosas_relacionadas_mapeo && alerta.glosas_relacionadas_mapeo.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {alerta.glosas_relacionadas_mapeo.slice(0, 5).map((g) => (
                              <span
                                key={g.codigo_glosa}
                                className="bg-amber-900/30 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-700/20"
                                title={g.descripcion}
                              >
                                {g.codigo_glosa}
                              </span>
                            ))}
                            {alerta.glosas_relacionadas_mapeo.length > 5 && (
                              <span className="text-[10px] text-gray-500">
                                +{alerta.glosas_relacionadas_mapeo.length - 5} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Categoría */}
                    <div className="flex items-center gap-2">
                      <span className={`${colors.badge} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase`}>
                        {LABELS_CATEGORIA[alerta.categoria]}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
