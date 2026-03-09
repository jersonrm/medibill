"use client";

import { useState } from "react";
import { registrarPago, listarPagosPorFactura } from "@/app/actions/pagos";
import { formatCOP, formatFechaCO } from "@/lib/formato";
import type { PagoDB, MetodoPago } from "@/lib/types/pago";
import { METODOS_PAGO } from "@/lib/types/pago";
import type { FacturaData } from "./types";

interface PagosPanelProps {
  factura: FacturaData;
  pagosIniciales: PagoDB[];
  accion: boolean;
  setAccion: (v: boolean) => void;
  onFacturaUpdate: (updates: Partial<FacturaData>) => void;
}

export default function PagosPanel({ factura, pagosIniciales, accion, setAccion, onFacturaUpdate }: PagosPanelProps) {
  const [pagos, setPagos] = useState<PagoDB[]>(pagosIniciales);
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split("T")[0]!);
  const [pagoMetodo, setPagoMetodo] = useState<MetodoPago>("transferencia");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoNotas, setPagoNotas] = useState("");
  const [pagoMsg, setPagoMsg] = useState<string | null>(null);

  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const saldoPendiente = factura.valor_total - totalPagado;

  const handleRegistrarPago = async () => {
    const monto = parseFloat(pagoMonto);
    if (!monto || monto <= 0) {
      setPagoMsg("Error: Ingrese un monto válido");
      return;
    }
    if (monto > saldoPendiente) {
      setPagoMsg(`Error: El monto excede el saldo pendiente (${formatCOP(saldoPendiente)})`);
      return;
    }
    if (!pagoFecha) {
      setPagoMsg("Error: Seleccione la fecha de pago");
      return;
    }
    setAccion(true);
    setPagoMsg(null);
    try {
      const res = await registrarPago({
        factura_id: factura.id,
        monto,
        fecha_pago: pagoFecha,
        metodo_pago: pagoMetodo,
        referencia: pagoReferencia || undefined,
        notas: pagoNotas || undefined,
      });
      if (res.success) {
        const nuevosPagos = await listarPagosPorFactura(factura.id);
        setPagos(nuevosPagos);
        if (res.nuevo_estado) {
          onFacturaUpdate({ estado: res.nuevo_estado });
        }
        setPagoMonto("");
        setPagoReferencia("");
        setPagoNotas("");
        setMostrarFormPago(false);
        setPagoMsg(null);
      } else {
        setPagoMsg(`Error: ${res.error}`);
      }
    } catch (e) {
      console.error("Error registrando pago:", e);
      setPagoMsg("Error: No se pudo registrar el pago");
    } finally {
      setAccion(false);
    }
  };

  return (
    <div className="w-full mt-2">
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black uppercase text-medi-deep">💰 Pagos</h4>
          <div className="flex items-center gap-3">
            <span className="text-xs text-medi-dark/60">
              Pagado: <span className="font-bold text-green-600">{formatCOP(totalPagado)}</span>
              {" | "}Pendiente: <span className="font-bold text-red-600">{formatCOP(saldoPendiente)}</span>
            </span>
            {factura.estado !== "pagada" && (
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                factura.estado === "pagada_parcial" ? "bg-cyan-600 text-white" : "bg-purple-600 text-white"
              }`}>
                {factura.estado === "pagada_parcial" ? "Pago parcial" : "Pendiente"}
              </span>
            )}
            {factura.estado === "pagada" && (
              <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-emerald-600 text-white">Pagada</span>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalPagado / factura.valor_total) * 100)}%` }}
          />
        </div>

        {/* Lista de pagos */}
        {pagos.length > 0 && (
          <div className="space-y-2 mb-4">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-emerald-200">
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-medi-deep">{formatCOP(p.monto)}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {METODOS_PAGO.find(m => m.value === p.metodo_pago)?.label || p.metodo_pago}
                    </span>
                  </div>
                  <div className="text-xs text-medi-dark/50 mt-0.5">
                    {formatFechaCO(p.fecha_pago)}
                    {p.referencia && <span> · Ref: {p.referencia}</span>}
                    {p.notas && <span> · {p.notas}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botón/formulario registrar pago */}
        {saldoPendiente > 0 && (
          <>
            {!mostrarFormPago ? (
              <button
                onClick={() => setMostrarFormPago(true)}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md"
              >
                💰 Registrar Pago
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-emerald-200 p-5 mt-2">
                <h5 className="text-xs font-black uppercase text-medi-deep mb-4">Registrar nuevo pago</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-medi-dark/60 mb-1">Monto *</label>
                    <input
                      type="number"
                      step="0.01"
                      max={saldoPendiente}
                      value={pagoMonto}
                      onChange={(e) => setPagoMonto(e.target.value)}
                      placeholder={`Máximo: ${saldoPendiente.toLocaleString()}`}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-medi-dark/60 mb-1">Fecha de pago *</label>
                    <input
                      type="date"
                      value={pagoFecha}
                      onChange={(e) => setPagoFecha(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-medi-dark/60 mb-1">Método de pago *</label>
                    <select
                      value={pagoMetodo}
                      onChange={(e) => setPagoMetodo(e.target.value as MetodoPago)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      {METODOS_PAGO.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-medi-dark/60 mb-1">Referencia</label>
                    <input
                      type="text"
                      value={pagoReferencia}
                      onChange={(e) => setPagoReferencia(e.target.value)}
                      placeholder="Nro. transferencia, cheque, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-medi-dark/60 mb-1">Notas</label>
                  <input
                    type="text"
                    value={pagoNotas}
                    onChange={(e) => setPagoNotas(e.target.value)}
                    placeholder="Observaciones opcionales"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                {pagoMsg && (
                  <p className={`text-xs mb-3 ${pagoMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                    {pagoMsg}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleRegistrarPago}
                    disabled={accion}
                    className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    ✓ Confirmar pago
                  </button>
                  <button
                    onClick={() => {
                      setMostrarFormPago(false);
                      setPagoMsg(null);
                    }}
                    className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
