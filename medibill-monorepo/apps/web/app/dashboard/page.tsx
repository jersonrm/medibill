"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { obtenerKPIsDashboard, obtenerFacturacionMensual, obtenerDistribucionEPS, obtenerItemsAtencion } from "@/app/actions/dashboard";
import { obtenerAlertasCartera } from "@/app/actions/pagos";
import type { AlertaCartera } from "@/app/actions/pagos";
import { formatCOP } from "@/lib/formato";
import type { KPIDashboard, FacturacionMensual, DistribucionEPS, ItemAtencion } from "@/lib/types/dashboard";
import BenchmarkPanel from "@/components/dashboard/BenchmarkPanel";

const DashboardBarChart = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.BarChartFacturacion })),
  { ssr: false, loading: () => <div className="h-[250px] animate-pulse bg-medi-light/20 rounded-xl" /> },
);
const DashboardPieChart = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.PieChartEPS })),
  { ssr: false, loading: () => <div className="h-[180px] animate-pulse bg-medi-light/20 rounded-xl" /> },
);

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIDashboard | null>(null);
  const [mensual, setMensual] = useState<FacturacionMensual[]>([]);
  const [eps, setEps] = useState<DistribucionEPS[]>([]);
  const [items, setItems] = useState<ItemAtencion[]>([]);
  const [alertasCartera, setAlertasCartera] = useState<AlertaCartera[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [k, m, e, i, ac] = await Promise.all([
        obtenerKPIsDashboard(),
        obtenerFacturacionMensual(),
        obtenerDistribucionEPS(),
        obtenerItemsAtencion(),
        obtenerAlertasCartera(),
      ]);
      setKpis(k);
      setMensual(m);
      setEps(e);
      setItems(i);
      setAlertasCartera(ac);
      setCargando(false);
    };
    load();
  }, []);

  if (cargando) {
    return (
      <div className="max-w-[1200px] mx-auto p-8">
        <h1 className="text-3xl font-black text-medi-deep mb-6">Dashboard</h1>
        <div className="text-center py-20 text-medi-dark/50 animate-pulse">Cargando indicadores...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      <h1 className="text-3xl font-black text-medi-deep mb-8 flex items-center gap-3">
        <div className="w-2 h-8 bg-medi-accent rounded-full" /> Dashboard
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard label="Facturas este mes" value={String(kpis?.facturas_mes || 0)} sublabel={kpis ? formatCOP(kpis.valor_facturado_mes) : "$0"} color="bg-medi-primary" />
        <KPICard label="Pendientes descarga" value={String(kpis?.pendientes_descarga || 0)} sublabel="Aprobadas sin descargar" color="bg-amber-500" />
        <KPICard label="Glosas activas" value={String(kpis?.glosas_activas || 0)} sublabel={kpis ? formatCOP(kpis.valor_glosado_activo) : "$0"} color="bg-red-500" />
        <KPICard label="Tasa recuperación" value={`${kpis?.tasa_recuperacion || 0}%`} sublabel="De glosas resueltas" color="bg-green-600" />
        <KPICard label="Cartera pendiente" value={kpis ? formatCOP(kpis.cartera_pendiente) : "$0"} sublabel={`${kpis?.facturas_en_cartera || 0} facturas por cobrar`} color="bg-emerald-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Facturación mensual */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Facturación Mensual</h3>
          <DashboardBarChart data={mensual} />
        </div>

        {/* Distribución EPS */}
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Distribución por EPS</h3>
          <DashboardPieChart data={eps} />
        </div>
      </div>

      {/* Benchmarks — Inteligencia Colectiva */}
      <BenchmarkPanel />

      {/* Alertas de cartera con contexto EPS */}
      {alertasCartera.length > 0 && (
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm mb-8">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">💰 Alertas de Cartera</h3>
          <div className="space-y-2">
            {alertasCartera.slice(0, 10).map((alerta) => (
              <Link
                href={`/pagos?factura=${alerta.factura_id}`}
                key={alerta.factura_id}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:bg-medi-light/10 ${
                  alerta.semaforo === "rojo"
                    ? "border-red-200 bg-red-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  alerta.semaforo === "rojo" ? "bg-red-500" : "bg-amber-500"
                }`} />
                <div className="flex-grow min-w-0">
                  <span className="text-sm font-bold text-medi-deep">{alerta.num_factura}</span>
                  <span className="ml-2 text-[10px] text-medi-dark/40">{alerta.eps_nombre}</span>
                  <p className="text-xs text-medi-dark/60 truncate">{alerta.mensaje}</p>
                </div>
                <span className="text-xs font-bold text-medi-dark/40 flex-shrink-0">
                  {alerta.dias_antiguedad}d
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Requiere atención */}
      <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm mb-8">
        <h3 className="text-xs font-black text-medi-dark uppercase mb-4">⚠️ Requiere atención</h3>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <Link href={item.url} key={item.id}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:bg-medi-light/10 ${
                  item.urgencia === "alta" ? "border-red-200 bg-red-50/50" :
                  item.urgencia === "media" ? "border-amber-200 bg-amber-50/50" : "border-medi-light/30"
                }`}>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  item.tipo === "glosa_por_vencer" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {item.tipo === "glosa_por_vencer" ? "Glosa" : "Factura"}
                </span>
                <div className="flex-grow">
                  <span className="text-sm font-bold text-medi-deep">{item.titulo}</span>
                  <span className="ml-3 text-xs text-medi-dark/50">{item.descripcion}</span>
                </div>
                <span className="text-medi-primary text-xs">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-600 text-center py-4">✓ Todo al día — no hay glosas por vencer ni facturas pendientes de aprobación</p>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <QuickLink href="/" label="Nueva Factura" icon="📝" />
        <QuickLink href="/facturas" label="Facturas" icon="📋" />
        <QuickLink href="/pagos" label="Cartera" icon="💰" />
        <QuickLink href="/glosas" label="Glosas" icon="⚖️" />
        <QuickLink href="/configuracion" label="Configuración" icon="⚙️" />
      </div>
    </div>
  );
}

function KPICard({ label, value, sublabel, color }: { label: string; value: string; sublabel: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm">
      <div className={`w-10 h-1.5 rounded-full ${color} mb-3`} />
      <div className="text-3xl font-black text-medi-deep">{value}</div>
      <div className="text-xs font-bold text-medi-dark/60 uppercase mt-1">{label}</div>
      <div className="text-[10px] text-medi-dark/40 mt-1">{sublabel}</div>
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm hover:border-medi-primary hover:shadow-md transition-all flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-bold text-medi-deep">{label}</span>
    </Link>
  );
}
