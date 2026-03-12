"use client";

import type { ResultadoValidacion, FacturaDB } from "@/lib/types/glosas";
import SemaforoValidacion from "@/components/validacion/SemaforoValidacion";
import ScoreRiesgo from "@/components/validacion/ScoreRiesgo";
import ContadoresValidacion from "@/components/validacion/ContadoresValidacion";
import ResumenFactura from "@/components/validacion/ResumenFactura";
import ListaAlertas from "@/components/validacion/ListaAlertas";
import PanelRiesgoCampoRips from "@/components/validacion/PanelRiesgoCampoRips";
import BotonEnvio from "@/components/validacion/BotonEnvio";

interface PanelResultadosProps {
  resultado: ResultadoValidacion | null;
  factura: FacturaDB | null;
  loading: boolean;
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-medi-dark/50 rounded-xl animate-pulse ${className}`} />;
}

export default function PanelResultados({ resultado, factura, loading }: PanelResultadosProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
        </div>
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-48" />
        <SkeletonBlock className="h-12" />
      </div>
    );
  }

  if (!resultado || !factura) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-600">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
        <p className="text-sm font-medium">Selecciona una factura para validar</p>
        <p className="text-xs text-gray-700 mt-1">El resultado de la validación aparecerá aquí</p>
      </div>
    );
  }

  const handleEnviar = () => {
    if (resultado.puede_radicar) {
      alert(
        resultado.advertencias > 0
          ? `Factura ${resultado.num_factura} enviada con ${resultado.advertencias} advertencia(s). Revise antes de radicar formalmente.`
          : `Factura ${resultado.num_factura} aprobada y lista para radicación ante la EPS.`
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Fila 1: Semáforo + Score + Contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <div className="bg-medi-deep/60 border border-medi-dark/50 rounded-xl flex items-center justify-center">
          <SemaforoValidacion resultado={resultado} />
        </div>
        <ScoreRiesgo puntaje={resultado.puntaje_riesgo_glosa} />
        <div className="bg-medi-deep/60 border border-medi-dark/50 rounded-xl p-4 flex flex-col justify-center">
          <ContadoresValidacion
            errores={resultado.errores}
            advertencias={resultado.advertencias}
            prevenidas={resultado.glosas_potenciales_prevenidas.length}
          />
        </div>
      </div>

      {/* Fila 2: Resumen de factura */}
      <ResumenFactura factura={factura} />

      {/* Fila 3: Lista de alertas */}
      <div className="bg-medi-deep/40 border border-medi-dark/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide mb-3">
          Alertas ({resultado.alertas.length})
        </h3>
        <ListaAlertas alertas={resultado.alertas} />
      </div>

      {/* Fila 4: Riesgo por campo RIPS */}
      {resultado.alertas.some((a) => a.campo_rips_codigo) && (
        <div className="bg-medi-deep/40 border border-medi-dark/30 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide mb-3">
            Riesgo por campo RIPS (Res. 2275)
          </h3>
          <PanelRiesgoCampoRips alertas={resultado.alertas} />
        </div>
      )}

      {/* Fila 5: Botón de envío */}
      <BotonEnvio resultado={resultado} onEnviar={handleEnviar} />
    </div>
  );
}
