"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  obtenerFacturasPorEstado,
  obtenerKPIsGlosas,
  obtenerTopCausalesGlosa,
  obtenerGlosasPendientes,
  obtenerTendenciaGlosas,
  obtenerAlertasRadicacion,
  obtenerGlosasIlegales,
} from "@/app/actions";
import {
  LABELS_ESTADO_FACTURA,
  LABELS_CONCEPTO,
  type EstadoFactura,
} from "@/lib/types/glosas";

// =====================================================================
// Tipos locales para datos del dashboard
// =====================================================================

interface KPIs {
  totalFacturas: number;
  totalFacturado: number;
  totalGlosado: number;
  radicadas: number;
  glosadas: number;
  tasaGlosas: number;
}

interface TopCausal {
  codigo: string;
  descripcion: string;
  concepto: string;
  cantidad: number;
  valor: number;
}

interface GlosaPendiente {
  id: string;
  codigo_causal: string;
  valor_glosado: number;
  fecha_formulacion: string;
  fecha_limite_resp: string | null;
  estado: string;
  tipo: string;
  descripcion_erp: string | null;
  num_factura: string;
  diasRestantes: number | null;
  vencida: boolean;
}

interface TendenciaMes {
  mes: string;
  cantidad: number;
  valor: number;
}

interface AlertaRadicacion {
  id: string;
  num_factura: string;
  fecha_expedicion: string;
  fecha_limite_rad: string | null;
  valor_total: number;
  diasRestantes: number;
  vencida: boolean;
  urgente: boolean;
}

interface GlosaIlegal {
  glosa_id: string;
  num_factura: string;
  codigo_causal: string;
  valor_glosado: number;
  tipo_irregularidad: string;
  detalle: string;
}

// =====================================================================
// Helpers
// =====================================================================

const COLORES_CHART = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706", "#059669",
];

const ESTADOS_FACTURA: EstadoFactura[] = [
  "borrador", "radicada", "devuelta", "glosada",
  "respondida", "conciliada", "pagada",
];

const COLORES_ESTADO: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700",
  radicada: "bg-blue-100 text-blue-700",
  devuelta: "bg-orange-100 text-orange-700",
  glosada: "bg-red-100 text-red-700",
  respondida: "bg-indigo-100 text-indigo-700",
  conciliada: "bg-green-100 text-green-700",
  pagada: "bg-emerald-100 text-emerald-800",
};

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatPct(valor: number): string {
  return `${valor.toFixed(1)}%`;
}

// =====================================================================
// Sub-componentes
// =====================================================================

function KPICard({
  titulo,
  valor,
  subtitulo,
  icono,
  alerta,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  icono: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md border p-5 flex items-start gap-4 transition hover:shadow-lg ${
        alerta ? "border-red-300 bg-red-50/30" : "border-medi-light/50"
      }`}
    >
      <div
        className={`rounded-xl p-3 ${
          alerta
            ? "bg-red-100 text-red-600"
            : "bg-gradient-to-br from-medi-primary/10 to-medi-accent/10 text-medi-primary"
        }`}
      >
        {icono}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {titulo}
        </p>
        <p
          className={`text-2xl font-black mt-1 ${
            alerta ? "text-red-600" : "text-medi-deep"
          }`}
        >
          {valor}
        </p>
        {subtitulo && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden ${className}`}
    >
      <div className="px-6 py-4 border-b border-medi-light/30">
        <h3 className="font-bold text-sm text-medi-deep uppercase tracking-wider">
          {titulo}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// =====================================================================
// Componente principal
// =====================================================================

export default function DashboardGlosas() {
  const [loading, setLoading] = useState(true);
  const [facturasPorEstado, setFacturasPorEstado] = useState<
    Record<string, { cantidad: number; valor: number }>
  >({});
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [topCausales, setTopCausales] = useState<TopCausal[]>([]);
  const [pendientes, setPendientes] = useState<GlosaPendiente[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaMes[]>([]);
  const [alertasRad, setAlertasRad] = useState<AlertaRadicacion[]>([]);
  const [glosasIlegales, setGlosasIlegales] = useState<GlosaIlegal[]>([]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [fEstado, kpiData, topC, pend, tend, alertas, ilegales] =
        await Promise.all([
          obtenerFacturasPorEstado(),
          obtenerKPIsGlosas(),
          obtenerTopCausalesGlosa(),
          obtenerGlosasPendientes(),
          obtenerTendenciaGlosas(),
          obtenerAlertasRadicacion(),
          obtenerGlosasIlegales(),
        ]);
      setFacturasPorEstado(fEstado as Record<string, { cantidad: number; valor: number }>);
      setKpis(kpiData as KPIs | null);
      setTopCausales(topC as TopCausal[]);
      setPendientes(pend as GlosaPendiente[]);
      setTendencia(tend as TendenciaMes[]);
      setAlertasRad(alertas as AlertaRadicacion[]);
      setGlosasIlegales(ilegales as GlosaIlegal[]);
    } catch (err) {
      console.error("Error cargando dashboard de glosas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-medi-primary/30 border-t-medi-primary rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando dashboard de glosas…</p>
        </div>
      </div>
    );
  }

  // Datos para gráfico de facturas por estado
  const datosEstado = ESTADOS_FACTURA.map((estado) => ({
    estado: LABELS_ESTADO_FACTURA[estado] || estado,
    cantidad: facturasPorEstado[estado]?.cantidad || 0,
    valor: facturasPorEstado[estado]?.valor || 0,
  }));

  // Datos para pie chart de valor glosado vs aceptado
  const datosValor = [
    {
      name: "Valor glosado",
      value: kpis?.totalGlosado || 0,
    },
    {
      name: "Valor no glosado",
      value: (kpis?.totalFacturado || 0) - (kpis?.totalGlosado || 0),
    },
  ];

  const tasaGlosaColor =
    (kpis?.tasaGlosas || 0) < 5
      ? "text-green-600"
      : (kpis?.tasaGlosas || 0) < 10
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-medi-deep to-medi-dark rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              title="Volver al inicio"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
            <h2 className="text-2xl font-black tracking-tight">
              Dashboard de Glosas
            </h2>
            <p className="text-white/70 text-sm mt-1">
              Seguimiento y análisis del ciclo de glosas y devoluciones — Res. 2284/2023
            </p>
            </div>
          </div>
          <button
            onClick={cargarDatos}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition"
          >
            <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Total facturado"
          valor={formatCOP(kpis?.totalFacturado || 0)}
          subtitulo={`${kpis?.totalFacturas || 0} facturas`}
          icono={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
        />
        <KPICard
          titulo="Total glosado"
          valor={formatCOP(kpis?.totalGlosado || 0)}
          subtitulo={`${kpis?.glosadas || 0} facturas glosadas`}
          icono={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          alerta={(kpis?.totalGlosado || 0) > 0}
        />
        <KPICard
          titulo="Tasa de glosas"
          valor={formatPct(kpis?.tasaGlosas || 0)}
          subtitulo={`Meta < 5% — ${
            (kpis?.tasaGlosas || 0) < 5 ? "✓ En meta" : "⚠ Por encima"
          }`}
          icono={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          alerta={(kpis?.tasaGlosas || 0) >= 5}
        />
        <KPICard
          titulo="Pendientes de respuesta"
          valor={String(pendientes.length)}
          subtitulo={
            pendientes.filter((p) => p.vencida).length > 0
              ? `${pendientes.filter((p) => p.vencida).length} vencidas ⚠`
              : "Todas en plazo"
          }
          icono={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          alerta={pendientes.filter((p) => p.vencida).length > 0}
        />
      </div>

      {/* Fila 1: Facturas por estado + Valor glosado vs facturado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard titulo="Facturas por estado" className="lg:col-span-2">
          {datosEstado.some((d) => d.cantidad > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosEstado} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="estado"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    name === "cantidad" ? (value ?? 0) : formatCOP(Number(value ?? 0)),
                    name === "cantidad" ? "Facturas" : "Valor",
                  ]}
                />
                <Bar dataKey="cantidad" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              Sin datos de facturas aún
            </div>
          )}
          {/* Badges de estado */}
          <div className="flex flex-wrap gap-2 mt-4">
            {ESTADOS_FACTURA.map((estado) => {
              const data = facturasPorEstado[estado];
              if (!data) return null;
              return (
                <span
                  key={estado}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${COLORES_ESTADO[estado]}`}
                >
                  {LABELS_ESTADO_FACTURA[estado]}: {data.cantidad}
                </span>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard titulo="Glosado vs Facturado">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={datosValor}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                <Cell fill="#ef4444" />
                <Cell fill="#22c55e" />
              </Pie>
              <Tooltip
                formatter={(value) => formatCOP(Number(value ?? 0))}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <span className={`text-2xl font-black ${tasaGlosaColor}`}>
              {formatPct(
                kpis?.totalFacturado
                  ? ((kpis?.totalGlosado || 0) / kpis.totalFacturado) * 100
                  : 0
              )}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">del total facturado</p>
          </div>
        </SectionCard>
      </div>

      {/* Fila 2: Top causales + Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard titulo="Top 5 causales de glosa">
          {topCausales.length > 0 ? (
            <div className="space-y-3">
              {topCausales.map((causal, idx) => (
                <div
                  key={causal.codigo}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ backgroundColor: COLORES_CHART[idx] }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-medi-deep">
                        {causal.codigo}
                      </span>
                      {causal.concepto && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-medi-primary/10 text-medi-primary">
                          {LABELS_CONCEPTO[causal.concepto] || causal.concepto}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {causal.descripcion}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-medi-deep">
                      {causal.cantidad}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatCOP(causal.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">
              Sin glosas registradas
            </div>
          )}
        </SectionCard>

        <SectionCard titulo="Tendencia de glosas — Últimos 6 meses">
          {tendencia.length > 0 && tendencia.some((t) => t.cantidad > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendencia} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    name === "cantidad" ? (value ?? 0) : formatCOP(Number(value ?? 0)),
                    name === "cantidad" ? "Glosas" : "Valor glosado",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="cantidad"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#2563eb" }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: "#7c3aed" }}
                  yAxisId="right"
                  hide
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
              Sin datos de tendencia aún
            </div>
          )}
        </SectionCard>
      </div>

      {/* Fila 3: Glosas pendientes de respuesta */}
      <SectionCard titulo={`Glosas pendientes de respuesta (${pendientes.length})`}>
        {pendientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="pb-3 pr-4">Factura</th>
                  <th className="pb-3 pr-4">Causal</th>
                  <th className="pb-3 pr-4">Tipo</th>
                  <th className="pb-3 pr-4 text-right">Valor</th>
                  <th className="pb-3 pr-4 text-center">Días restantes</th>
                  <th className="pb-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendientes.map((g) => (
                  <tr
                    key={g.id}
                    className={`hover:bg-slate-50 transition ${
                      g.vencida ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-medi-deep">
                      {g.num_factura}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs font-bold">
                        {g.codigo_causal}
                      </span>
                      {g.descripcion_erp && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          {g.descripcion_erp}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.tipo === "devolucion"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {g.tipo === "devolucion" ? "Devolución" : "Glosa"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-xs">
                      {formatCOP(g.valor_glosado)}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {g.diasRestantes !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                            g.vencida
                              ? "bg-red-100 text-red-700"
                              : g.diasRestantes <= 3
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {g.vencida ? (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              VENCIDA
                            </>
                          ) : (
                            `${g.diasRestantes}d`
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.estado === "pendiente"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {g.estado === "pendiente" ? "Pendiente" : "En revisión"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[120px] text-sm text-slate-400">
            <svg className="w-5 h-5 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No hay glosas pendientes de respuesta
          </div>
        )}
      </SectionCard>

      {/* Fila 4: Irregularidades + Alertas de radicación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Glosas extemporáneas / ilegales */}
        <SectionCard
          titulo={`Glosas irregulares detectadas (${glosasIlegales.length})`}
        >
          {glosasIlegales.length > 0 ? (
            <div className="space-y-3">
              {glosasIlegales.map((gi, idx) => (
                <div
                  key={`${gi.glosa_id}-${idx}`}
                  className="p-4 rounded-xl border border-red-200 bg-red-50/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-red-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-black text-red-700 uppercase">
                      {gi.tipo_irregularidad}
                    </span>
                    <span className="text-xs font-mono text-red-500">
                      {gi.codigo_causal}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {gi.detalle}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-red-100">
                    <span className="text-[10px] text-slate-400">
                      Factura: {gi.num_factura}
                    </span>
                    <span className="text-xs font-bold text-red-600">
                      {formatCOP(gi.valor_glosado)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-sm text-slate-400">
              <svg className="w-5 h-5 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No se detectaron irregularidades
            </div>
          )}
        </SectionCard>

        {/* Alertas de radicación */}
        <SectionCard
          titulo={`Alertas de radicación (${alertasRad.length})`}
        >
          {alertasRad.length > 0 ? (
            <div className="space-y-3">
              {alertasRad.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-4 rounded-xl border ${
                    alerta.vencida
                      ? "border-red-300 bg-red-50"
                      : alerta.urgente
                      ? "border-amber-300 bg-amber-50"
                      : "border-blue-200 bg-blue-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {alerta.vencida ? (
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span className="font-mono text-sm font-bold text-medi-deep">
                        {alerta.num_factura}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        alerta.vencida
                          ? "bg-red-200 text-red-800"
                          : alerta.urgente
                          ? "bg-amber-200 text-amber-800"
                          : "bg-blue-200 text-blue-800"
                      }`}
                    >
                      {alerta.vencida
                        ? `Venció hace ${Math.abs(alerta.diasRestantes)}d`
                        : `${alerta.diasRestantes}d restantes`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>Valor: {formatCOP(alerta.valor_total)}</span>
                    <span>
                      Límite:{" "}
                      {alerta.fecha_limite_rad
                        ? new Date(alerta.fecha_limite_rad).toLocaleDateString("es-CO")
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-sm text-slate-400">
              <svg className="w-5 h-5 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sin alertas de radicación
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
