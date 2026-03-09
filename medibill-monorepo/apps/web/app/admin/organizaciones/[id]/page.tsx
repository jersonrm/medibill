"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { detalleOrganizacion, cambiarPlanOrg, suspenderOrg } from "@/app/actions/admin";
import type { OrgDetalle } from "@/app/actions/admin";

export default function OrgDetallePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState("");

  useEffect(() => {
    detalleOrganizacion(orgId).then((data) => {
      setOrg(data);
      setLoading(false);
    });
  }, [orgId]);

  if (loading) return <p className="text-gray-500 py-8">Cargando...</p>;
  if (!org) return <p className="text-red-500 py-8">Organización no encontrada.</p>;

  async function handleCambiarPlan(planId: string) {
    setAccion("plan");
    const result = await cambiarPlanOrg(orgId, planId);
    if (result.success) {
      const updated = await detalleOrganizacion(orgId);
      setOrg(updated);
    }
    setAccion("");
  }

  async function handleSuspender(suspender: boolean) {
    setAccion("suspender");
    const result = await suspenderOrg(orgId, suspender);
    if (result.success) {
      const updated = await detalleOrganizacion(orgId);
      setOrg(updated);
    }
    setAccion("");
  }

  const isSuspended = org.suscripcion?.estado === "paused";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.nombre}</h1>
          <p className="text-sm text-gray-500">{org.nit || "Sin NIT"} · {org.tipo} · {org.email_billing}</p>
        </div>
        <button
          onClick={() => router.push("/admin/organizaciones")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver
        </button>
      </div>

      {/* Suscripción */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Suscripción</h2>
        {org.suscripcion ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Plan</p>
              <p className="mt-1 text-lg font-bold capitalize">{org.suscripcion.plan_id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Estado</p>
              <p className="mt-1 text-lg font-bold capitalize">{org.suscripcion.estado}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Período</p>
              <p className="mt-1 text-lg font-bold capitalize">{org.suscripcion.periodo}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">Sin suscripción</p>
        )}

        {/* Acciones */}
        <div className="mt-6 flex flex-wrap gap-3">
          {(["starter", "profesional", "clinica"] as const).map((plan) => (
            <button
              key={plan}
              disabled={accion === "plan" || org.suscripcion?.plan_id === plan}
              onClick={() => handleCambiarPlan(plan)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                org.suscripcion?.plan_id === plan
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {accion === "plan" ? "..." : `Cambiar a ${plan}`}
            </button>
          ))}

          <button
            disabled={accion === "suspender"}
            onClick={() => handleSuspender(!isSuspended)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isSuspended
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            {accion === "suspender" ? "..." : isSuspended ? "Reactivar" : "Suspender"}
          </button>
        </div>
      </div>

      {/* Miembros */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Miembros ({org.miembros.length})
        </h2>
        <div className="space-y-2">
          {org.miembros.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
              <span className="text-sm text-gray-700">{m.invitado_email || m.user_id.slice(0, 8)}</span>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold capitalize">{m.rol}</span>
                <span className={`h-2 w-2 rounded-full ${m.activo ? "bg-green-500" : "bg-gray-300"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uso mensual */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Uso del mes</h2>
        {org.uso_mensual ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Clasificaciones IA</p>
              <p className="mt-1 text-2xl font-bold">{org.uso_mensual.clasificaciones_ia}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Facturas DIAN</p>
              <p className="mt-1 text-2xl font-bold">{org.uso_mensual.facturas_dian}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">Sin uso registrado este mes.</p>
        )}
      </div>
    </div>
  );
}
