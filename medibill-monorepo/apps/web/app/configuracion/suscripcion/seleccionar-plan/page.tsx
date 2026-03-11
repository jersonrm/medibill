"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { iniciarCheckout, cambiarPlan, obtenerInfoBilling } from "@/app/actions/billing";
import { obtenerPlanes } from "@/app/actions/suscripcion";
import type { Plan, LimitesOrg } from "@/lib/types/suscripcion";

function formatCOP(valor: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor);
}

const FEATURES_PLAN: Record<string, string[]> = {
  starter: [
    "100 clasificaciones IA / mes",
    "50 facturas DIAN / mes",
    "1 GB almacenamiento",
    "1 usuario",
    "Soporte por email",
  ],
  profesional: [
    "500 clasificaciones IA / mes",
    "200 facturas DIAN / mes",
    "5 GB almacenamiento",
    "1 usuario",
    "Sugerencias IA para glosas",
    "Importación de sábana",
    "Soporte email + chat",
  ],
  clinica: [
    "Clasificaciones IA ilimitadas",
    "Facturas DIAN ilimitadas",
    "20 GB almacenamiento",
    "Hasta 20 usuarios",
    "Todas las funciones premium",
    "Importación masiva",
    "Soporte prioritario",
  ],
  ips: [
    "Todo ilimitado",
    "Usuarios ilimitados",
    "100 GB almacenamiento",
    "API personalizada",
    "SLA 99.9%",
    "Soporte dedicado + onboarding",
  ],
};

export default function SeleccionarPlanPage() {
  const router = useRouter();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [limites, setLimites] = useState<LimitesOrg | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"mensual" | "anual">("mensual");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const [planesData, billingInfo] = await Promise.all([
      obtenerPlanes(),
      obtenerInfoBilling(),
    ]);
    setPlanes(planesData);
    if (billingInfo.limites) setLimites(billingInfo.limites);
    setCargando(false);
  };

  const handleSeleccionar = async (planId: string) => {
    if (planId === "ips") {
      window.open("mailto:ventas@medibill.co?subject=Plan IPS personalizado", "_blank");
      return;
    }

    setProcesando(planId);

    const planActualId = limites?.plan;
    const esTrial = limites?.estado === "trialing";

    if (planActualId && !esTrial && planActualId !== planId) {
      // Cambio de plan (ya tiene suscripción activa)
      const result = await cambiarPlan(planId);
      if (result.error) {
        alert(result.error);
      } else {
        router.push("/configuracion/suscripcion");
      }
    } else {
      // Nuevo checkout
      const result = await iniciarCheckout(planId, periodo);
      if (result.error) {
        alert(result.error);
      } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    }

    setProcesando(null);
  };

  if (cargando) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const planActualId = limites?.plan;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Elige tu plan</h1>
        <p className="text-gray-500">Comienza gratis, escala cuando quieras</p>
      </div>

      {/* Toggle periodo */}
      <div className="flex justify-center">
        <div className="bg-gray-100 rounded-lg p-1 flex">
          <button
            onClick={() => setPeriodo("mensual")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              periodo === "mensual"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setPeriodo("anual")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              periodo === "anual"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Anual
            <span className="ml-1 text-xs text-emerald-600 font-semibold">-20%</span>
          </button>
        </div>
      </div>

      {/* Grid de planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {planes.map((plan) => {
          const esActual = planActualId === plan.id;
          const esPopular = plan.id === "profesional";
          const precio =
            periodo === "anual" && plan.precio_cop_anual
              ? Math.round(plan.precio_cop_anual / 12)
              : plan.precio_cop_mensual;
          const features = FEATURES_PLAN[plan.id] || [];

          return (
            <div
              key={plan.id}
              className={`relative border rounded-2xl p-6 flex flex-col ${
                esPopular
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : "border-gray-200"
              } ${esActual ? "bg-emerald-50/30" : "bg-white"}`}
            >
              {esPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full">
                  Más popular
                </div>
              )}
              {esActual && (
                <div className="absolute -top-3 right-4 px-3 py-0.5 bg-gray-700 text-white text-xs font-semibold rounded-full">
                  Plan actual
                </div>
              )}

              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {plan.nombre}
              </h3>

              <div className="mt-4 mb-6">
                {plan.id === "ips" ? (
                  <p className="text-2xl font-bold text-gray-900">Personalizado</p>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCOP(precio)}
                    </span>
                    <span className="text-gray-500 text-sm"> / mes</span>
                    {periodo === "anual" && plan.precio_cop_anual && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatCOP(plan.precio_cop_anual)} facturado anualmente
                      </p>
                    )}
                    {plan.id === "clinica" && (
                      <p className="text-xs text-emerald-600 mt-1">por asiento</p>
                    )}
                  </>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSeleccionar(plan.id)}
                disabled={esActual || procesando === plan.id}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  esActual
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : esPopular
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                } disabled:opacity-50`}
              >
                {esActual
                  ? "Plan actual"
                  : procesando === plan.id
                  ? "Procesando..."
                  : plan.id === "ips"
                  ? "Contactar ventas"
                  : "Seleccionar"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        Todos los precios en COP. Incluyen IVA. Cancela cuando quieras.
      </p>
    </div>
  );
}
