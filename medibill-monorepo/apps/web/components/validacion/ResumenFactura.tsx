"use client";

import type { FacturaDB } from "@/lib/types/glosas";
import { LABELS_ESTADO_FACTURA } from "@/lib/types/glosas";

interface ResumenFacturaProps {
  factura: FacturaDB;
}

export default function ResumenFactura({ factura }: ResumenFacturaProps) {
  const meta = factura.metadata as Record<string, unknown> | null;
  const paciente = meta?.paciente as Record<string, unknown> | undefined;
  const esUrgencia = meta?.es_urgencia as boolean | undefined;

  const campos = [
    { label: "N° Factura", valor: factura.num_factura },
    { label: "FEV", valor: factura.num_fev ?? "—" },
    { label: "NIT Prestador", valor: factura.nit_prestador },
    { label: "NIT EPS", valor: factura.nit_erp },
    {
      label: "Valor Total",
      valor: `$${Number(factura.valor_total).toLocaleString("es-CO")}`,
    },
    {
      label: "Estado",
      valor: LABELS_ESTADO_FACTURA[factura.estado] ?? factura.estado,
    },
    {
      label: "Fecha expedición",
      valor: factura.fecha_expedicion?.slice(0, 10) ?? "—",
    },
    {
      label: "Fecha radicación",
      valor: factura.fecha_radicacion?.slice(0, 10) ?? "Pendiente",
    },
  ];

  return (
    <div className="bg-medi-deep/60 border border-medi-dark/50 rounded-xl p-4 space-y-3">
      {/* Grid principal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {campos.map((c) => (
          <div key={c.label}>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
              {c.label}
            </span>
            <span className="text-sm text-gray-200 font-medium">{c.valor}</span>
          </div>
        ))}
      </div>

      {/* Datos de paciente (si disponibles) */}
      {paciente && (
        <div className="border-t border-medi-dark/30 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {!!paciente.nombres && (
            <div className="col-span-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
                Paciente
              </span>
              <span className="text-sm text-gray-200 font-medium">
                {String(paciente.nombres ?? "")} {String(paciente.apellidos ?? "")}
              </span>
            </div>
          )}
          {!!paciente.numero_documento && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
                Documento
              </span>
              <span className="text-sm text-gray-200 font-mono">
                {String(paciente.tipo_documento ?? "")} {String(paciente.numero_documento ?? "")}
              </span>
            </div>
          )}
          {!!paciente.sexo && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
                Sexo
              </span>
              <span className="text-sm text-gray-200">
                {String(paciente.sexo) === "M" ? "Masculino" : "Femenino"}
              </span>
            </div>
          )}
          {esUrgencia !== undefined && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
                Urgencia
              </span>
              <span className={`text-sm font-medium ${esUrgencia ? "text-red-400" : "text-gray-400"}`}>
                {esUrgencia ? "Sí" : "No"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
