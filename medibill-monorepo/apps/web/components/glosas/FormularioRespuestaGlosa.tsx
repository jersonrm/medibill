"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type {
  GlosaRecibidaEnriquecida,
  CodigoRespuesta,
  SoporteAdjunto,
  SugerenciaRespuestaIA,
  FacturaDB,
} from "@/lib/types/glosas";
import { LABELS_CONCEPTO, LABELS_ESTADO_FACTURA, COLORES_RESPUESTA } from "@/lib/types/glosas";
import { CODIGOS_RESPUESTA, PLANTILLAS_JUSTIFICACION } from "@/lib/catalogo-respuestas-glosa";
import SelectorRespuesta from "@/components/glosas/SelectorRespuesta";
import {
  registrarRespuestaGlosa,
  sugerirRespuestaParaGlosa,
  obtenerFacturaDeGlosa,
  subirSoporteGlosa,
} from "@/app/actions/respuesta-glosas";

interface FormularioRespuestaGlosaProps {
  glosa: GlosaRecibidaEnriquecida;
  onRespuestaRegistrada: () => void;
  onCancelar: () => void;
}

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function FormularioRespuestaGlosa({
  glosa,
  onRespuestaRegistrada,
  onCancelar,
}: FormularioRespuestaGlosaProps) {
  const [codigoRespuesta, setCodigoRespuesta] = useState<CodigoRespuesta | null>(null);
  const [justificacion, setJustificacion] = useState("");
  const [fundamentoLegal, setFundamentoLegal] = useState("");
  const [valorAceptado, setValorAceptado] = useState(0);
  const [soportes, setSoportes] = useState<SoporteAdjunto[]>([]);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [sugerenciaIA, setSugerenciaIA] = useState<SugerenciaRespuestaIA | null>(null);
  const [facturaContexto, setFacturaContexto] = useState<Pick<
    FacturaDB,
    "id" | "num_factura" | "nit_erp" | "valor_total" | "valor_glosado" | "estado" | "fecha_expedicion" | "fecha_radicacion"
  > | null>(null);

  const config = codigoRespuesta ? CODIGOS_RESPUESTA[codigoRespuesta] : null;
  const concepto = LABELS_CONCEPTO[glosa.concepto_general] || glosa.concepto_general;

  // Cargar datos de la factura vinculada
  useEffect(() => {
    if (glosa.factura_id) {
      obtenerFacturaDeGlosa(glosa.factura_id).then((f) => setFacturaContexto(f));
    }
  }, [glosa.factura_id]);

  // Auto-fill justificación al seleccionar código
  const handleSeleccionarCodigo = useCallback(
    (codigo: CodigoRespuesta) => {
      setCodigoRespuesta(codigo);
      setError(null);

      // Auto-fill justificación con plantilla si está vacía
      if (codigo === "RS01") {
        setJustificacion("");
        setFundamentoLegal("");
      } else if (codigo === "RS04" || codigo === "RS05") {
        // Si hay sugerencia IA, usar esa
        if (sugerenciaIA && sugerenciaIA.codigo_recomendado === codigo) {
          setJustificacion(sugerenciaIA.justificacion_sugerida);
          setFundamentoLegal(sugerenciaIA.fundamento_legal);
        }
      } else {
        // RS02/RS03: usar plantilla del concepto si está vacío
        const plantilla = PLANTILLAS_JUSTIFICACION[glosa.concepto_general] || "";
        if (!justificacion || justificacion.length < 5) {
          setJustificacion(plantilla);
        }
      }
    },
    [sugerenciaIA, glosa.concepto_general, justificacion]
  );

  // Sugerir con IA
  const handleSugerirIA = useCallback(async () => {
    setCargandoIA(true);
    setError(null);
    try {
      const result = await sugerirRespuestaParaGlosa(glosa.id);
      if (result.success && result.sugerencia) {
        setSugerenciaIA(result.sugerencia);
        // Pre-llenar el formulario
        setCodigoRespuesta(result.sugerencia.codigo_recomendado);
        setJustificacion(result.sugerencia.justificacion_sugerida);
        setFundamentoLegal(result.sugerencia.fundamento_legal);
      } else {
        setError(result.error || "Error generando sugerencia");
      }
    } catch (e) {
      console.error("Error AI sugerencia:", e);
      setError("Error de conexión con el asistente AI");
    } finally {
      setCargandoIA(false);
    }
  }, [glosa.id]);

  // Subir soporte (archivo real)
  const handleSubirSoporte = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar 10 MB");
      e.target.value = "";
      return;
    }
    setSubiendoArchivo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("glosa_id", glosa.id);
      const resultado = await subirSoporteGlosa(formData);
      if (!resultado.success) {
        setError(resultado.error || "Error al subir archivo");
        return;
      }
      setSoportes((prev) => [
        ...prev,
        { nombre: resultado.nombre!, tipo: "otro", url: resultado.url },
      ]);
    } catch (e) {
      console.error("Error subida archivo:", e);
      setError("Error de conexión al subir archivo");
    } finally {
      setSubiendoArchivo(false);
      e.target.value = "";
    }
  }, [glosa.id]);

  // Remover soporte
  const handleRemoverSoporte = useCallback((index: number) => {
    setSoportes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Validación del botón de envío
  const puedeEnviar = useMemo(() => {
    if (!codigoRespuesta) return false;
    const cfg = CODIGOS_RESPUESTA[codigoRespuesta];
    if (cfg.requiereJustificacion && justificacion.trim().length < 20) return false;
    if (codigoRespuesta === "RS02") {
      if (valorAceptado <= 0 || valorAceptado >= glosa.valor_glosado) return false;
    }
    if (codigoRespuesta === "RS04" && !glosa.es_extemporanea) return false;
    return true;
  }, [codigoRespuesta, justificacion, valorAceptado, glosa]);

  // Valores calculados para resumen
  const valoresResumen = useMemo(() => {
    if (!codigoRespuesta) return null;
    let aceptado = 0;
    let controvertido = glosa.valor_glosado;

    if (codigoRespuesta === "RS01") {
      aceptado = glosa.valor_glosado;
      controvertido = 0;
    } else if (codigoRespuesta === "RS02") {
      aceptado = valorAceptado;
      controvertido = glosa.valor_glosado - valorAceptado;
    }

    const cfg = CODIGOS_RESPUESTA[codigoRespuesta];
    return {
      aceptado,
      controvertido,
      notaCredito: cfg.generaNotaCredito ? aceptado : 0,
    };
  }, [codigoRespuesta, valorAceptado, glosa.valor_glosado]);

  // Enviar respuesta
  const handleEnviar = useCallback(async () => {
    if (!codigoRespuesta || !puedeEnviar) return;
    setEnviando(true);
    setError(null);

    const result = await registrarRespuestaGlosa({
      glosa_id: glosa.id,
      codigo_respuesta: codigoRespuesta,
      justificacion: justificacion || undefined,
      fundamento_legal: fundamentoLegal || undefined,
      valor_aceptado: codigoRespuesta === "RS02" ? valorAceptado : undefined,
      soportes: soportes.length > 0 ? soportes : undefined,
      origen_respuesta: sugerenciaIA ? "ia" : "manual",
    });

    setEnviando(false);

    if (result.success) {
      setExito(true);
      setTimeout(() => onRespuestaRegistrada(), 1500);
    } else {
      setError(result.error || "Error registrando respuesta");
    }
  }, [
    codigoRespuesta,
    puedeEnviar,
    glosa.id,
    justificacion,
    fundamentoLegal,
    valorAceptado,
    soportes,
    sugerenciaIA,
    onRespuestaRegistrada,
  ]);

  // Toast de éxito
  if (exito) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-green-800 mb-1">
          Respuesta registrada exitosamente
        </h3>
        <p className="text-sm text-green-600">
          Código {codigoRespuesta} aplicado a la glosa {glosa.codigo_glosa}
        </p>
      </div>
    );
  }

  const coloresRS = codigoRespuesta ? COLORES_RESPUESTA[codigoRespuesta] : null;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-medi-light/50 overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
        <h2 className="text-lg font-bold mb-1">
          Responder Glosa{" "}
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-sm">
            {glosa.codigo_glosa}
          </span>
        </h2>
        <div className="flex items-center gap-4 text-sm text-indigo-100">
          <span>📋 {glosa.num_factura}</span>
          <span>🏥 {glosa.eps_nombre}</span>
          <span>👤 {glosa.paciente_nombre}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-indigo-200 uppercase tracking-wider">
              Valor glosado
            </span>
            <p className="text-2xl font-bold">
              {formatCOP(glosa.valor_glosado)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-indigo-200">{concepto}</span>
            <p className="text-sm">
              {glosa.porcentaje_glosado}% de la factura
            </p>
          </div>
        </div>

        {/* Alerta extemporánea */}
        {glosa.es_extemporanea && (
          <div className="mt-3 bg-purple-500/30 border border-purple-300/50 rounded-lg px-3 py-2 text-sm">
            ⏰ <strong>Glosa extemporánea detectada.</strong> La EPS formuló
            esta glosa fuera de los 20 días hábiles. Puede rechazarla con RS04.
          </div>
        )}
      </div>

      {/* ── Contexto de Factura Vinculada ── */}
      {facturaContexto && (
        <div className="mx-6 mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Factura vinculada
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Número</span>
              <span className="font-bold text-slate-700">{facturaContexto.num_factura}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Valor total</span>
              <span className="font-bold text-slate-700">{formatCOP(Number(facturaContexto.valor_total))}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Estado</span>
              <span className="font-semibold text-slate-700">
                {LABELS_ESTADO_FACTURA[facturaContexto.estado as keyof typeof LABELS_ESTADO_FACTURA] || facturaContexto.estado}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Radicación</span>
              <span className="font-medium text-slate-700">
                {facturaContexto.fecha_radicacion?.slice(0, 10) || "Sin radicar"}
              </span>
            </div>
          </div>
          {Number(facturaContexto.valor_glosado) > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Total glosado en esta factura:</span>
              <span className="font-bold text-red-600">
                {formatCOP(Number(facturaContexto.valor_glosado))}
              </span>
              <span className="text-slate-400">
                ({((Number(facturaContexto.valor_glosado) / Number(facturaContexto.valor_total)) * 100).toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Cuerpo ── */}
      <div className="p-6 space-y-6">
        {/* Botón Sugerir con IA */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSugerirIA}
            disabled={cargandoIA}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 shadow-sm"
          >
            {cargandoIA ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analizando...
              </>
            ) : (
              <>✨ Sugerir con IA</>
            )}
          </button>

          {sugerenciaIA && (
            <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
              <strong>IA recomienda {sugerenciaIA.codigo_recomendado}</strong>
              <span className="ml-2 opacity-70">
                (confianza: {(sugerenciaIA.confianza * 100).toFixed(0)}%)
              </span>
              <p className="mt-0.5 text-indigo-600">
                {sugerenciaIA.razonamiento}
              </p>
            </div>
          )}
        </div>

        {/* 1. Selector RS01-RS05 */}
        <SelectorRespuesta
          codigoSeleccionado={codigoRespuesta}
          onSeleccionar={handleSeleccionarCodigo}
          esExtemporanea={glosa.es_extemporanea}
          codigoRecomendadoIA={sugerenciaIA?.codigo_recomendado}
        />

        {/* 2. Valor aceptado (solo RS02) */}
        {codigoRespuesta === "RS02" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Valor aceptado (nota crédito)
            </label>
            <input
              type="number"
              min={1}
              max={glosa.valor_glosado - 1}
              value={valorAceptado || ""}
              onChange={(e) => setValorAceptado(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              placeholder={`Entre $1 y ${formatCOP(glosa.valor_glosado - 1)}`}
            />
            {valorAceptado > 0 && valorAceptado < glosa.valor_glosado && (
              <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                <div className="bg-red-50 p-2 rounded-lg">
                  <span className="text-gray-500">Nota crédito →</span>
                  <p className="font-bold text-red-600">
                    {formatCOP(valorAceptado)}
                  </p>
                </div>
                <div className="bg-green-50 p-2 rounded-lg">
                  <span className="text-gray-500">Controvertido →</span>
                  <p className="font-bold text-green-600">
                    {formatCOP(glosa.valor_glosado - valorAceptado)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Justificación técnica */}
        {config?.requiereJustificacion && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Justificación técnica
              <span className="text-gray-400 font-normal ml-1">
                (mínimo 20 caracteres)
              </span>
            </label>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-y"
              placeholder="Escriba la justificación técnica de la respuesta..."
            />
            <div className="flex justify-between text-xs">
              <span className={justificacion.length >= 20 ? "text-green-600" : "text-gray-400"}>
                {justificacion.length} / 20 caracteres mínimo
              </span>
            </div>

            {/* Fundamento legal */}
            <label className="text-sm font-semibold text-gray-700 mt-2 block">
              Fundamento legal
              <span className="text-gray-400 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              value={fundamentoLegal}
              onChange={(e) => setFundamentoLegal(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-y"
              placeholder="Ej: Art. 57 Ley 1438/2011, Res. 2284/2023..."
            />
          </div>
        )}

        {/* 4. Soportes adjuntos */}
        {config?.requiereSoportes && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Soportes adjuntos
            </label>
            <div className="flex items-center gap-2">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm cursor-pointer transition-colors ${subiendoArchivo ? "border-gray-200 bg-gray-50 text-gray-400 cursor-wait" : "border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
                {subiendoArchivo ? (
                  <>⏳ Subiendo archivo...</>
                ) : (
                  <>📎 Seleccionar archivo (PDF, JPG, PNG — máx 10 MB)</>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleSubirSoporte}
                  disabled={subiendoArchivo}
                  className="hidden"
                />
              </label>
            </div>

            {/* Lista de soportes */}
            {soportes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {soportes.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                  >
                    📎 {s.nombre}
                    <button
                      type="button"
                      onClick={() => handleRemoverSoporte(i)}
                      className="ml-1 text-indigo-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Resumen */}
        {codigoRespuesta && valoresResumen && (
          <div className={`rounded-xl border p-4 ${coloresRS?.border || "border-gray-200"} ${coloresRS?.bg || "bg-gray-50"}`}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Resumen de la respuesta
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Código</span>
                <p className={`font-bold font-mono ${coloresRS?.text || ""}`}>
                  {codigoRespuesta} — {config?.nombre}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Fecha</span>
                <p className="font-medium">
                  {new Date().toLocaleDateString("es-CO")}
                </p>
              </div>
              {valoresResumen.notaCredito > 0 && (
                <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <span className="text-amber-800 text-xs font-semibold">
                    ⚠ Nota crédito DIAN a emitir:{" "}
                    <span className="text-base">
                      {formatCOP(valoresResumen.notaCredito)}
                    </span>
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500 text-xs">Valor aceptado</span>
                <p className="font-bold text-red-600">
                  {formatCOP(valoresResumen.aceptado)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Valor controvertido</span>
                <p className="font-bold text-green-600">
                  {formatCOP(valoresResumen.controvertido)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            ❌ {error}
          </div>
        )}

        {/* 6. Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!puedeEnviar || enviando}
            className={`
              flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all
              ${puedeEnviar && !enviando
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-md hover:shadow-lg"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {enviando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Registrando...
              </span>
            ) : (
              `Registrar Respuesta ${codigoRespuesta || ""}`
            )}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
