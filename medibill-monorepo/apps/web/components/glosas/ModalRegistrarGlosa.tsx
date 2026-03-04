"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LABELS_CONCEPTO } from "@/lib/types/glosas";
import {
  registrarGlosaRecibida,
  obtenerFacturasParaGlosas,
} from "@/app/actions/respuesta-glosas";

interface ModalRegistrarGlosaProps {
  abierto: boolean;
  onCerrar: () => void;
  onGlosaRegistrada: () => void;
  /** Si se pasa, pre-selecciona la factura */
  facturaIdPreseleccionada?: string;
}

interface FacturaOpcion {
  id: string;
  num_factura: string;
  nit_erp: string;
  valor_total: number;
  estado: string;
  fecha_radicacion: string | null;
}

const CONCEPTOS = [
  { codigo: "FA", label: "Facturación" },
  { codigo: "TA", label: "Tarifas" },
  { codigo: "SO", label: "Soportes" },
  { codigo: "AU", label: "Autorización" },
  { codigo: "PE", label: "Pertinencia" },
  { codigo: "SC", label: "Seguimiento" },
  { codigo: "DE", label: "Devolución" },
];

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function ModalRegistrarGlosa({
  abierto,
  onCerrar,
  onGlosaRegistrada,
  facturaIdPreseleccionada,
}: ModalRegistrarGlosaProps) {
  const [facturas, setFacturas] = useState<FacturaOpcion[]>([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(true);

  // Form state
  const [facturaId, setFacturaId] = useState(facturaIdPreseleccionada || "");
  const [codigoGlosa, setCodigoGlosa] = useState("");
  const [conceptoGeneral, setConceptoGeneral] = useState("FA");
  const [descripcionGlosa, setDescripcionGlosa] = useState("");
  const [valorGlosado, setValorGlosado] = useState<number>(0);
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [pacienteDocumento, setPacienteDocumento] = useState("");
  const [servicioDescripcion, setServicioDescripcion] = useState("");
  const [fechaGlosa, setFechaGlosa] = useState(
    new Date().toISOString().split("T")[0]!
  );
  const [numeroRegistro, setNumeroRegistro] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // Cargar facturas disponibles
  useEffect(() => {
    if (abierto) {
      setCargandoFacturas(true);
      obtenerFacturasParaGlosas()
        .then((f) => {
          setFacturas(f);
          if (facturaIdPreseleccionada) {
            setFacturaId(facturaIdPreseleccionada);
          }
        })
        .finally(() => setCargandoFacturas(false));
    }
  }, [abierto, facturaIdPreseleccionada]);

  // Reset form when modal opens
  useEffect(() => {
    if (abierto) {
      setCodigoGlosa("");
      setConceptoGeneral("FA");
      setDescripcionGlosa("");
      setValorGlosado(0);
      setPacienteNombre("");
      setPacienteDocumento("");
      setServicioDescripcion("");
      setFechaGlosa(new Date().toISOString().split("T")[0]!);
      setNumeroRegistro("");
      setError(null);
      setExito(false);
      if (facturaIdPreseleccionada) {
        setFacturaId(facturaIdPreseleccionada);
      } else {
        setFacturaId("");
      }
    }
  }, [abierto, facturaIdPreseleccionada]);

  const facturaSeleccionada = facturas.find((f) => f.id === facturaId);

  const puedeEnviar =
    facturaId &&
    codigoGlosa.trim().length >= 2 &&
    descripcionGlosa.trim().length >= 10 &&
    valorGlosado > 0 &&
    pacienteNombre.trim().length >= 3 &&
    fechaGlosa;

  const handleEnviar = useCallback(async () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);

    const resultado = await registrarGlosaRecibida({
      factura_id: facturaId,
      codigo_glosa: codigoGlosa.trim().toUpperCase(),
      concepto_general: conceptoGeneral,
      descripcion_glosa: descripcionGlosa.trim(),
      valor_glosado: valorGlosado,
      paciente_nombre: pacienteNombre.trim(),
      paciente_documento: pacienteDocumento.trim() || undefined,
      servicio_descripcion: servicioDescripcion.trim() || undefined,
      fecha_glosa: fechaGlosa,
      numero_registro_glosa: numeroRegistro.trim() || undefined,
    });

    setEnviando(false);

    if (resultado.success) {
      setExito(true);
      setTimeout(() => {
        onGlosaRegistrada();
        onCerrar();
      }, 1500);
    } else {
      setError(resultado.error || "Error registrando glosa");
    }
  }, [
    puedeEnviar,
    facturaId,
    codigoGlosa,
    conceptoGeneral,
    descripcionGlosa,
    valorGlosado,
    pacienteNombre,
    pacienteDocumento,
    servicioDescripcion,
    fechaGlosa,
    numeroRegistro,
    onGlosaRegistrada,
    onCerrar,
  ]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCerrar}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Registrar Glosa Recibida</h2>
              <p className="text-sm text-orange-100 mt-0.5">
                Ingrese los datos de la glosa enviada por la EPS
              </p>
            </div>
            <button
              onClick={onCerrar}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </div>
        </div>

        {/* Éxito */}
        {exito && (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-green-800 mb-1">
              Glosa registrada exitosamente
            </h3>
            <p className="text-sm text-green-600">
              La factura ha sido actualizada a estado &quot;glosada&quot; y la
              glosa aparecerá en el módulo de Responder Glosas.
            </p>
          </div>
        )}

        {/* Formulario */}
        {!exito && (
          <div className="p-6 space-y-5">
            {/* Selector de factura */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Factura vinculada *
              </label>
              {cargandoFacturas ? (
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-400 animate-pulse">
                  Cargando facturas...
                </div>
              ) : facturas.length === 0 ? (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
                  No hay facturas radicadas disponibles. Primero debe radicar una factura.
                </div>
              ) : (
                <select
                  value={facturaId}
                  onChange={(e) => setFacturaId(e.target.value)}
                  disabled={!!facturaIdPreseleccionada}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 disabled:bg-gray-100"
                >
                  <option value="">Seleccione una factura...</option>
                  {facturas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.num_factura} — {formatCOP(f.valor_total)} — {f.estado}
                    </option>
                  ))}
                </select>
              )}
              {facturaSeleccionada && (
                <div className="mt-2 text-xs text-gray-500 flex gap-3">
                  <span>EPS: {facturaSeleccionada.nit_erp}</span>
                  <span>
                    Radicada:{" "}
                    {facturaSeleccionada.fecha_radicacion?.slice(0, 10) ||
                      "Sin fecha"}
                  </span>
                </div>
              )}
            </div>

            {/* Fila: Código glosa + Concepto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Código de glosa *
                </label>
                <input
                  type="text"
                  value={codigoGlosa}
                  onChange={(e) => setCodigoGlosa(e.target.value)}
                  placeholder="Ej: FA0201, TA0301..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Concepto general *
                </label>
                <select
                  value={conceptoGeneral}
                  onChange={(e) => setConceptoGeneral(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                >
                  {CONCEPTOS.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} — {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Descripción de la glosa *
              </label>
              <textarea
                value={descripcionGlosa}
                onChange={(e) => setDescripcionGlosa(e.target.value)}
                rows={3}
                placeholder="Ingrese la descripción exacta de la glosa como la formuló la EPS..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
              />
              <span className="text-xs text-gray-400 mt-0.5">
                Mínimo 10 caracteres ({descripcionGlosa.length}/10)
              </span>
            </div>

            {/* Fila: Valor glosado + Fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Valor glosado (COP) *
                </label>
                <input
                  type="number"
                  value={valorGlosado || ""}
                  onChange={(e) =>
                    setValorGlosado(Number(e.target.value) || 0)
                  }
                  min={0}
                  max={facturaSeleccionada?.valor_total || 999999999}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
                {facturaSeleccionada && valorGlosado > 0 && (
                  <span className="text-xs text-gray-400 mt-0.5 block">
                    {(
                      (valorGlosado / facturaSeleccionada.valor_total) *
                      100
                    ).toFixed(1)}
                    % de la factura
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Fecha de la glosa *
                </label>
                <input
                  type="date"
                  value={fechaGlosa}
                  onChange={(e) => setFechaGlosa(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
            </div>

            {/* Fila: Paciente nombre + documento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nombre del paciente *
                </label>
                <input
                  type="text"
                  value={pacienteNombre}
                  onChange={(e) => setPacienteNombre(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Documento paciente
                </label>
                <input
                  type="text"
                  value={pacienteDocumento}
                  onChange={(e) => setPacienteDocumento(e.target.value)}
                  placeholder="CC / TI / CE"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
            </div>

            {/* Servicio + Número de registro */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Servicio afectado
                </label>
                <input
                  type="text"
                  value={servicioDescripcion}
                  onChange={(e) => setServicioDescripcion(e.target.value)}
                  placeholder="Ej: Consulta medicina general"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  N° registro glosa (EPS)
                </label>
                <input
                  type="text"
                  value={numeroRegistro}
                  onChange={(e) => setNumeroRegistro(e.target.value)}
                  placeholder="Consecutivo EPS"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviar}
                disabled={!puedeEnviar || enviando}
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-2"
              >
                {enviando ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Registrando...
                  </>
                ) : (
                  <>Registrar Glosa</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
