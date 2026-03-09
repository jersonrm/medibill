"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { obtenerFactura, aprobarFactura, anularFactura } from "@/app/actions/facturas";
import { listarPagosPorFactura } from "@/app/actions/pagos";
import { formatFechaCO } from "@/lib/formato";
import type { PagoDB } from "@/lib/types/pago";
import { type FacturaData } from "@/components/factura/types";
import FacturaHeader from "@/components/factura/FacturaHeader";
import FacturaDatosClinico from "@/components/factura/FacturaDatosClinico";
import FacturaEditor from "@/components/factura/FacturaEditor";
import DianPanel from "@/components/factura/DianPanel";
import MuvPanel from "@/components/factura/MuvPanel";
import RadicacionPanel from "@/components/factura/RadicacionPanel";
import PagosPanel from "@/components/factura/PagosPanel";

export default function FacturaDetallePage() {
  const params = useParams();
  const router = useRouter();
  const [factura, setFactura] = useState<FacturaData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pagosIniciales, setPagosIniciales] = useState<PagoDB[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await obtenerFactura(params.id as string);
      setFactura(data as FacturaData | null);
      if (data && ["radicada", "pagada_parcial", "pagada"].includes(data.estado)) {
        const p = await listarPagosPorFactura(data.id);
        setPagosIniciales(p);
      }
      setCargando(false);
    };
    load();
  }, [params.id]);

  const handleFacturaUpdate = (updates: Partial<FacturaData>) => {
    setFactura(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleAprobar = async () => {
    if (!factura) return;
    const sinTarifa = factura.procedimientos.filter(p => !p.valor_unitario || p.valor_unitario <= 0);
    if (sinTarifa.length > 0) {
      alert(`No se puede aprobar: ${sinTarifa.length} procedimiento(s) sin tarifa asignada.\n\n${sinTarifa.map(p => `• ${p.codigo_cups} — ${p.descripcion}`).join("\n")}`);
      return;
    }
    if (!confirm("¿Aprobar esta factura? Se asignará el número de factura definitivo.")) return;
    setAccion(true);
    const res = await aprobarFactura(factura.id);
    if (res.success) {
      setFactura(prev => prev ? { ...prev, estado: "aprobada", num_factura: res.numFactura || prev.num_factura } : null);
    } else alert(res.error);
    setAccion(false);
  };

  const handleAnular = async () => {
    if (!factura || !confirm("¿Anular esta factura?")) return;
    setAccion(true);
    const res = await anularFactura(factura.id);
    if (res.success) {
      setFactura(prev => prev ? { ...prev, estado: "anulada" } : null);
    } else alert(res.error);
    setAccion(false);
  };

  if (cargando) return <div className="max-w-[1000px] mx-auto p-8 text-center text-medi-dark/50">Cargando factura...</div>;
  if (!factura) return <div className="max-w-[1000px] mx-auto p-8 text-center text-red-500">Factura no encontrada</div>;

  return (
    <div className="max-w-[1000px] mx-auto p-8">
      <FacturaHeader
        factura={factura}
        editMode={editMode}
        onIniciarEdicion={() => setEditMode(true)}
        onVolver={() => router.push("/facturas")}
      />

      {editMode ? (
        <FacturaEditor
          factura={factura}
          onSaved={(updated) => {
            setFactura(updated);
            setEditMode(false);
          }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <FacturaDatosClinico factura={factura} />
      )}

      {/* Acciones */}
      <div className="mt-8 flex flex-wrap gap-3">
        {factura.estado === "borrador" && !editMode && (
          <>
            <button onClick={handleAprobar} disabled={accion}
              className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md">
              ✓ Aprobar Factura
            </button>
            <button onClick={handleAnular} disabled={accion}
              className="px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-200">
              Anular
            </button>
            {factura.procedimientos.some(p => !p.valor_unitario || p.valor_unitario <= 0) && (
              <div className="w-full bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 font-medium">
                ⚠️ Hay procedimientos sin tarifa. No se podrá aprobar hasta asignar todas las tarifas.
              </div>
            )}
          </>
        )}

        <DianPanel factura={factura} accion={accion} setAccion={setAccion} onFacturaUpdate={handleFacturaUpdate} />

        {factura.estado === "descargada" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 w-full">
            <span className="font-bold">✓ Factura descargada.</span> Descargue el paquete de radicación y radíquela ante la EPS.
          </div>
        )}
        {factura.estado === "anulada" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 w-full">
            <span className="font-bold">Factura anulada.</span> No se puede modificar.
          </div>
        )}

        <RadicacionPanel factura={factura} accion={accion} setAccion={setAccion} onFacturaUpdate={handleFacturaUpdate} />

        {(factura.estado === "radicada" || factura.estado === "pagada_parcial" || factura.estado === "pagada") && (
          <PagosPanel factura={factura} pagosIniciales={pagosIniciales} accion={accion} setAccion={setAccion} onFacturaUpdate={handleFacturaUpdate} />
        )}

        {factura.estado_dian === "aceptada" && (
          <MuvPanel factura={factura} accion={accion} setAccion={setAccion} onFacturaUpdate={handleFacturaUpdate} />
        )}
      </div>

      {/* Metadatos */}
      <div className="mt-8 text-xs text-medi-dark/40 space-y-1">
        <p>Fecha expedición: {formatFechaCO(factura.fecha_expedicion)}</p>
        <p>Creada: {new Date(factura.created_at).toLocaleString("es-CO")}</p>
        <p>Última actualización: {new Date(factura.updated_at).toLocaleString("es-CO")}</p>
      </div>
    </div>
  );
}
