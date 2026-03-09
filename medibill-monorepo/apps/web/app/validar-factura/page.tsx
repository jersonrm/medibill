"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  validarFacturaPorId,
  obtenerFacturasPendientesValidacion,
} from "@/app/actions/glosas";
import PanelResultados from "@/components/validacion/PanelResultados";
import ModalRegistrarGlosa from "@/components/glosas/ModalRegistrarGlosa";
import type {
  ResultadoValidacion,
  FacturaDB,
  FacturaResumen,
  EstadoFactura,
} from "@/lib/types/glosas";

const COLORES_ESTADO: Record<string, string> = {
  borrador: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  radicada: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  devuelta: "bg-red-500/20 text-red-400 border-red-500/30",
  glosada: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  respondida: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  conciliada: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pagada: "bg-green-500/20 text-green-400 border-green-500/30",
};

const LABELS_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  radicada: "Radicada",
  devuelta: "Devuelta",
  glosada: "Glosada",
  respondida: "Respondida",
  conciliada: "Conciliada",
  pagada: "Pagada",
};

export default function ValidarFacturaPage() {
  const [facturas, setFacturas] = useState<FacturaResumen[]>([]);
  const [facturaSeleccionadaId, setFacturaSeleccionadaId] = useState<string | null>(null);
  const [facturaCompleta, setFacturaCompleta] = useState<FacturaDB | null>(null);
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFacturas, setLoadingFacturas] = useState(true);
  const [modalGlosaAbierto, setModalGlosaAbierto] = useState(false);
  const [facturaParaGlosa, setFacturaParaGlosa] = useState<string | undefined>(undefined);

  // Cargar facturas pendientes al montar
  const cargarFacturas = useCallback(async () => {
    setLoadingFacturas(true);
    try {
      const data = await obtenerFacturasPendientesValidacion();
      setFacturas(data);
    } catch (e) {
      console.error("Error cargando facturas pendientes:", e);
      setFacturas([]);
    } finally {
      setLoadingFacturas(false);
    }
  }, []);

  useEffect(() => {
    cargarFacturas();
  }, [cargarFacturas]);

  // Seleccionar y validar una factura
  const seleccionarFactura = useCallback(async (facturaId: string) => {
    setFacturaSeleccionadaId(facturaId);
    setLoading(true);
    setResultado(null);

    try {
      const res = await validarFacturaPorId(facturaId);
      if (res) {
        setResultado(res);
        // Construir FacturaDB parcial desde el resumen + resultado
        const resumen = facturas.find((f) => f.id === facturaId);
        if (resumen) {
          setFacturaCompleta({
            id: resumen.id,
            user_id: "",
            num_factura: res.num_factura || resumen.num_factura,
            num_fev: null,
            nit_prestador: "",
            nit_erp: resumen.nit_erp,
            fecha_expedicion: resumen.fecha_expedicion,
            fecha_radicacion: null,
            fecha_limite_rad: null,
            valor_total: resumen.valor_total,
            valor_glosado: 0,
            valor_aceptado: 0,
            estado: resumen.estado as EstadoFactura,
            fev_rips_json: null,
            metadata: {},
            created_at: "",
            updated_at: "",
          });
        }
      }
    } catch (e) {
      console.error("Error validando factura:", e);
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [facturas]);

  return (
    <div className="min-h-screen bg-medi-deep">
      {/* Header */}
      <div className="border-b border-medi-dark/50 bg-medi-deep/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-medi-light hover:text-white transition-colors"
              title="Volver al inicio"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Validación Pre-radicación</h1>
              <p className="text-[10px] text-medi-light uppercase tracking-widest font-bold">
                Prevención de Glosas — Medibill
              </p>
            </div>
          </div>
          <Link
            href="/glosas"
            className="px-3 py-1.5 text-xs font-bold text-medi-light border border-medi-dark rounded-lg hover:bg-medi-dark/50 transition-all"
          >
            Gestión Glosas
          </Link>
          <button
            onClick={() => {
              setFacturaParaGlosa(undefined);
              setModalGlosaAbierto(true);
            }}
            className="px-3 py-1.5 text-xs font-bold text-orange-300 border border-orange-600 rounded-lg hover:bg-orange-600/20 transition-all"
          >
            + Registrar Glosa
          </button>
        </div>
      </div>

      {/* Layout principal */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Lista de facturas */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">
                Facturas ({facturas.length})
              </h2>
              {loadingFacturas && (
                <div className="w-4 h-4 border-2 border-medi-accent/40 border-t-medi-accent rounded-full animate-spin" />
              )}
            </div>

            {loadingFacturas ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-medi-dark/30 rounded-xl h-24 animate-pulse" />
                ))}
              </div>
            ) : facturas.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm font-medium">Sin facturas pendientes</p>
                <p className="text-xs mt-1">Cree una factura desde el módulo principal</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                {facturas.map((f) => {
                  const isSelected = facturaSeleccionadaId === f.id;
                  const estadoColor = COLORES_ESTADO[f.estado] ?? COLORES_ESTADO.borrador;
                  return (
                    <button
                      key={f.id}
                      onClick={() => seleccionarFactura(f.id)}
                      disabled={loading && isSelected}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-medi-primary/20 border-medi-accent ring-2 ring-medi-accent/50"
                          : "bg-medi-dark/20 border-medi-dark/30 hover:bg-medi-dark/40 hover:border-medi-dark/60"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-bold text-gray-200">
                          {f.num_factura || "Sin número"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${estadoColor}`}>
                          {LABELS_ESTADO[f.estado] ?? f.estado}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                        <div>
                          <span className="text-gray-600">EPS: </span>
                          <span className="text-gray-400">{f.nit_erp}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 font-mono">
                            ${Number(f.valor_total).toLocaleString("es-CO")}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fecha: </span>
                          <span className="text-gray-400">
                            {f.fecha_expedicion?.slice(0, 10) ?? "—"}
                          </span>
                        </div>
                        {f.ultima_validacion && (
                          <div className="text-right">
                            <span className="text-emerald-600 text-[10px]">
                              ✓ Validada
                            </span>
                          </div>
                        )}
                      </div>
                      {loading && isSelected && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-medi-accent">
                          <div className="w-3 h-3 border-2 border-medi-accent/40 border-t-medi-accent rounded-full animate-spin" />
                          Validando...
                        </div>
                      )}
                      {/* Botón registrar glosa para facturas radicadas+ */}
                      {["radicada", "glosada", "respondida"].includes(f.estado) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFacturaParaGlosa(f.id);
                            setModalGlosaAbierto(true);
                          }}
                          className="mt-2 w-full text-[10px] font-bold text-orange-400 border border-orange-600/40 rounded-lg py-1 px-2 hover:bg-orange-600/10 transition-all"
                        >
                          + Registrar glosa recibida
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columna derecha: Panel de resultados */}
          <div className="lg:col-span-2">
            <PanelResultados
              resultado={resultado}
              factura={facturaCompleta}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Modal para registrar glosa recibida */}
      <ModalRegistrarGlosa
        abierto={modalGlosaAbierto}
        onCerrar={() => {
          setModalGlosaAbierto(false);
          setFacturaParaGlosa(undefined);
        }}
        onGlosaRegistrada={() => {
          cargarFacturas();
        }}
        facturaIdPreseleccionada={facturaParaGlosa}
      />
    </div>
  );
}
