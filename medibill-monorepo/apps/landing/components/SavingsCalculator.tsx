"use client";

import { useState } from "react";

/* ─── Constantes del estudio de marketing ─── */
const MINUTOS_MANUAL_POR_CONSULTA = 18; // Codificación RIPS manual promedio
const MINUTOS_IA_POR_CONSULTA = 2;      // Con Medibill IA
const MINUTOS_AHORRADOS = MINUTOS_MANUAL_POR_CONSULTA - MINUTOS_IA_POR_CONSULTA;
const VALOR_HORA_MEDICO_COP = 150_000;  // Ingreso promedio por hora de consulta
const VALOR_MINUTO = VALOR_HORA_MEDICO_COP / 60;

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SavingsCalculator() {
  const [consultasMes, setConsultasMes] = useState(200);

  const horasAhorradasMes = (consultasMes * MINUTOS_AHORRADOS) / 60;
  const dineroAhorradoMes = consultasMes * MINUTOS_AHORRADOS * VALOR_MINUTO;
  const dineroAhorradoAnio = dineroAhorradoMes * 12;
  const diasLaboralesRecuperados = Math.round(horasAhorradasMes / 8);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
        <div className="grid gap-0 lg:grid-cols-2">
          {/* ── Lado izquierdo: slider ── */}
          <div className="flex flex-col justify-center p-8 md:p-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-medi-primary">
              Calculadora de ahorro
            </p>
            <h3 className="mt-2 text-2xl font-bold text-medi-deep">
              ¿Cuántas consultas facturas al mes?
            </h3>
            <p className="mt-2 text-gray-500">
              Mueve el slider y descubre cuánto tiempo y dinero recuperas
              al automatizar la codificación RIPS con IA.
            </p>

            <div className="mt-8">
              <div className="flex items-end justify-between">
                <span className="text-sm text-gray-500">Consultas / mes</span>
                <span className="text-3xl font-bold text-medi-deep">
                  {consultasMes}
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={10}
                value={consultasMes}
                onChange={(e) => setConsultasMes(Number(e.target.value))}
                className="mt-3 w-full cursor-pointer accent-medi-primary"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>50</span>
                <span>500</span>
                <span>1.000</span>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-medi-light/15 p-4">
              <p className="text-xs text-gray-500">
                <strong>Basado en estudio de campo:</strong> un profesional
                de salud invierte en promedio{" "}
                <strong>{MINUTOS_MANUAL_POR_CONSULTA} min</strong> en
                codificación manual RIPS por consulta. Con Medibill IA ese
                tiempo baja a <strong>{MINUTOS_IA_POR_CONSULTA} min</strong>.
              </p>
            </div>
          </div>

          {/* ── Lado derecho: resultados ── */}
          <div className="flex flex-col justify-center gap-6 bg-gradient-to-br from-medi-deep to-medi-dark p-8 text-white md:p-10">
            <ResultCard
              icon="💰"
              label="Dinero recuperado al mes"
              value={formatCOP(dineroAhorradoMes)}
              highlight
            />
            <ResultCard
              icon="📅"
              label="Ahorro proyectado al año"
              value={formatCOP(dineroAhorradoAnio)}
            />
            <ResultCard
              icon="⏱️"
              label="Horas recuperadas al mes"
              value={`${Math.round(horasAhorradasMes)} horas`}
            />
            <ResultCard
              icon="🗓️"
              label="Días laborales que recuperas"
              value={`${diasLaboralesRecuperados} días / mes`}
            />
          </div>
        </div>
      </div>

      {/* ── Tarjetas comparativas debajo ── */}
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <ComparisonCard
          emoji="🐌"
          title="Sin Medibill"
          items={[
            `${MINUTOS_MANUAL_POR_CONSULTA} min por consulta en codificación`,
            "Errores de digitación en códigos CUPS",
            "Glosas frecuentes por inconsistencias",
            "Facturación retrasada días o semanas",
          ]}
          negative
        />
        <ComparisonCard
          emoji="🚀"
          title="Con Medibill"
          items={[
            `${MINUTOS_IA_POR_CONSULTA} min por consulta con IA`,
            "Códigos sugeridos y validados automáticamente",
            "Reducción de glosas por validación previa",
            "Facturación el mismo día de la atención",
          ]}
        />
        <ComparisonCard
          emoji="📊"
          title="El resultado"
          items={[
            `${MINUTOS_AHORRADOS} min ahorrados por consulta`,
            "Más consultas atendidas por día",
            "Cobro más rápido a las EPS",
            "Mayor ingreso neto mensual",
          ]}
          result
        />
      </div>
    </div>
  );
}

/* ── Sub-componentes ── */

function ResultCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl px-5 py-4 ${
        highlight
          ? "bg-white/15 ring-1 ring-white/20"
          : "bg-white/5"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-300">
          {label}
        </p>
        <p className={`text-xl font-bold ${highlight ? "text-green-300" : "text-white"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ComparisonCard({
  emoji,
  title,
  items,
  negative,
  result,
}: {
  emoji: string;
  title: string;
  items: string[];
  negative?: boolean;
  result?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        negative
          ? "border-red-100 bg-red-50/50"
          : result
            ? "border-medi-light bg-medi-light/10"
            : "border-green-100 bg-green-50/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h4 className="font-bold text-medi-deep">{title}</h4>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5">
              {negative ? "❌" : result ? "📈" : "✅"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
