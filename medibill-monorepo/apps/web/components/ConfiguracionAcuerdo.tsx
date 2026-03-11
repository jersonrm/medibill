"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  obtenerAcuerdos,
  obtenerAcuerdoConTarifas,
  guardarAcuerdo,
  guardarTarifasAcuerdo,
  eliminarAcuerdo,
  buscarCupsParaTarifa,
} from "@/app/actions";
import { obtenerTarifaReferencia } from "@/app/actions/benchmarks";
import type { TarifaReferencia } from "@/app/actions/benchmarks";

// =====================================================================
// Tipos locales
// =====================================================================

interface Acuerdo {
  id: string;
  eps_codigo: string;
  nombre_eps: string | null;
  email_radicacion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  tarifario_base: string;
  porcentaje_sobre_base: number;
  requiere_autorizacion: boolean;
  observaciones: string | null;
  activo: boolean;
}

interface Tarifa {
  id?: string;
  cups_codigo: string;
  cups_descripcion?: string;
  valor_pactado: number;
  incluye_honorarios: boolean;
  incluye_materiales: boolean;
  es_paquete: boolean;
  servicios_incluidos_paquete: string[];
  observaciones: string;
}

interface CupsItem {
  codigo: string;
  descripcion: string;
}

// EPS más comunes de Colombia
const EPS_LISTA = [
  { codigo: "EPS001", nombre: "Nueva EPS", emailRadicacion: "radicacionelectronica@nuevaeps.com.co" },
  { codigo: "EPS002", nombre: "Sura EPS", emailRadicacion: "radicacion@epssura.com.co" },
  { codigo: "EPS003", nombre: "Sanitas EPS", emailRadicacion: "radicacion@epssanitas.com" },
  { codigo: "EPS005", nombre: "Salud Total", emailRadicacion: "radicacion@saludtotal.com.co" },
  { codigo: "EPS008", nombre: "Compensar EPS", emailRadicacion: "radicacion@compensar.com" },
  { codigo: "EPS010", nombre: "Famisanar", emailRadicacion: "radicacion@famisanar.com.co" },
  { codigo: "EPS012", nombre: "Comfenalco Valle", emailRadicacion: "radicacion@comfenalcovalle.com.co" },
  { codigo: "EPS013", nombre: "SOS EPS", emailRadicacion: "radicacion@sos.com.co" },
  { codigo: "EPS016", nombre: "Coosalud", emailRadicacion: "radicacion@coosalud.com" },
  { codigo: "EPS017", nombre: "Mutual Ser", emailRadicacion: "radicacion@mutualser.com" },
  { codigo: "EPS018", nombre: "Aliansalud", emailRadicacion: "radicacion@aliansalud.com.co" },
  { codigo: "EPS023", nombre: "Cruz Blanca", emailRadicacion: "radicacion@cruzblanca.com.co" },
  { codigo: "EPS033", nombre: "Capital Salud", emailRadicacion: "radicacion@capitalsalud.gov.co" },
  { codigo: "EPS037", nombre: "Cajacopi", emailRadicacion: "radicacion@cajacopi.com" },
  { codigo: "EPS044", nombre: "Emssanar", emailRadicacion: "radicacion@emssanar.org.co" },
  { codigo: "EPS045", nombre: "Asmet Salud", emailRadicacion: "radicacion@asmetsalud.com" },
  { codigo: "EPS046", nombre: "Pijaos Salud", emailRadicacion: "radicacion@pijaossalud.com" },
  { codigo: "EPSS01", nombre: "Savia Salud", emailRadicacion: "radicacion@saviasalud.com" },
  { codigo: "EPSS34", nombre: "Mallamas", emailRadicacion: "radicacion@mallamas.com.co" },
  { codigo: "EPSS40", nombre: "Dusakawi", emailRadicacion: "radicacion@dusakawi.com" },
];

const TARIFARIOS = [
  { value: "ISS_2001", label: "ISS 2001 (Manual Tarifario)" },
  { value: "SOAT_UVB", label: "SOAT UVB (Unidad de Valor Base)" },
  { value: "SOAT_UVT", label: "SOAT UVT (Unidad de Valor Tributaria)" },
  { value: "PROPIO", label: "Tarifa propia / Libre negociación" },
];

const TARIFA_VACIA: Tarifa = {
  cups_codigo: "",
  cups_descripcion: "",
  valor_pactado: 0,
  incluye_honorarios: true,
  incluye_materiales: true,
  es_paquete: false,
  servicios_incluidos_paquete: [],
  observaciones: "",
};

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

// =====================================================================
// Sub-componentes
// =====================================================================

/** Buscador de CUPS con autocompletado */
function CupsBuscador({
  value,
  descripcion,
  onChange,
}: {
  value: string;
  descripcion?: string;
  onChange: (codigo: string, desc: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [resultados, setResultados] = useState<CupsItem[]>([]);
  const [abierto, setAbierto] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buscar = useCallback(async (termino: string) => {
    if (termino.length < 2) {
      setResultados([]);
      return;
    }
    const res = await buscarCupsParaTarifa(termino);
    setResultados(res as CupsItem[]);
    setAbierto(true);
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => buscar(text), 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.length >= 2 && setAbierto(true)}
        placeholder="Buscar CUPS…"
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
      />
      {descripcion && query === value && (
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{descripcion}</p>
      )}
      {abierto && resultados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {resultados.map((r) => (
            <button
              key={r.codigo}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-medi-primary/5 text-sm border-b border-slate-50 last:border-0"
              onClick={() => {
                onChange(r.codigo, r.descripcion);
                setQuery(r.codigo);
                setAbierto(false);
              }}
            >
              <span className="font-mono font-bold text-medi-deep text-xs">{r.codigo}</span>
              <span className="text-slate-500 ml-2 text-xs">{r.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Componente principal
// =====================================================================

export default function ConfiguracionAcuerdo() {
  // Estado principal
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Formulario de acuerdo
  const [modo, setModo] = useState<"lista" | "formulario">("lista");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    eps_codigo: "",
    nombre_eps: "",
    email_radicacion: "",
    fecha_inicio: "",
    fecha_fin: "",
    tarifario_base: "ISS_2001",
    porcentaje_sobre_base: 100,
    requiere_autorizacion: true,
    observaciones: "",
  });

  // Tarifas del acuerdo en edición
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [mostrarTarifas, setMostrarTarifas] = useState(false);
  const [tarifaRefs, setTarifaRefs] = useState<Record<string, TarifaReferencia | null>>({});

  // ---- Cargar datos
  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await obtenerAcuerdos();
    setAcuerdos(data as Acuerdo[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ---- Acciones
  const limpiarForm = () => {
    setForm({
      eps_codigo: "",
      nombre_eps: "",
      email_radicacion: "",
      fecha_inicio: "",
      fecha_fin: "",
      tarifario_base: "ISS_2001",
      porcentaje_sobre_base: 100,
      requiere_autorizacion: true,
      observaciones: "",
    });
    setTarifas([]);
    setEditandoId(null);
    setMostrarTarifas(false);
  };

  const nuevoAcuerdo = () => {
    limpiarForm();
    setModo("formulario");
  };

  const editarAcuerdo = async (id: string) => {
    setLoading(true);
    const data = await obtenerAcuerdoConTarifas(id);
    if (data) {
      const a = data.acuerdo as Acuerdo;
      setForm({
        eps_codigo: a.eps_codigo,
        nombre_eps: a.nombre_eps || "",
        email_radicacion: a.email_radicacion || "",
        fecha_inicio: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        tarifario_base: a.tarifario_base,
        porcentaje_sobre_base: a.porcentaje_sobre_base,
        requiere_autorizacion: a.requiere_autorizacion,
        observaciones: a.observaciones || "",
      });
      setTarifas(
        (data.tarifas as Array<Record<string, unknown>>).map((t) => ({
          id: t.id as string,
          cups_codigo: t.cups_codigo as string,
          valor_pactado: Number(t.valor_pactado),
          incluye_honorarios: t.incluye_honorarios as boolean,
          incluye_materiales: t.incluye_materiales as boolean,
          es_paquete: t.es_paquete as boolean,
          servicios_incluidos_paquete: (t.servicios_incluidos_paquete as string[]) || [],
          observaciones: (t.observaciones as string) || "",
        }))
      );
      setEditandoId(id);
      setMostrarTarifas((data.tarifas as unknown[]).length > 0);
      setModo("formulario");
    }
    setLoading(false);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar este acuerdo y todas sus tarifas?")) return;
    const res = await eliminarAcuerdo(id);
    if (res.success) {
      setMensaje({ tipo: "ok", texto: "Acuerdo eliminado" });
      cargar();
    } else {
      setMensaje({ tipo: "error", texto: res.error || "Error al eliminar" });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const handleGuardar = async () => {
    // Validaciones básicas
    if (!form.eps_codigo) return setMensaje({ tipo: "error", texto: "Seleccione una EPS" });
    if (!form.fecha_inicio || !form.fecha_fin) return setMensaje({ tipo: "error", texto: "Complete las fechas de vigencia" });
    if (form.fecha_fin < form.fecha_inicio) return setMensaje({ tipo: "error", texto: "La fecha fin debe ser posterior a la inicio" });

    setSaving(true);
    try {
      // 1. Guardar acuerdo
      const resAcuerdo = await guardarAcuerdo({
        id: editandoId || undefined,
        ...form,
      });

      if (!resAcuerdo.success || !resAcuerdo.id) {
        setMensaje({ tipo: "error", texto: resAcuerdo.error || "Error guardando acuerdo" });
        setSaving(false);
        return;
      }

      // 2. Guardar tarifas si hay
      if (tarifas.length > 0) {
        const tarifasLimpias = tarifas.filter((t) => t.cups_codigo.trim() !== "");
        if (tarifasLimpias.length > 0) {
          const resTarifas = await guardarTarifasAcuerdo(resAcuerdo.id, tarifasLimpias);
          if (!resTarifas.success) {
            setMensaje({ tipo: "error", texto: `Acuerdo guardado, pero error en tarifas: ${resTarifas.error}` });
            setSaving(false);
            return;
          }
        }
      }

      setMensaje({ tipo: "ok", texto: editandoId ? "Acuerdo actualizado" : "Acuerdo creado" });
      limpiarForm();
      setModo("lista");
      cargar();
    } catch (e) {
      console.error("Error guardando acuerdo:", e);
      setMensaje({ tipo: "error", texto: "Error inesperado" });
    } finally {
      setSaving(false);
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  const handleEpsChange = (codigo: string) => {
    const eps = EPS_LISTA.find((e) => e.codigo === codigo);
    setForm((f) => ({
      ...f,
      eps_codigo: codigo,
      nombre_eps: eps?.nombre || codigo,
      email_radicacion: eps?.emailRadicacion || f.email_radicacion,
    }));
  };

  // ---- Tarifas CRUD
  const agregarTarifa = () => {
    setTarifas((prev) => [...prev, { ...TARIFA_VACIA }]);
    setMostrarTarifas(true);
  };

  const actualizarTarifa = (idx: number, campo: string, valor: unknown) => {
    setTarifas((prev) => prev.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t)));
  };

  const eliminarTarifa = (idx: number) => {
    setTarifas((prev) => prev.filter((_, i) => i !== idx));
  };

  const agregarServicioPaquete = (idx: number, cups: string) => {
    setTarifas((prev) =>
      prev.map((t, i) =>
        i === idx && cups && !t.servicios_incluidos_paquete.includes(cups)
          ? { ...t, servicios_incluidos_paquete: [...t.servicios_incluidos_paquete, cups] }
          : t
      )
    );
  };

  const quitarServicioPaquete = (idx: number, cups: string) => {
    setTarifas((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, servicios_incluidos_paquete: t.servicios_incluidos_paquete.filter((c) => c !== cups) }
          : t
      )
    );
  };

  // =====================================================================
  // RENDER
  // =====================================================================

  if (loading && acuerdos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-medi-primary/30 border-t-medi-primary rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando acuerdos…</p>
        </div>
      </div>
    );
  }

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
              Acuerdos de Voluntades
            </h2>
            <p className="text-white/70 text-sm mt-1">
              Configure los contratos IPS ↔ EPS con tarifas pactadas para el validador anti-glosas
            </p>
            </div>
          </div>
          {modo === "lista" ? (
            <button
              onClick={nuevoAcuerdo}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo acuerdo
            </button>
          ) : (
            <button
              onClick={() => { limpiarForm(); setModo("lista"); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver
            </button>
          )}
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
            mensaje.tipo === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {mensaje.tipo === "ok" ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {mensaje.texto}
        </div>
      )}

      {/* ============ LISTA DE ACUERDOS ============ */}
      {modo === "lista" && (
        <div className="space-y-4">
          {acuerdos.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 p-12 text-center">
              <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-400 text-sm">No tiene acuerdos de voluntades configurados</p>
              <p className="text-slate-300 text-xs mt-1">
                Los acuerdos alimentan las validaciones anti-glosas de tarifas (TA) y facturación (FA)
              </p>
              <button
                onClick={nuevoAcuerdo}
                className="mt-4 px-6 py-2.5 bg-medi-primary text-white rounded-xl font-semibold text-sm hover:bg-medi-accent transition"
              >
                Crear primer acuerdo
              </button>
            </div>
          ) : (
            acuerdos.map((a) => {
              const vigente =
                a.activo &&
                new Date(a.fecha_inicio) <= new Date() &&
                new Date(a.fecha_fin) >= new Date();
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-2xl shadow-md border border-medi-light/50 p-5 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-medi-deep text-lg">
                          {a.nombre_eps || a.eps_codigo}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            vigente
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {vigente ? "Vigente" : "Inactivo"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {a.fecha_inicio} → {a.fecha_fin}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {TARIFARIOS.find((t) => t.value === a.tarifario_base)?.label || a.tarifario_base}
                          {a.porcentaje_sobre_base !== 100 && ` + ${a.porcentaje_sobre_base - 100}%`}
                        </span>
                        <span className="flex items-center gap-1">
                          {a.requiere_autorizacion ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              Requiere autorización
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                              </svg>
                              Sin autorización
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => editarAcuerdo(a.id)}
                        className="p-2 rounded-lg hover:bg-medi-primary/10 text-medi-primary transition"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEliminar(a.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============ FORMULARIO ============ */}
      {modo === "formulario" && (
        <div className="space-y-6">
          {/* Datos generales del acuerdo */}
          <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-medi-light/30">
              <h3 className="font-bold text-sm text-medi-deep uppercase tracking-wider">
                {editandoId ? "Editar acuerdo" : "Nuevo acuerdo de voluntades"}
              </h3>
            </div>
            <div className="p-6 space-y-5">
              {/* EPS */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  EPS / Entidad responsable de pago
                </label>
                <select
                  value={form.eps_codigo}
                  onChange={(e) => handleEpsChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary bg-white"
                >
                  <option value="">— Seleccionar EPS —</option>
                  {EPS_LISTA.map((eps) => (
                    <option key={eps.codigo} value={eps.codigo}>
                      {eps.nombre} ({eps.codigo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Email de radicación */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Email de radicación EPS
                </label>
                <input
                  type="email"
                  value={form.email_radicacion}
                  onChange={(e) => setForm((f) => ({ ...f, email_radicacion: e.target.value }))}
                  placeholder="radicacion@eps.com.co"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Email para enviar automáticamente los paquetes de radicación FEV-RIPS. Se pre-llena al seleccionar la EPS.
                </p>
              </div>

              {/* Fechas de vigencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={form.fecha_fin}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
                  />
                </div>
              </div>

              {/* Tarifario base + porcentaje */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Tarifario base
                  </label>
                  <select
                    value={form.tarifario_base}
                    onChange={(e) => setForm((f) => ({ ...f, tarifario_base: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary bg-white"
                  >
                    {TARIFARIOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    % sobre base
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      value={form.porcentaje_sobre_base}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, porcentaje_sobre_base: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                  </div>
                  {form.porcentaje_sobre_base !== 100 && (
                    <p className="text-[10px] text-medi-primary mt-0.5">
                      {form.tarifario_base !== "PROPIO"
                        ? `${TARIFARIOS.find((t) => t.value === form.tarifario_base)?.label?.split(" ")[0]} + ${form.porcentaje_sobre_base - 100}%`
                        : `${form.porcentaje_sobre_base}% del valor propio`}
                    </p>
                  )}
                </div>
              </div>

              {/* Autorización */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiere_autorizacion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, requiere_autorizacion: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:ring-2 peer-focus:ring-medi-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-medi-primary"></div>
                </label>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Requiere autorización previa</p>
                  <p className="text-[10px] text-slate-400">
                    Si está activo, los servicios requieren número de autorización para evitar glosas AU
                  </p>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  placeholder="Condiciones especiales, exclusiones…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* ============ TARIFAS ESPECÍFICAS ============ */}
          <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-medi-light/30 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-medi-deep uppercase tracking-wider">
                  Tarifas específicas por servicio
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Override del tarifario base para servicios puntuales o paquetes
                </p>
              </div>
              <button
                type="button"
                onClick={agregarTarifa}
                className="px-3 py-1.5 bg-medi-primary/10 text-medi-primary rounded-lg text-xs font-bold hover:bg-medi-primary/20 transition flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar tarifa
              </button>
            </div>

            <div className="p-6">
              {tarifas.length === 0 && !mostrarTarifas ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">
                    No hay tarifas específicas. Se usará el tarifario base.
                  </p>
                  <button
                    type="button"
                    onClick={agregarTarifa}
                    className="mt-3 text-xs text-medi-primary font-semibold hover:underline"
                  >
                    + Agregar tarifa específica o paquete
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tarifas.map((tarifa, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        tarifa.es_paquete
                          ? "border-purple-200 bg-purple-50/30"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      {/* Encabezado */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                          {tarifa.es_paquete && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                              PAQUETE
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarTarifa(idx)}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* CUPS */}
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                            Código CUPS
                          </label>
                          <CupsBuscador
                            value={tarifa.cups_codigo}
                            descripcion={tarifa.cups_descripcion}
                            onChange={(codigo, desc) => {
                              actualizarTarifa(idx, "cups_codigo", codigo);
                              actualizarTarifa(idx, "cups_descripcion", desc);
                            }}
                          />
                        </div>

                        {/* Valor */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                            Valor pactado
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                            <input
                              type="number"
                              min={0}
                              value={tarifa.valor_pactado || ""}
                              onChange={(e) =>
                                actualizarTarifa(idx, "valor_pactado", Number(e.target.value))
                              }
                              onFocus={async () => {
                                if (tarifa.cups_codigo && form.eps_codigo) {
                                  const key = `${form.eps_codigo}:${tarifa.cups_codigo}`;
                                  if (!(key in tarifaRefs)) {
                                    const ref = await obtenerTarifaReferencia(tarifa.cups_codigo, form.eps_codigo);
                                    setTarifaRefs((prev) => ({ ...prev, [key]: ref }));
                                  }
                                }
                              }}
                              placeholder="0"
                              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
                            />
                          </div>
                          {tarifa.valor_pactado > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {formatCOP(tarifa.valor_pactado)}
                            </p>
                          )}
                          {(() => {
                            const key = `${form.eps_codigo}:${tarifa.cups_codigo}`;
                            const ref = tarifaRefs[key];
                            if (!ref) return null;
                            return (
                              <p className="text-[10px] text-medi-primary mt-0.5">
                                📊 Referencia: {form.nombre_eps || form.eps_codigo} paga ~{formatCOP(ref.valor_promedio)} ({formatCOP(ref.valor_min)}–{formatCOP(ref.valor_max)})
                              </p>
                            );
                          })()}
                        </div>

                        {/* Toggles */}
                        <div className="sm:col-span-4 flex flex-col gap-2 justify-center">
                          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tarifa.incluye_honorarios}
                              onChange={(e) =>
                                actualizarTarifa(idx, "incluye_honorarios", e.target.checked)
                              }
                              className="rounded border-slate-300 text-medi-primary focus:ring-medi-primary/30"
                            />
                            Incluye honorarios
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tarifa.incluye_materiales}
                              onChange={(e) =>
                                actualizarTarifa(idx, "incluye_materiales", e.target.checked)
                              }
                              className="rounded border-slate-300 text-medi-primary focus:ring-medi-primary/30"
                            />
                            Incluye materiales
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tarifa.es_paquete}
                              onChange={(e) =>
                                actualizarTarifa(idx, "es_paquete", e.target.checked)
                              }
                              className="rounded border-slate-300 text-medi-primary focus:ring-medi-primary/30"
                            />
                            Es paquete / agrupación
                          </label>
                        </div>
                      </div>

                      {/* Servicios del paquete */}
                      {tarifa.es_paquete && (
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <label className="block text-[10px] font-semibold text-purple-600 uppercase mb-1.5">
                            Servicios incluidos en el paquete
                          </label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {tarifa.servicios_incluidos_paquete.map((cups) => (
                              <span
                                key={cups}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-mono font-bold"
                              >
                                {cups}
                                <button
                                  type="button"
                                  onClick={() => quitarServicioPaquete(idx, cups)}
                                  className="hover:text-red-600"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="max-w-xs">
                            <CupsBuscador
                              value=""
                              onChange={(codigo) => {
                                agregarServicioPaquete(idx, codigo);
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Observaciones de la tarifa */}
                      <div className="mt-3">
                        <input
                          type="text"
                          value={tarifa.observaciones}
                          onChange={(e) => actualizarTarifa(idx, "observaciones", e.target.value)}
                          placeholder="Observaciones de esta tarifa (opcional)"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumen y guardar */}
          <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  <span className="font-semibold">EPS:</span>{" "}
                  {form.nombre_eps || "Sin seleccionar"}
                </p>
                <p>
                  <span className="font-semibold">Vigencia:</span>{" "}
                  {form.fecha_inicio && form.fecha_fin
                    ? `${form.fecha_inicio} → ${form.fecha_fin}`
                    : "Sin definir"}
                </p>
                <p>
                  <span className="font-semibold">Tarifas específicas:</span>{" "}
                  {tarifas.filter((t) => t.cups_codigo).length} servicio(s)
                  {tarifas.filter((t) => t.es_paquete).length > 0 &&
                    ` — ${tarifas.filter((t) => t.es_paquete).length} paquete(s)`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    limpiarForm();
                    setModo("lista");
                  }}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving}
                  className="px-6 py-2.5 bg-medi-primary text-white rounded-xl font-bold text-sm hover:bg-medi-accent transition disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editandoId ? "Actualizar acuerdo" : "Guardar acuerdo"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
