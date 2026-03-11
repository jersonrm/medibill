"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  GlosaRecibidaEnriquecida,
  RespuestaConGlosa,
  ResumenGlosasRecibidas,
} from "@/lib/types/glosas";
import {
  obtenerMisPendientes,
  type ResumenPendientes,
  type PendienteItem,
  obtenerGlosasRecibidas,
  obtenerHistorialRespuestas,
  obtenerResumenGlosasRecibidas,
} from "@/app/actions";
import TarjetaGlosa from "@/components/glosas/TarjetaGlosa";
import FormularioRespuestaGlosa from "@/components/glosas/FormularioRespuestaGlosa";
import ResumenRespuesta from "@/components/glosas/ResumenRespuesta";

const ModalRegistrarGlosa = dynamic(() => import("@/components/glosas/ModalRegistrarGlosa"), { ssr: false });

// =====================================================================
// Helpers
// =====================================================================

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
// Tipos y constantes locales
// =====================================================================

type Vista = "pendientes" | "glosas" | "respondidas";

const URGENCIA_STYLES: Record<string, string> = {
  vencida: "border-red-300 bg-red-50/60",
  urgente: "border-amber-300 bg-amber-50/40",
  normal: "border-slate-200 bg-white",
};

const TIPO_TAG: Record<string, { bg: string; label: string }> = {
  factura_borrador: { bg: "bg-blue-100 text-blue-700", label: "Factura" },
  glosa_pendiente: { bg: "bg-red-100 text-red-700", label: "Glosa" },
  alerta_radicacion: { bg: "bg-amber-100 text-amber-700", label: "Alerta" },
  glosa_irregular: { bg: "bg-purple-100 text-purple-700", label: "Irregular" },
};

// =====================================================================
// Sub-componentes
// =====================================================================

function KPICompacto({
  titulo,
  valor,
  subtitulo,
  alerta,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        alerta ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {titulo}
      </p>
      <p
        className={`text-lg font-black mt-0.5 ${
          alerta ? "text-red-600" : "text-medi-deep"
        }`}
      >
        {valor}
      </p>
      {subtitulo && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitulo}</p>
      )}
    </div>
  );
}

function PendienteRow({ item }: { item: PendienteItem }) {
  const tag = TIPO_TAG[item.tipo] ?? TIPO_TAG.factura_borrador!;

  return (
    <div
      className={`rounded-lg border p-3 transition hover:shadow-sm ${URGENCIA_STYLES[item.urgencia]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tag!.bg}`}>
              {tag!.label}
            </span>
            {item.urgencia === "vencida" && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">
                VENCIDA
              </span>
            )}
            {item.urgencia === "urgente" && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                URGENTE
              </span>
            )}
            {item.diasRestantes !== null && item.urgencia === "normal" && (
              <span className="text-[9px] text-slate-400">{item.diasRestantes}d</span>
            )}
          </div>
          <p className="text-xs font-bold text-medi-deep truncate">{item.titulo}</p>
          <p className="text-[10px] text-slate-400 truncate">{item.subtitulo}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs font-black text-medi-deep">{formatCOP(item.valor)}</span>
          <Link
            href={item.accion.href}
            className="px-2 py-1 bg-medi-primary text-white text-[10px] font-bold rounded-md hover:bg-medi-primary/90 transition"
          >
            {item.accion.label} →
          </Link>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Componente principal
// =====================================================================

export default function GestionGlosas() {
  // ── State ──
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("pendientes");

  // Dashboard data
  const [resumenPendientes, setResumenPendientes] = useState<ResumenPendientes | null>(null);

  // Responder glosas data
  const [glosas, setGlosas] = useState<GlosaRecibidaEnriquecida[]>([]);
  const [historial, setHistorial] = useState<RespuestaConGlosa[]>([]);
  const [resumenGlosas, setResumenGlosas] = useState<ResumenGlosasRecibidas | null>(null);
  const [glosaSeleccionada, setGlosaSeleccionada] = useState<GlosaRecibidaEnriquecida | null>(null);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);

  // ── Cargar datos ──
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [pendientesData, glosasData, historialData, resumenData] = await Promise.all([
        obtenerMisPendientes(),
        obtenerGlosasRecibidas(),
        obtenerHistorialRespuestas(),
        obtenerResumenGlosasRecibidas(),
      ]);
      setResumenPendientes(pendientesData);
      setGlosas(glosasData);
      setHistorial(historialData);
      setResumenGlosas(resumenData);
    } catch (err) {
      console.error("Error cargando datos de glosas:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Handlers ──
  const handleSeleccionarGlosa = useCallback((glosa: GlosaRecibidaEnriquecida) => {
    setGlosaSeleccionada(glosa);
  }, []);

  const handleRespuestaRegistrada = useCallback(() => {
    setGlosaSeleccionada(null);
    cargarDatos();
  }, [cargarDatos]);

  const handleCancelar = useCallback(() => {
    setGlosaSeleccionada(null);
  }, []);

  // ── Derivados ──
  const kpis = resumenPendientes?.kpis;
  const pendientes = resumenPendientes?.pendientes || [];

  const glosaPendientes = glosas.filter((g) => g.estado === "pendiente");
  const glosasRespondidas = glosas.filter(
    (g) => g.estado === "respondida" || g.estado === "en_conciliacion"
  );

  const hayVencidas = pendientes.some((p) => p.urgencia === "vencida");

  // ── Loading ──
  if (cargando) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-medi-primary/30 border-t-medi-primary rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando gestión de glosas…</p>
        </div>
      </div>
    );
  }

  // ── Tabs config ──
  const tabs: { key: Vista; label: string; count: number }[] = [
    { key: "pendientes", label: "Mis Pendientes", count: pendientes.length },
    { key: "glosas", label: "Glosas Recibidas", count: glosaPendientes.length },
    { key: "respondidas", label: "Respondidas", count: glosasRespondidas.length },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* ═══════════════════ Header ═══════════════════ */}
      <div className="bg-gradient-to-r from-medi-deep to-medi-dark rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
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
              <h2 className="text-xl font-black tracking-tight">Gestión de Glosas</h2>
              <p className="text-white/60 text-xs mt-0.5">
                Pendientes, respuestas RS01-RS05 y alertas — Res. 2284/2023
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/validar-factura"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition"
            >
              Validar Facturas
            </Link>
            <button
              onClick={() => setModalAbierto(true)}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Registrar Glosa
            </button>
            <button
              onClick={cargarDatos}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition"
              title="Actualizar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════ Alerta vencidas ═══════════════════ */}
      {hayVencidas && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-bold text-red-700">
              {pendientes.filter((p) => p.urgencia === "vencida").length} pendiente(s) con plazo vencido
            </p>
            <p className="text-xs text-red-600 mt-0.5">Requieren atención inmediata</p>
          </div>
        </div>
      )}

      {/* ═══════════════════ KPIs compactos ═══════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <KPICompacto
          titulo="Facturado"
          valor={formatCOP(kpis?.totalFacturado || 0)}
        />
        <KPICompacto
          titulo="Glosado"
          valor={formatCOP(kpis?.totalGlosado || 0)}
          subtitulo={`Tasa: ${formatPct(kpis?.tasaGlosas || 0)}`}
          alerta={(kpis?.totalGlosado || 0) > 0}
        />
        <KPICompacto
          titulo="Pendientes"
          valor={String(kpis?.pendientesTotal || 0)}
          subtitulo={hayVencidas ? "Con vencidas ⚠" : "Al día"}
          alerta={hayVencidas}
        />
        <KPICompacto
          titulo="Glosas recibidas"
          valor={String(glosas.length)}
          subtitulo={`${glosaPendientes.length} sin responder`}
          alerta={glosaPendientes.length > 0}
        />
        <KPICompacto
          titulo="Controvertido"
          valor={formatCOP(resumenGlosas?.total_controvertido || 0)}
          subtitulo={`Recup: ${resumenGlosas?.tasa_recuperacion || 0}%`}
        />
        <KPICompacto
          titulo="Nota crédito"
          valor={formatCOP(resumenGlosas?.total_nota_credito || 0)}
          subtitulo="Pérdida real"
          alerta={(resumenGlosas?.total_nota_credito || 0) > 0}
        />
      </div>

      {/* ═══════════════════ Tabs ═══════════════════ */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setVista(tab.key);
              setGlosaSeleccionada(null);
            }}
            className={`
              flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all
              ${vista === tab.key
                ? "bg-white text-medi-deep shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1.5 ${
                vista === tab.key
                  ? "bg-medi-primary text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ═══════════════════ Contenido según vista ═══════════════════ */}

      {/* ── Vista: Mis Pendientes (alertas + facturas borrador + irregularidades) ── */}
      {vista === "pendientes" && (
        <div className="space-y-3">
          {pendientes.length > 0 ? (
            pendientes.map((item) => <PendienteRow key={item.id} item={item} />)
          ) : (
            <VacioCard
              emoji="✅"
              titulo="¡Todo al día!"
              descripcion="No tienes facturas ni glosas pendientes por el momento."
            />
          )}
        </div>
      )}

      {/* ── Vista: Glosas Recibidas (lista + formulario respuesta) ── */}
      {vista === "glosas" && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Lista de glosas */}
          <div className="xl:col-span-2 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
            {glosaPendientes.length === 0 ? (
              <VacioCard
                emoji="📭"
                titulo="Sin glosas pendientes"
                descripcion='Usa "Registrar Glosa" para agregar una glosa recibida de la EPS.'
              />
            ) : (
              glosaPendientes.map((g) => (
                <TarjetaGlosa
                  key={g.id}
                  glosa={g}
                  seleccionada={glosaSeleccionada?.id === g.id}
                  onClick={handleSeleccionarGlosa}
                />
              ))
            )}
          </div>

          {/* Formulario o estado vacío */}
          <div className="xl:col-span-3">
            {glosaSeleccionada ? (
              <FormularioRespuestaGlosa
                key={glosaSeleccionada.id}
                glosa={glosaSeleccionada}
                onRespuestaRegistrada={handleRespuestaRegistrada}
                onCancelar={handleCancelar}
              />
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-medi-light/70 p-10 text-center">
                <div className="text-4xl mb-3 opacity-50">⚖</div>
                <h3 className="text-base font-semibold text-gray-400 mb-1">
                  Seleccione una glosa para responder
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Haga clic en una glosa de la lista para abrir el formulario RS01-RS05.
                  Use el asistente IA para obtener sugerencias automáticas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista: Respondidas (historial) ── */}
      {vista === "respondidas" && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Lista de respondidas */}
          <div className="xl:col-span-2 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
            {glosasRespondidas.length === 0 ? (
              <VacioCard
                emoji="📝"
                titulo="Sin respuestas aún"
                descripcion="Las glosas respondidas aparecerán aquí."
              />
            ) : (
              glosasRespondidas.map((g) => (
                <TarjetaGlosa
                  key={g.id}
                  glosa={g}
                  seleccionada={glosaSeleccionada?.id === g.id}
                  onClick={handleSeleccionarGlosa}
                />
              ))
            )}
          </div>

          {/* Historial o detalle */}
          <div className="xl:col-span-3">
            {glosaSeleccionada ? (
              <FormularioRespuestaGlosa
                key={glosaSeleccionada.id}
                glosa={glosaSeleccionada}
                onRespuestaRegistrada={handleRespuestaRegistrada}
                onCancelar={handleCancelar}
              />
            ) : historial.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Historial de respuestas
                </h3>
                {historial.map((r) => (
                  <ResumenRespuesta key={r.id} respuesta={r} />
                ))}
              </div>
            ) : (
              <VacioCard
                emoji="📋"
                titulo="Sin historial"
                descripcion="Cuando responda glosas, el historial aparecerá aquí."
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ Nota legal ═══════════════════ */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[10px] text-gray-400 leading-relaxed">
        <strong className="text-gray-500">Base normativa:</strong> El prestador tiene 15 días hábiles
        para responder glosas (Art. 57 Ley 1438/2011). El silencio implica aceptación tácita.
        Las glosas formuladas después de 20 días hábiles son extemporáneas (silencio positivo).
        Causas taxativas — Res. 2284/2023.
      </div>

      {/* ═══════════════════ Modal ═══════════════════ */}
      <ModalRegistrarGlosa
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGlosaRegistrada={cargarDatos}
      />
    </div>
  );
}

// =====================================================================
// Vacío reutilizable
// =====================================================================

function VacioCard({
  emoji,
  titulo,
  descripcion,
}: {
  emoji: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-medi-light/50 p-8 text-center">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="text-sm font-semibold text-gray-500">{titulo}</p>
      <p className="text-xs text-gray-400 mt-1">{descripcion}</p>
    </div>
  );
}
