"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatCOP } from "@/lib/formato";
import type { FacturacionMensual, DistribucionEPS } from "@/lib/types/dashboard";

const COLORS_PIE = ["#0353a4", "#006daa", "#b9d6f2", "#003559", "#061a40", "#4dabf7", "#1971c2"];

export function BarChartFacturacion({ data }: { data: FacturacionMensual[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-medi-dark/40 text-center py-12">Sin datos de facturación</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes_label" tick={{ fontSize: 11, fill: "#003559" }} />
        <YAxis tick={{ fontSize: 10, fill: "#003559" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value) => formatCOP(Number(value))} labelFormatter={(l) => `Mes: ${l}`} />
        <Bar dataKey="valor_total" fill="#0353a4" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieChartEPS({ data }: { data: DistribucionEPS[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-medi-dark/40 text-center py-12">Sin datos</p>;
  }
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="valor_total" nameKey="eps_nombre" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
            {data.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => formatCOP(Number(value))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-2">
        {data.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_PIE[i % COLORS_PIE.length] }} />
            <span className="truncate flex-grow text-medi-deep">{e.eps_nombre}</span>
            <span className="font-bold text-medi-dark/60">{e.cantidad}</span>
          </div>
        ))}
      </div>
    </>
  );
}
