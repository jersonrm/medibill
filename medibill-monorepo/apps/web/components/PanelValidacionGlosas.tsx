"use client";

import React, { useState, useMemo } from "react";
import type {
  ResultadoValidacion,
  ValidacionPreRadicacionDB,
  SeveridadValidacion,
  GlosaConDetalle,
  EstadoGlosa,
  ResumenGlosas,
  Alerta,
} from "@/lib/types/glosas";
import {
  COLORES_SEVERIDAD,
  COLORES_ESTADO_GLOSA,
  LABELS_ESTADO_GLOSA,
  LABELS_CONCEPTO,
  LABELS_RESPUESTA,
} from "@/lib/types/glosas";

// =====================================================================
// ICONOS SVG INLINE (sin dependencia externa)
// =====================================================================

const IconError = () => (
  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconWarn = () => (
  <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const IconInfo = () => (
  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconShield = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ICON_MAP: Record<SeveridadValidacion, () => React.JSX.Element> = {
  error: IconError,
  advertencia: IconWarn,
  info: IconInfo,
};

// =====================================================================
// SUB-COMPONENTES
// =====================================================================

/** Barra de resumen superior */
function BarraResumen({ resultado }: { resultado: ResultadoValidacion }) {
  const puedeRadicar = resultado.puede_radicar;
  const score = resultado.puntaje_riesgo_glosa;
  const prevenidas = resultado.glosas_potenciales_prevenidas.length;

  // Color del score
  const scoreColor =
    score <= 20 ? "text-green-600" :
    score <= 50 ? "text-amber-600" :
    "text-red-600";
  const scoreBg =
    score <= 20 ? "bg-green-500" :
    score <= 50 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <div
      className={`rounded-2xl p-6 border ${
        puedeRadicar
          ? "bg-green-50 border-green-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {puedeRadicar ? <IconCheck /> : <IconError />}
          <div>
            <h3 className={`font-bold text-lg ${puedeRadicar ? "text-green-800" : "text-red-800"}`}>
              {puedeRadicar ? "Factura lista para radicar" : "Factura NO puede radicarse"}
            </h3>
            <p className="text-sm opacity-70">
              Factura {resultado.num_factura} — Validada el{" "}
              {new Date(resultado.fecha_validacion).toLocaleString("es-CO")}
            </p>
          </div>
        </div>

        <div className="flex gap-4 text-center">
          <StatBadge label="Errores" value={resultado.errores} color="text-red-600 bg-red-100" />
          <StatBadge label="Alertas" value={resultado.advertencias} color="text-amber-700 bg-amber-100" />
          <StatBadge label="Info" value={resultado.informativos} color="text-blue-600 bg-blue-100" />
        </div>
      </div>

      {/* Score de riesgo de glosa */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Riesgo de glosa
            </span>
            <span className={`text-sm font-black ${scoreColor}`}>{score}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreBg}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Estadística de prevención */}
        {prevenidas > 0 && (
          <div className="text-center px-4 py-2 bg-purple-50 rounded-xl border border-purple-200">
            <div className="text-lg font-black text-purple-700">{prevenidas}</div>
            <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider leading-tight">
              Glosas<br />prevenidas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl px-4 py-2 ${color}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider">{label}</div>
    </div>
  );
}

/** Tarjeta individual de hallazgo */
function TarjetaHallazgo({
  hallazgo,
  alerta,
  onResolver,
}: {
  hallazgo: ValidacionPreRadicacionDB;
  alerta?: Alerta;
  onResolver?: (id: string) => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const Icon = ICON_MAP[hallazgo.severidad];
  const colores = COLORES_SEVERIDAD[hallazgo.severidad];
  const concepto = hallazgo.codigo_causal.slice(0, 2);

  return (
    <div className={`border rounded-xl p-4 ${colores} ${hallazgo.resuelta ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <Icon />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{hallazgo.codigo_causal}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 font-semibold">
              {LABELS_CONCEPTO[concepto] ?? concepto}
            </span>
            {hallazgo.resuelta && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 font-semibold">
                Resuelta
              </span>
            )}
          </div>
          <p className="text-sm mt-1 leading-relaxed">{hallazgo.mensaje}</p>

          {expandida && (
            <div className="mt-3 space-y-1 text-xs opacity-80">
              {hallazgo.campo_afectado && (
                <div><strong>Campo:</strong> <code className="bg-white/50 px-1 rounded">{hallazgo.campo_afectado}</code></div>
              )}
              {hallazgo.valor_encontrado && (
                <div><strong>Encontrado:</strong> {hallazgo.valor_encontrado}</div>
              )}
              {hallazgo.valor_esperado && (
                <div><strong>Esperado:</strong> {hallazgo.valor_esperado}</div>
              )}
              {alerta?.como_resolver && (
                <div className="mt-2 bg-green-50/80 p-2 rounded-lg border border-green-200/60">
                  <strong>Cómo resolver:</strong> {alerta.como_resolver}
                </div>
              )}
              {alerta?.norma_legal && (
                <div className="mt-1 bg-gray-50/80 p-2 rounded-lg border border-gray-200/60 italic">
                  <strong>Base legal:</strong> {alerta.norma_legal}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setExpandida(!expandida)}
            className="text-xs px-2 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition font-medium"
          >
            {expandida ? "Menos" : "Detalle"}
          </button>
          {!hallazgo.resuelta && onResolver && (
            <button
              onClick={() => onResolver(hallazgo.id)}
              className="text-xs px-2 py-1 rounded-lg bg-white/80 hover:bg-green-200 transition font-medium text-green-700"
            >
              Resolver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PANEL PRINCIPAL DE VALIDACIÓN
// =====================================================================

interface PanelValidacionProps {
  resultado: ResultadoValidacion | null;
  glosas?: GlosaConDetalle[];
  resumen?: ResumenGlosas | null;
  onValidar?: () => void;
  onResolver?: (id: string) => void;
  /** Se invoca al presionar "Enviar de todas formas" (solo si no hay errores bloqueantes) */
  onEnviar?: () => void;
  cargando?: boolean;
}

export default function PanelValidacionGlosas({
  resultado,
  glosas = [],
  resumen = null,
  onValidar,
  onResolver,
  onEnviar,
  cargando = false,
}: PanelValidacionProps) {
  const [tab, setTab] = useState<"validacion" | "glosas" | "resumen">("validacion");
  const [filtroSeveridad, setFiltroSeveridad] = useState<SeveridadValidacion | "todas">("todas");
  const [filtroEstadoGlosa, setFiltroEstadoGlosa] = useState<EstadoGlosa | "todas">("todas");

  // Filtrar hallazgos
  const hallazgosFiltrados = useMemo(() => {
    if (!resultado) return [];
    return resultado.hallazgos.filter(
      (h) => filtroSeveridad === "todas" || h.severidad === filtroSeveridad
    );
  }, [resultado, filtroSeveridad]);

  // Filtrar glosas
  const glosasFiltradas = useMemo(() => {
    return glosas.filter(
      (g) => filtroEstadoGlosa === "todas" || g.estado === filtroEstadoGlosa
    );
  }, [glosas, filtroEstadoGlosa]);

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-medi-light/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-medi-deep to-medi-dark p-6 text-white">
        <div className="flex items-center gap-3">
          <IconShield />
          <div>
            <h2 className="text-xl font-black tracking-tight">
              Validación de Glosas y Devoluciones
            </h2>
            <p className="text-sm opacity-70">
              Res. 2284/2023 — Circular 007/2025
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-medi-light/30 flex">
        {(["validacion", "glosas", "resumen"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-medi-primary border-b-2 border-medi-primary bg-blue-50/50"
                : "text-medi-dark/50 hover:text-medi-dark"
            }`}
          >
            {t === "validacion" && "Pre-radicación"}
            {t === "glosas" && `Glosas (${glosas.length})`}
            {t === "resumen" && "Resumen"}
          </button>
        ))}
      </div>

      {/* TAB: Pre-radicación */}
      {tab === "validacion" && (
        <div className="p-6 space-y-4">
          {/* Botón validar */}
          {onValidar && (
            <button
              onClick={onValidar}
              disabled={cargando}
              className="w-full py-3 rounded-xl bg-medi-primary text-white font-bold text-sm uppercase tracking-wider hover:bg-medi-accent transition disabled:opacity-50"
            >
              {cargando ? "Validando..." : "Ejecutar validación pre-radicación"}
            </button>
          )}

          {resultado && (
            <>
              <BarraResumen resultado={resultado} />

              {/* Filtros */}
              <div className="flex gap-2 flex-wrap">
                {(["todas", "error", "advertencia", "info"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltroSeveridad(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                      filtroSeveridad === s
                        ? "bg-medi-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s === "todas" ? `Todas (${resultado.total_hallazgos})` : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Lista de hallazgos */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {hallazgosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <IconCheck />
                    <p className="mt-2 text-sm">Sin hallazgos en esta categoría</p>
                  </div>
                ) : (
                  hallazgosFiltrados.map((h, idx) => (
                    <TarjetaHallazgo
                      key={h.id}
                      hallazgo={h}
                      alerta={resultado.alertas[idx]}
                      onResolver={onResolver}
                    />
                  ))
                )}
              </div>

              {/* Estadísticas de prevención */}
              {resultado.glosas_potenciales_prevenidas.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-purple-800">
                    Esta validación previno {resultado.glosas_potenciales_prevenidas.length} glosas potenciales
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Códigos: {resultado.glosas_potenciales_prevenidas.join(", ")}
                  </p>
                </div>
              )}

              {/* Botón "Enviar de todas formas" — solo si no hay errores bloqueantes */}
              {resultado.puede_radicar && onEnviar && (
                <button
                  onClick={onEnviar}
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm uppercase tracking-wider hover:bg-green-700 transition"
                >
                  {resultado.advertencias > 0
                    ? "Enviar de todas formas (sin errores bloqueantes)"
                    : "Enviar factura"}
                </button>
              )}
            </>
          )}

          {!resultado && !cargando && (
            <div className="text-center py-12 text-gray-400">
              <div className="mx-auto w-12 h-12 mb-3 opacity-40">
                <IconShield />
              </div>
              <p className="text-sm">
                Ejecute la validación para verificar la factura antes de radicar
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB: Glosas recibidas */}
      {tab === "glosas" && (
        <div className="p-6 space-y-4">
          {/* Filtro estado */}
          <div className="flex gap-2 flex-wrap">
            {(["todas", "pendiente", "en_revision", "respondida", "aceptada", "rechazada_erp", "conciliada"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstadoGlosa(e)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                  filtroEstadoGlosa === e
                    ? "bg-medi-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {e === "todas" ? `Todas (${glosas.length})` : LABELS_ESTADO_GLOSA[e]}
              </button>
            ))}
          </div>

          {/* Lista de glosas */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {glosasFiltradas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Sin glosas en esta categoría</p>
              </div>
            ) : (
              glosasFiltradas.map((g) => (
                <TarjetaGlosa key={g.id} glosa={g} />
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: Resumen */}
      {tab === "resumen" && (
        <div className="p-6">
          {resumen ? (
            <ResumenPanel resumen={resumen} />
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No hay datos de resumen disponibles</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// TARJETA DE GLOSA RECIBIDA
// =====================================================================

function TarjetaGlosa({ glosa }: { glosa: GlosaConDetalle }) {
  const [expandida, setExpandida] = useState(false);
  const concepto = glosa.codigo_causal.slice(0, 2);
  const diasRestantes = glosa.plazo?.dias_habiles_rest;
  const vencida = glosa.plazo?.vencido ?? false;

  return (
    <div className="border rounded-xl p-4 bg-white hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-medi-deep">{glosa.codigo_causal}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${COLORES_ESTADO_GLOSA[glosa.estado]}`}>
              {LABELS_ESTADO_GLOSA[glosa.estado]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-semibold text-gray-600">
              {LABELS_CONCEPTO[concepto] ?? concepto}
            </span>
            {glosa.prevenible && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                Prevenible
              </span>
            )}
          </div>

          <p className="text-sm mt-1.5 text-gray-700 leading-relaxed">
            {glosa.causal?.descripcion ?? glosa.descripcion_erp}
          </p>

          {/* Plazo */}
          {glosa.plazo && (
            <div className={`mt-2 text-xs font-semibold ${vencida ? "text-red-600" : diasRestantes && diasRestantes <= 3 ? "text-amber-600" : "text-gray-500"}`}>
              {vencida
                ? "PLAZO VENCIDO — Silencio administrativo"
                : `${diasRestantes} días hábiles restantes (límite: ${new Date(glosa.plazo.fecha_limite).toLocaleDateString("es-CO")})`}
            </div>
          )}

          {/* Valor */}
          <div className="mt-2 text-sm font-bold text-medi-deep">
            Valor glosado: ${glosa.valor_glosado.toLocaleString("es-CO")}
          </div>

          {/* Detalle expandido */}
          {expandida && (
            <div className="mt-3 space-y-2 text-xs text-gray-600 border-t pt-3">
              {glosa.cups_afectado && <div><strong>CUPS:</strong> {glosa.cups_afectado}</div>}
              {glosa.cie10_afectado && <div><strong>CIE-10:</strong> {glosa.cie10_afectado}</div>}
              {glosa.num_autorizacion && <div><strong>Autorización:</strong> {glosa.num_autorizacion}</div>}
              {glosa.descripcion_erp && <div><strong>Observación EPS:</strong> {glosa.descripcion_erp}</div>}
              {glosa.sugerencia_auto && (
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                  <strong>Sugerencia Medibill:</strong> {glosa.sugerencia_auto}
                </div>
              )}
              {glosa.factura && (
                <div><strong>Factura:</strong> {glosa.factura.num_factura} — EPS: {glosa.factura.nit_erp}</div>
              )}

              {/* Respuestas */}
              {glosa.respuestas.length > 0 && (
                <div className="mt-2">
                  <strong>Respuestas enviadas:</strong>
                  {glosa.respuestas.map((r) => (
                    <div key={r.id} className="mt-1 bg-gray-50 p-2 rounded-lg">
                      <div className="font-semibold">{LABELS_RESPUESTA[r.codigo_respuesta]}</div>
                      <div className="mt-0.5">{r.justificacion}</div>
                      {r.fundamento_legal && (
                        <div className="mt-0.5 italic">Base legal: {r.fundamento_legal}</div>
                      )}
                      {r.decision_erp !== "pendiente" && (
                        <div className={`mt-0.5 font-bold ${r.decision_erp === "levantada" ? "text-green-600" : "text-red-600"}`}>
                          Decisión ERP: {r.decision_erp}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpandida(!expandida)}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition font-semibold text-gray-600 shrink-0"
        >
          {expandida ? "Menos" : "Ver más"}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// PANEL DE RESUMEN
// =====================================================================

function ResumenPanel({ resumen }: { resumen: ResumenGlosas }) {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Facturas" value={resumen.total_facturas} />
        <KPI label="Glosas totales" value={resumen.total_glosas} />
        <KPI label="Valor glosado" value={`$${(resumen.valor_total_glosado / 1_000_000).toFixed(1)}M`} />
        <KPI label="Tasa de éxito" value={`${resumen.tasa_exito.toFixed(0)}%`} highlight />
      </div>

      {/* Distribución por concepto */}
      <div>
        <h4 className="font-bold text-sm text-medi-deep mb-3 uppercase tracking-wider">
          Distribución por concepto
        </h4>
        <div className="space-y-2">
          {Object.entries(resumen.por_concepto).map(([concepto, data]) => {
            const pct = resumen.total_glosas > 0
              ? Math.round((data.cantidad / resumen.total_glosas) * 100)
              : 0;
            return (
              <div key={concepto} className="flex items-center gap-3">
                <span className="text-xs font-bold w-24 text-medi-dark">
                  {LABELS_CONCEPTO[concepto] ?? concepto}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-medi-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-16 text-right">
                  {data.cantidad} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Glosas próximas a vencer */}
      {resumen.vencen_pronto.length > 0 && (
        <div>
          <h4 className="font-bold text-sm text-red-600 mb-3 uppercase tracking-wider flex items-center gap-2">
            <IconWarn /> Próximas a vencer
          </h4>
          <div className="space-y-2">
            {resumen.vencen_pronto.map((g) => (
              <div key={g.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <div>
                  <span className="font-mono font-bold">{g.codigo_causal}</span>
                  <span className="ml-2 text-gray-600">{g.causal?.descripcion?.slice(0, 60)}...</span>
                </div>
                <span className="text-red-600 font-bold">
                  {g.plazo?.dias_habiles_rest ?? 0} días
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribución por estado */}
      <div>
        <h4 className="font-bold text-sm text-medi-deep mb-3 uppercase tracking-wider">
          Por estado
        </h4>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(resumen.por_estado) as [EstadoGlosa, number][]).map(([estado, cantidad]) => (
            <div
              key={estado}
              className={`px-3 py-2 rounded-xl text-xs font-bold ${COLORES_ESTADO_GLOSA[estado]}`}
            >
              {LABELS_ESTADO_GLOSA[estado]}: {cantidad}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 text-center ${highlight ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
      <div className={`text-2xl font-black ${highlight ? "text-green-600" : "text-medi-deep"}`}>
        {value}
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
