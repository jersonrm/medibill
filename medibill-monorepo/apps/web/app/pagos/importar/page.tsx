"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  parsearSabana,
  mapearYConciliar,
  reconciliarConMapeoManual,
  confirmarConciliacion,
} from "@/app/actions/conciliacion";
import { listarEPSUsuario } from "@/app/actions/pagos";
import { obtenerFeaturesUsuario } from "@/app/actions/suscripcion";
import { formatCOP } from "@/lib/formato";
import type {
  ResultadoParseo,
  ResultadoMapeoIA,
  MapeoColumnas,
  FilaNormalizada,
  ResultadoConciliacion,
  FilaSabana,
  CampoEstandar,
  ItemConciliacion,
} from "@/lib/types/sabana";
import { CAMPOS_ESTANDAR_LABELS } from "@/lib/types/sabana";

// =====================================================================
// TIPOS INTERNOS
// =====================================================================
type Paso = 1 | 2 | 3 | 4;

const CAMPOS_DISPONIBLES: CampoEstandar[] = [
  "num_factura",
  "valor_facturado",
  "valor_pagado",
  "valor_glosado",
  "fecha_pago",
  "referencia_pago",
  "documento_paciente",
  "nombre_paciente",
  "observacion",
];

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================
export default function ImportarSabanaPage() {
  const [paso, setPaso] = useState<Paso>(1);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [featureBloqueada, setFeatureBloqueada] = useState(false);
  const [checkingFeature, setCheckingFeature] = useState(true);

  // Paso 1: Archivo + EPS
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [epsSeleccionada, setEpsSeleccionada] = useState("");
  const [epsNombre, setEpsNombre] = useState("");
  const [epsList, setEpsList] = useState<
    { nit_erp: string; eps_nombre: string }[]
  >([]);
  const [epsLoaded, setEpsLoaded] = useState(false);

  // Paso 2: Mapeo
  const [parseoData, setParseoData] = useState<ResultadoParseo | null>(null);
  const [filasOriginales, setFilasOriginales] = useState<FilaSabana[]>([]);
  const [mapeoIA, setMapeoIA] = useState<
    (ResultadoMapeoIA & { mapeo_id?: string; desde_cache: boolean }) | null
  >(null);
  const [mapeoEditado, setMapeoEditado] = useState<MapeoColumnas>({});

  // Paso 3: Conciliación
  const [filasNormalizadas, setFilasNormalizadas] = useState<
    FilaNormalizada[]
  >([]);
  const [conciliacion, setConciliacion] =
    useState<ResultadoConciliacion | null>(null);
  const [seleccion, setSeleccion] = useState<Record<number, boolean>>({});

  // Paso 4: Resultado
  const [resultado, setResultado] = useState<{
    pagos_registrados: number;
    errores: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar feature del plan
  useEffect(() => {
    obtenerFeaturesUsuario()
      .then((res) => {
        if (!res || !res.features.importacionSabana) setFeatureBloqueada(true);
      })
      .catch(() => setFeatureBloqueada(true))
      .finally(() => setCheckingFeature(false));
  }, []);

  // Cargar lista de EPS al montar
  const cargarEPS = useCallback(async () => {
    if (epsLoaded) return;
    const list = await listarEPSUsuario();
    setEpsList(list);
    setEpsLoaded(true);
  }, [epsLoaded]);

  React.useEffect(() => {
    cargarEPS();
  }, [cargarEPS]);

  // ==== PASO 1: Subir archivo ====
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setCargando(true);
    setNombreArchivo(file.name);

    const formData = new FormData();
    formData.set("archivo", file);

    const res = await parsearSabana(formData);

    if (!res.success || !res.data) {
      setError(res.error || "Error al leer el archivo");
      setCargando(false);
      return;
    }

    setParseoData(res.data);
    setFilasOriginales(res.data.filas);

    // Mapear con IA
    const mapResult = await mapearYConciliar(
      res.data.headers,
      res.data.filas,
      epsSeleccionada || undefined,
      epsNombre || undefined
    );

    setCargando(false);

    if (!mapResult.success) {
      setError(mapResult.error || "Error al mapear columnas");
      // Aún así mostrar el paso 2 para mapeo manual
      setMapeoEditado({});
      setPaso(2);
      return;
    }

    setMapeoIA(mapResult.mapeo!);
    setMapeoEditado({ ...mapResult.mapeo!.mapeo });
    setFilasNormalizadas(mapResult.filasNormalizadas!);
    setConciliacion(mapResult.conciliacion!);

    // Inicializar selección
    const sel: Record<number, boolean> = {};
    mapResult.conciliacion!.items.forEach((item, idx) => {
      sel[idx] = item.seleccionado;
    });
    setSeleccion(sel);

    setPaso(2);
  };

  // ==== PASO 2: Re-mapear manualmente ====
  const handleCambioMapeo = (campo: CampoEstandar, columna: string) => {
    setMapeoEditado((prev) => {
      const nuevo = { ...prev };
      if (columna === "") {
        delete nuevo[campo];
      } else {
        nuevo[campo] = columna;
      }
      return nuevo;
    });
  };

  const handleRemapear = async () => {
    if (!filasOriginales.length) return;
    setError(null);
    setCargando(true);

    const res = await reconciliarConMapeoManual(filasOriginales, mapeoEditado);
    setCargando(false);

    if (!res.success) {
      setError(res.error || "Error al reconciliar");
      return;
    }

    setFilasNormalizadas(res.filasNormalizadas!);
    setConciliacion(res.conciliacion!);

    const sel: Record<number, boolean> = {};
    res.conciliacion!.items.forEach((item, idx) => {
      sel[idx] = item.seleccionado;
    });
    setSeleccion(sel);

    setPaso(3);
  };

  const handleIrAConciliacion = () => {
    if (conciliacion) setPaso(3);
  };

  // ==== PASO 3: Confirmar ====
  const handleToggleSeleccion = (idx: number) => {
    setSeleccion((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSeleccionarTodos = (valor: boolean) => {
    if (!conciliacion) return;
    const sel: Record<number, boolean> = {};
    conciliacion.items.forEach((item, idx) => {
      sel[idx] =
        valor &&
        item.factura !== null &&
        item.tipo !== "ya_pagada" &&
        item.tipo !== "excede_saldo";
    });
    setSeleccion(sel);
  };

  const itemsSeleccionados = conciliacion
    ? conciliacion.items
        .filter((_, idx) => seleccion[idx])
        .filter((item) => item.factura !== null)
    : [];

  const montoTotal = itemsSeleccionados.reduce(
    (sum, item) => sum + item.fila.valor_pagado,
    0
  );

  const handleConfirmar = async () => {
    if (itemsSeleccionados.length === 0) return;

    setError(null);
    setCargando(true);

    const itemsConfirm = itemsSeleccionados.map((item) => ({
      factura_id: item.factura!.id,
      monto: item.fila.valor_pagado,
      fecha_pago: item.fila.fecha_pago || new Date().toISOString().split("T")[0]!,
      referencia: item.fila.referencia_pago || undefined,
      notas: item.fila.observacion || undefined,
    }));

    const res = await confirmarConciliacion(itemsConfirm, {
      nit_eps: epsSeleccionada || "desconocido",
      eps_nombre: epsNombre || "EPS no especificada",
      nombre_archivo: nombreArchivo,
      mapeo_usado_id: mapeoIA?.mapeo_id,
    });

    setCargando(false);

    setResultado({
      pagos_registrados: res.pagos_registrados,
      errores: res.errores,
    });

    setPaso(4);
  };

  // ==== RENDER ====
  if (checkingFeature) {
    return <div className="max-w-[1200px] mx-auto p-8 text-center text-medi-dark">Cargando...</div>;
  }

  if (featureBloqueada) {
    return (
      <div className="max-w-lg mx-auto p-8 mt-20 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <svg className="w-12 h-12 mx-auto text-amber-500 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h2 className="text-xl font-bold text-medi-deep mb-2">Funcionalidad no disponible</h2>
          <p className="text-medi-dark mb-6">La importación de sábana EPS no está incluida en tu plan actual. Actualiza al plan Profesional o superior para acceder.</p>
          <Link href="/configuracion/suscripcion" className="inline-block bg-medi-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-medi-primary/90 transition-colors">
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-medi-deep flex items-center gap-3">
            <div className="w-2 h-8 bg-indigo-500 rounded-full" />
            Importar Sábana EPS
          </h1>
          <p className="text-sm text-medi-dark/50 mt-1">
            Suba el archivo de pagos de la EPS para conciliar automáticamente
          </p>
        </div>
        <Link
          href="/pagos"
          className="text-sm font-bold text-medi-dark/50 hover:text-medi-primary transition-colors"
        >
          ← Volver a Cartera
        </Link>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((p) => (
          <React.Fragment key={p}>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                paso === p
                  ? "bg-indigo-500 text-white shadow-md"
                  : paso > p
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-medi-light/30 text-medi-dark/40"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {paso > p ? "✓" : p}
              </span>
              {p === 1 && "Subir archivo"}
              {p === 2 && "Revisar mapeo"}
              {p === 3 && "Conciliar"}
              {p === 4 && "Resultado"}
            </div>
            {p < 4 && (
              <div
                className={`h-0.5 flex-1 rounded ${paso > p ? "bg-indigo-300" : "bg-medi-light/50"}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div>
            <p className="text-sm font-bold text-red-700">Error</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 1: SUBIR ARCHIVO */}
      {/* ============================================================ */}
      {paso === 1 && (
        <div className="space-y-6">
          {/* Selector de EPS */}
          <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
            <h3 className="text-sm font-black text-medi-deep uppercase mb-4">
              EPS (Opcional)
            </h3>
            <p className="text-xs text-medi-dark/50 mb-3">
              Seleccionar la EPS permite reutilizar mapeos anteriores automáticamente.
            </p>
            <select
              value={epsSeleccionada}
              onChange={(e) => {
                setEpsSeleccionada(e.target.value);
                const found = epsList.find(
                  (ep) => ep.nit_erp === e.target.value
                );
                setEpsNombre(found?.eps_nombre || "");
              }}
              className="w-full max-w-md px-4 py-2.5 text-sm border border-medi-light rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— Sin especificar —</option>
              {epsList.map((eps) => (
                <option key={eps.nit_erp} value={eps.nit_erp}>
                  {eps.eps_nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all hover:border-indigo-400 hover:bg-indigo-50/30 ${
              cargando
                ? "border-indigo-400 bg-indigo-50/30"
                : "border-medi-light"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {cargando ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm font-bold text-indigo-700">
                    Procesando archivo...
                  </p>
                  <p className="text-xs text-medi-dark/50 mt-1">
                    Leyendo datos y mapeando columnas con IA
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-indigo-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-medi-deep">
                    Haga clic o arrastre un archivo
                  </p>
                  <p className="text-xs text-medi-dark/50 mt-1">
                    Excel (.xlsx, .xls) o CSV (.csv) — Máx. 5MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 2: REVISAR MAPEO */}
      {/* ============================================================ */}
      {paso === 2 && parseoData && (
        <div className="space-y-6">
          {/* Info del archivo */}
          <div className="bg-white rounded-2xl border border-medi-light/50 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-medi-deep">
                {nombreArchivo}
              </p>
              <p className="text-xs text-medi-dark/50">
                Hoja: {parseoData.hoja} • {parseoData.filas.length} filas •{" "}
                {parseoData.headers.length} columnas
              </p>
            </div>
            {mapeoIA && (
              <div className="flex items-center gap-2">
                {mapeoIA.desde_cache && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    Mapeo reutilizado
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    mapeoIA.confianza >= 0.9
                      ? "bg-green-100 text-green-700"
                      : mapeoIA.confianza >= 0.7
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  Confianza: {Math.round(mapeoIA.confianza * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Tabla de mapeo */}
          <div className="bg-white rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden">
            <div className="bg-medi-deep px-6 py-3">
              <h3 className="text-white font-bold text-sm">
                Mapeo de Columnas
              </h3>
              <p className="text-white/60 text-xs mt-0.5">
                Verifique que cada campo corresponda a la columna correcta del
                archivo
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMPOS_DISPONIBLES.map((campo) => (
                  <div key={campo} className="flex items-center gap-3">
                    <label className="text-xs font-bold text-medi-dark w-40 flex-shrink-0">
                      {CAMPOS_ESTANDAR_LABELS[campo]}
                      {(campo === "num_factura" ||
                        campo === "valor_pagado") && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </label>
                    <select
                      value={mapeoEditado[campo] || ""}
                      onChange={(e) =>
                        handleCambioMapeo(campo, e.target.value)
                      }
                      className={`flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                        mapeoEditado[campo]
                          ? "border-indigo-300 bg-indigo-50/50"
                          : "border-medi-light"
                      }`}
                    >
                      <option value="">— Sin mapear —</option>
                      {parseoData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview de datos mapeados */}
          {filasNormalizadas.length > 0 && (
            <div className="bg-white rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden">
              <div className="px-6 py-3 border-b border-medi-light/30">
                <h3 className="text-sm font-bold text-medi-deep">
                  Preview de datos (primeras 5 filas)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-medi-light/20 text-medi-dark/60 uppercase">
                      <th className="px-3 py-2 text-left"># Factura</th>
                      <th className="px-3 py-2 text-right">Facturado</th>
                      <th className="px-3 py-2 text-right">Pagado</th>
                      <th className="px-3 py-2 text-right">Glosado</th>
                      <th className="px-3 py-2 text-left">Fecha pago</th>
                      <th className="px-3 py-2 text-left">Paciente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasNormalizadas.slice(0, 5).map((f, i) => (
                      <tr
                        key={i}
                        className="border-t border-medi-light/20"
                      >
                        <td className="px-3 py-2 font-bold text-medi-deep">
                          {f.num_factura || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {f.valor_facturado != null
                            ? formatCOP(f.valor_facturado)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">
                          {formatCOP(f.valor_pagado)}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {f.valor_glosado
                            ? formatCOP(f.valor_glosado)
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {f.fecha_pago || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {f.nombre_paciente || f.documento_paciente || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setPaso(1);
                setNombreArchivo("");
                setParseoData(null);
                setMapeoIA(null);
                setError(null);
              }}
              className="px-4 py-2 text-sm font-bold text-medi-dark/50 hover:text-medi-primary transition-colors"
            >
              ← Subir otro archivo
            </button>
            <div className="flex gap-3">
              {!conciliacion && (
                <button
                  onClick={handleRemapear}
                  disabled={
                    cargando ||
                    !mapeoEditado.num_factura ||
                    !mapeoEditado.valor_pagado
                  }
                  className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargando ? "Procesando..." : "Aplicar mapeo y conciliar"}
                </button>
              )}
              {conciliacion && (
                <button
                  onClick={handleIrAConciliacion}
                  className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
                >
                  Continuar a conciliación →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 3: CONCILIACIÓN */}
      {/* ============================================================ */}
      {paso === 3 && conciliacion && (
        <div className="space-y-6">
          {/* KPI resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPICard
              color="bg-blue-500"
              label="Total filas"
              value={String(conciliacion.resumen.total_filas)}
            />
            <KPICard
              color="bg-green-500"
              label="Conciliadas"
              value={String(conciliacion.resumen.conciliadas)}
            />
            <KPICard
              color="bg-red-500"
              label="Sin match"
              value={String(conciliacion.resumen.sin_match)}
            />
            <KPICard
              color="bg-amber-500"
              label="Ya pagadas"
              value={String(conciliacion.resumen.ya_pagadas)}
            />
          </div>

          {/* Botones de selección masiva */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSeleccionarTodos(true)}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Seleccionar todos
            </button>
            <span className="text-medi-dark/30">|</span>
            <button
              onClick={() => handleSeleccionarTodos(false)}
              className="text-xs font-bold text-medi-dark/50 hover:underline"
            >
              Deseleccionar todos
            </button>
            <span className="flex-1" />
            <button
              onClick={() => setPaso(2)}
              className="text-xs font-bold text-medi-dark/50 hover:text-medi-primary"
            >
              ← Volver al mapeo
            </button>
          </div>

          {/* Tabla de conciliación */}
          <div className="bg-white rounded-2xl border border-medi-light/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-medi-deep text-white text-xs uppercase">
                    <th className="px-3 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={
                          itemsSeleccionados.length ===
                          conciliacion.items.filter(
                            (i) =>
                              i.factura &&
                              i.tipo !== "ya_pagada" &&
                              i.tipo !== "excede_saldo"
                          ).length
                        }
                        onChange={(e) =>
                          handleSeleccionarTodos(e.target.checked)
                        }
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-bold">
                      # Factura (sábana)
                    </th>
                    <th className="px-3 py-3 text-left font-bold">
                      Factura en Medibill
                    </th>
                    <th className="px-3 py-3 text-right font-bold">
                      Pagado
                    </th>
                    <th className="px-3 py-3 text-right font-bold">
                      Glosado
                    </th>
                    <th className="px-3 py-3 text-center font-bold">
                      Estado
                    </th>
                    <th className="px-3 py-3 text-left font-bold">
                      Nota
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conciliacion.items.map((item, idx) => (
                    <FilaConciliacion
                      key={idx}
                      item={item}
                      seleccionado={!!seleccion[idx]}
                      onToggle={() => handleToggleSeleccion(idx)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen sticky */}
          <div className="sticky bottom-4 bg-white rounded-2xl border border-indigo-200 shadow-lg p-5 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-medi-deep">
                {itemsSeleccionados.length} pagos seleccionados
              </span>
              <span className="text-2xl font-black text-indigo-600 ml-4">
                {formatCOP(montoTotal)}
              </span>
            </div>
            <button
              onClick={handleConfirmar}
              disabled={cargando || itemsSeleccionados.length === 0}
              className="px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  Confirmar y registrar pagos
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 4: RESULTADO */}
      {/* ============================================================ */}
      {paso === 4 && resultado && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl border border-medi-light/50 shadow-sm p-8 text-center">
            {resultado.pagos_registrados > 0 ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-medi-deep mb-2">
                  Importación exitosa
                </h2>
                <p className="text-sm text-medi-dark/60 mb-6">
                  Se registraron{" "}
                  <span className="font-bold text-green-600">
                    {resultado.pagos_registrados}
                  </span>{" "}
                  pagos por{" "}
                  <span className="font-bold text-green-600">
                    {formatCOP(montoTotal)}
                  </span>
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-red-700 mb-2">
                  No se registraron pagos
                </h2>
              </>
            )}

            {resultado.errores.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 text-left mb-6">
                <p className="text-xs font-bold text-red-700 mb-2">
                  Errores ({resultado.errores.length}):
                </p>
                {resultado.errores.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    • {err}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Link
                href="/pagos"
                className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
              >
                Ver cartera actualizada
              </Link>
              <button
                onClick={() => {
                  setPaso(1);
                  setNombreArchivo("");
                  setParseoData(null);
                  setMapeoIA(null);
                  setConciliacion(null);
                  setResultado(null);
                  setError(null);
                }}
                className="px-5 py-2.5 border border-medi-light text-medi-dark rounded-xl text-sm font-bold hover:bg-medi-light/30 transition-colors"
              >
                Importar otro archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SUB-COMPONENTES
// =====================================================================

function KPICard({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-medi-light/50 p-4 shadow-sm">
      <div className={`w-8 h-1.5 rounded-full ${color} mb-2`} />
      <div className="text-2xl font-black text-medi-deep">{value}</div>
      <div className="text-[10px] font-bold text-medi-dark/50 uppercase mt-0.5">
        {label}
      </div>
    </div>
  );
}

function FilaConciliacion({
  item,
  seleccionado,
  onToggle,
}: {
  item: ItemConciliacion;
  seleccionado: boolean;
  onToggle: () => void;
}) {
  const esSeleccionable =
    item.factura !== null &&
    item.tipo !== "ya_pagada" &&
    item.tipo !== "excede_saldo";

  const badgeConfig: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    pago_total: {
      label: "Pago total",
      bg: "bg-green-100",
      text: "text-green-700",
    },
    pago_parcial: {
      label: "Parcial",
      bg: "bg-cyan-100",
      text: "text-cyan-700",
    },
    con_glosa: {
      label: "Con glosa",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    sin_match_factura: {
      label: "Sin match",
      bg: "bg-red-100",
      text: "text-red-700",
    },
    ya_pagada: {
      label: "Ya pagada",
      bg: "bg-gray-100",
      text: "text-gray-500",
    },
    excede_saldo: {
      label: "Excede saldo",
      bg: "bg-orange-100",
      text: "text-orange-700",
    },
  };

  const badge = badgeConfig[item.tipo] || badgeConfig.sin_match_factura;

  return (
    <tr
      className={`border-t border-medi-light/20 transition-colors ${
        seleccionado ? "bg-indigo-50/50" : "hover:bg-medi-light/10"
      } ${!esSeleccionable ? "opacity-60" : ""}`}
    >
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={onToggle}
          disabled={!esSeleccionable}
          className="rounded disabled:opacity-30"
        />
      </td>
      <td className="px-3 py-3">
        <span className="font-bold text-medi-deep text-xs">
          {item.fila.num_factura || "—"}
        </span>
        {item.fila.nombre_paciente && (
          <span className="block text-[10px] text-medi-dark/40 mt-0.5">
            {item.fila.nombre_paciente}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        {item.factura ? (
          <Link
            href={`/facturas/${item.factura.id}`}
            className="font-bold text-indigo-600 hover:underline text-xs"
          >
            {item.factura.num_factura}
          </Link>
        ) : (
          <span className="text-xs text-medi-dark/40">No encontrada</span>
        )}
        {item.factura && (
          <span className="block text-[10px] text-medi-dark/40 mt-0.5">
            Saldo: {formatCOP(item.factura.saldo_pendiente)}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-bold text-green-600 text-xs">
        {formatCOP(item.fila.valor_pagado)}
      </td>
      <td className="px-3 py-3 text-right text-xs">
        {item.fila.valor_glosado ? (
          <span className="font-bold text-red-600">
            {formatCOP(item.fila.valor_glosado)}
          </span>
        ) : (
          <span className="text-medi-dark/30">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <span
          className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${badge!.bg} ${badge!.text}`}
        >
          {badge!.label}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-medi-dark/50 max-w-[200px] truncate">
        {item.advertencia || item.fila.observacion || "—"}
      </td>
    </tr>
  );
}
