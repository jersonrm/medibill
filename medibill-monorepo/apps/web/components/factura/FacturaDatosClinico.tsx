"use client";

import { formatCOP } from "@/lib/formato";
import type { FacturaData } from "./types";

interface FacturaDatosClinicoProps {
  factura: FacturaData;
}

export default function FacturaDatosClinico({ factura }: FacturaDatosClinicoProps) {
  const paciente = factura.pacientes;
  const perfil = factura.perfil_prestador_snapshot as Record<string, string> | null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos del prestador */}
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Prestador</h3>
          <div className="text-sm space-y-1 text-medi-deep">
            <p className="font-bold">{perfil?.razon_social || perfil?.nombre_completo || "—"}</p>
            <p>NIT: {factura.nit_prestador}</p>
            <p>{perfil?.direccion || ""}</p>
          </div>
        </div>

        {/* Datos del paciente */}
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Paciente</h3>
          {paciente ? (
            <div className="text-sm space-y-1 text-medi-deep">
              <p className="font-bold">{[paciente.primer_nombre, paciente.segundo_nombre, paciente.primer_apellido, paciente.segundo_apellido].filter(Boolean).join(" ")}</p>
              <p>{paciente.tipo_documento}: {paciente.numero_documento}</p>
              <p>EPS: {paciente.eps_nombre || "-"} | Sexo: {paciente.sexo || "-"}</p>
            </div>
          ) : <p className="text-sm text-medi-dark/40">Sin datos de paciente</p>}
        </div>
      </div>

      {/* Diagnósticos */}
      <div className="bg-white rounded-2xl border border-medi-light/50 mt-6 overflow-hidden shadow-sm">
        <div className="bg-medi-deep px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold uppercase text-sm tracking-wider">Diagnósticos (CIE-10)</h3>
        </div>
        <div className="p-4">
          {factura.diagnosticos.map((d, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-medi-light/30" : ""} ${d.manual ? "border-l-4 border-l-amber-400" : ""}`}>
              <span className="font-black text-medi-deep bg-medi-light/30 px-4 py-2 rounded-lg min-w-[90px] text-center text-sm">{d.codigo_cie10}</span>
              <span className="text-sm font-medium text-medi-deep flex-grow">{d.descripcion}</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                d.rol === "principal" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}>{d.rol}</span>
              {d.manual && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Manual</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Procedimientos */}
      <div className="bg-white rounded-2xl border border-medi-light/50 mt-6 overflow-hidden shadow-sm">
        <div className="bg-medi-primary px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold uppercase text-sm tracking-wider">Procedimientos (CUPS)</h3>
        </div>
        <div className="p-4">
          {factura.procedimientos.map((p, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-medi-light/30" : ""} ${p.manual ? "border-l-4 border-l-amber-400" : ""}`}>
              <span className="font-black text-medi-primary bg-medi-light/30 px-4 py-2 rounded-lg min-w-[90px] text-center text-sm">{p.codigo_cups}</span>
              <span className="text-sm font-medium text-medi-deep flex-grow">{p.descripcion}</span>
              <span className="text-xs font-black text-white bg-medi-primary px-3 py-1 rounded-full">x{p.cantidad}</span>
              {p.valor_unitario != null && p.valor_unitario > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-medi-deep">{formatCOP(p.valor_unitario)}</span>
                  {p.fuente_tarifa && (
                    <span className={`text-[8px] font-bold uppercase ${
                      p.fuente_tarifa === "pactada" ? "text-green-600" :
                      p.fuente_tarifa === "propia" ? "text-blue-600" : "text-gray-500"
                    }`}>
                      {p.fuente_tarifa === "pactada" ? "Tarifa pactada" :
                       p.fuente_tarifa === "propia" ? "Tarifa propia" : "Manual"}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">Sin tarifa</span>
              )}
              {p.manual && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Manual</span>}
            </div>
          ))}
        </div>
        {/* Totales */}
        <div className="border-t border-medi-light px-6 py-4 bg-medi-light/10">
          {(() => {
            const aten = factura.atencion || (factura.metadata?.atencion as Record<string, unknown>) || {};
            const vConsulta = (aten as Record<string, unknown>).valor_consulta as number || 0;
            return vConsulta > 0 ? (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-medi-dark/60">Consulta médica</span>
                <span className="font-bold">{formatCOP(vConsulta)}</span>
              </div>
            ) : null;
          })()}
          <div className="flex justify-between text-sm mb-1">
            <span className="text-medi-dark/60">Subtotal</span>
            <span className="font-bold">{formatCOP(factura.subtotal)}</span>
          </div>
          {factura.copago > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-medi-dark/60">Copago</span>
              <span className="font-bold text-red-600">-{formatCOP(factura.copago)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg mt-2 pt-2 border-t border-medi-light">
            <span className="font-black text-medi-deep">Total</span>
            <span className="font-black text-green-600">{formatCOP(factura.valor_total)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
