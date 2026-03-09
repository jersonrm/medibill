"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  obtenerInfoBilling,
  cancelarSuscripcion,
} from "@/app/actions/billing";
import type { LimitesOrg, HistorialPago } from "@/lib/types/suscripcion";

function formatCOP(valor: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor);
}

function BarraUso({ usado, limite, label }: { usado: number; limite: number; label: string }) {
  const ilimitado = limite < 0;
  const porcentaje = ilimitado ? 0 : limite === 0 ? 100 : Math.min((usado / limite) * 100, 100);
  const color =
    porcentaje >= 90 ? "bg-red-500" : porcentaje >= 70 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">
          {usado} / {ilimitado ? "∞" : limite.toLocaleString("es-CO")}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: ilimitado ? "0%" : `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

export default function SuscripcionPage() {
  const [limites, setLimites] = useState<LimitesOrg | null>(null);
  const [historial, setHistorial] = useState<HistorialPago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    const info = await obtenerInfoBilling();
    if (info.limites) setLimites(info.limites);
    if (info.historial) setHistorial(info.historial);
    setCargando(false);
  };

  const handleCancelar = async () => {
    if (!confirm("¿Seguro que deseas cancelar tu suscripción? Mantendrás acceso hasta el final del periodo actual.")) return;
    setCancelando(true);
    const result = await cancelarSuscripcion();
    if (result.error) {
      alert(result.error);
    } else {
      await cargarDatos();
    }
    setCancelando(false);
  };

  if (cargando) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!limites) {
    return (
      <div className="p-8 text-center text-gray-500">
        No se pudo cargar la información de suscripción.
      </div>
    );
  }

  const esTrial = limites.estado === "trialing";
  const diasRestantes = limites.finPeriodo
    ? Math.max(0, Math.ceil((new Date(limites.finPeriodo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suscripción</h1>
          <p className="text-gray-500 mt-1">Gestiona tu plan y revisa tu uso</p>
        </div>
        <Link
          href="/configuracion"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Configuración
        </Link>
      </div>

      {/* Plan actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Plan {limites.planNombre || "Sin plan"}
              </h2>
              {esTrial && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  Prueba gratuita — {diasRestantes} días restantes
                </span>
              )}
              {limites.estado === "active" && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  Activo
                </span>
              )}
              {limites.estado === "past_due" && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  Pago pendiente
                </span>
              )}
            </div>
            {limites.precioCopMensual > 0 && (
              <p className="text-gray-500 mt-1">
                {formatCOP(limites.precioCopMensual)} / mes
              </p>
            )}
          </div>
          <Link
            href="/configuracion/suscripcion/seleccionar-plan"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            {esTrial ? "Elegir plan" : "Cambiar plan"}
          </Link>
        </div>

        {/* Features del plan */}
        {limites.plan && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Clasificaciones IA</p>
              <p className="text-lg font-semibold text-gray-900">
                {limites.maxClasificaciones == null || (limites.maxClasificaciones as number) < 0 ? "∞" : limites.maxClasificaciones.toLocaleString("es-CO")}
              </p>
              <p className="text-xs text-gray-400">/ mes</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Facturas DIAN</p>
              <p className="text-lg font-semibold text-gray-900">
                {limites.maxFacturasDian == null || (limites.maxFacturasDian as number) < 0 ? "∞" : limites.maxFacturasDian.toLocaleString("es-CO")}
              </p>
              <p className="text-xs text-gray-400">/ mes</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Almacenamiento</p>
              <p className="text-lg font-semibold text-gray-900">
                {limites.storageGb < 0 ? "∞" : `${limites.storageGb} GB`}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Usuarios</p>
              <p className="text-lg font-semibold text-gray-900">
                {limites.maxUsuarios < 0 ? "∞" : limites.maxUsuarios}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uso del mes */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Uso este mes</h2>
        <div className="space-y-4">
          <BarraUso
            usado={limites.uso.clasificaciones}
            limite={limites.maxClasificaciones ?? -1}
            label="Clasificaciones IA"
          />
          <BarraUso
            usado={limites.uso.facturasDian}
            limite={limites.maxFacturasDian ?? -1}
            label="Facturas DIAN"
          />
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Historial de pagos</h2>
        {historial.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No hay pagos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Monto</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Método</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((pago) => (
                  <tr key={pago.id} className="border-b border-gray-50">
                    <td className="py-3">{new Date(pago.created_at).toLocaleDateString("es-CO")}</td>
                    <td className="py-3 font-medium">{formatCOP(pago.monto_cop)}</td>
                    <td className="py-3 text-gray-500">{pago.metodo_pago || "—"}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          pago.estado === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : pago.estado === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {pago.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancelar suscripción */}
      {limites.estado === "active" && (
        <div className="border border-red-200 rounded-xl p-6 bg-red-50/50">
          <h3 className="font-medium text-red-800">Cancelar suscripción</h3>
          <p className="text-sm text-red-600 mt-1">
            Mantendrás acceso hasta el final del periodo de facturación actual.
          </p>
          <button
            onClick={handleCancelar}
            disabled={cancelando}
            className="mt-3 px-4 py-2 text-sm bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {cancelando ? "Cancelando..." : "Cancelar suscripción"}
          </button>
        </div>
      )}
    </div>
  );
}
