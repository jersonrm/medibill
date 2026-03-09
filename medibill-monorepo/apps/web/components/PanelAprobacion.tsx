"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { crearFacturaBorrador } from "@/app/actions/facturas";
import { obtenerResolucionActiva } from "@/app/actions/perfil";
import { formatCOP } from "@/lib/formato";
import type { ResultadoAnalisis, DatosPaciente, ProcedimientoUI, DiagnosticoUI } from "@/lib/types/ui";

interface PanelAprobacionProps {
  resultado: ResultadoAnalisis;
  datosPaciente: DatosPaciente;
  nota: string;
}

export default function PanelAprobacion({ resultado, datosPaciente, nota }: PanelAprobacionProps) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinResolucion, setSinResolucion] = useState(false);

  const valorConsulta = resultado.atencion.valor_consulta || 0;

  const subtotalProcedimientos = resultado.procedimientos.reduce((s: number, p: ProcedimientoUI) => {
    const val = p.valor_unitario || p.valor_procedimiento || 0;
    return s + val * (p.cantidad || 1);
  }, 0);

  const subtotal = subtotalProcedimientos + valorConsulta;

  const copago = resultado.atencion.valor_cuota || 0;
  const valorTotal = subtotal - copago;

  // Procedimientos sin tarifa asignada
  const procSinTarifa = resultado.procedimientos.filter(
    (p) => !p.valor_unitario && !p.valor_procedimiento
  );

  const handleAprobar = async () => {
    setCreando(true);
    setError(null);

    // Validar datos obligatorios del paciente
    const camposFaltantes: string[] = [];
    if (!datosPaciente.cedulaPaciente.trim()) camposFaltantes.push("Documento del paciente");
    if (!datosPaciente.nombrePaciente.trim()) camposFaltantes.push("Nombre del paciente");
    if (!datosPaciente.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(datosPaciente.fechaNacimiento)) camposFaltantes.push("Fecha de nacimiento");
    if (!datosPaciente.sexoPaciente) camposFaltantes.push("Sexo del paciente");
    if (!datosPaciente.epsNombre.trim()) camposFaltantes.push("EPS / Aseguradora");
    if (!datosPaciente.codMunicipioResidencia.trim()) camposFaltantes.push("Municipio de residencia");

    if (camposFaltantes.length > 0) {
      setError("Campos obligatorios faltantes:\n• " + camposFaltantes.join("\n• "));
      setCreando(false);
      return;
    }

    // Verificar resolución
    const resolucion = await obtenerResolucionActiva();
    if (!resolucion) {
      setSinResolucion(true);
      setCreando(false);
      return;
    }

    // Separar nombre en partes
    const partes = datosPaciente.nombrePaciente.trim().split(/\s+/);
    const primerNombre = partes[0] || "";
    const primerApellido = (partes.length > 2 ? partes[2] : partes.length > 1 ? partes[1] : "") ?? "";
    const segundoNombre = partes.length > 2 ? partes[1] : undefined;
    const segundoApellido = partes.length > 3 ? partes[3] : "";

    const res = await crearFacturaBorrador({
      nit_erp: datosPaciente.epsCodigo || "",
      eps_nombre: datosPaciente.epsNombre || "",
      paciente_tipo_documento: datosPaciente.tipoDocumento,
      paciente_numero_documento: datosPaciente.cedulaPaciente,
      paciente_nombre: datosPaciente.nombrePaciente,
      diagnosticos: resultado.diagnosticos.map((d: DiagnosticoUI) => ({
        ...d,
        manual: d.manual || false,
      })),
      procedimientos: resultado.procedimientos.map((p: ProcedimientoUI) => ({
        ...p,
        manual: p.manual || false,
        valor_unitario: p.valor_unitario || p.valor_procedimiento || 0,
        fuente_tarifa: p.fuente_tarifa || "manual",
      })),
      atencion: resultado.atencion,
      nota_clinica_original: nota,
      subtotal,
      copago,
      cuota_moderadora: 0,
      descuentos: 0,
      valor_total: valorTotal,
      datos_paciente: {
        tipo_documento: datosPaciente.tipoDocumento,
        numero_documento: datosPaciente.cedulaPaciente,
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre ?? "",
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido,
        fecha_nacimiento: datosPaciente.fechaNacimiento || undefined,
        sexo: datosPaciente.sexoPaciente || undefined,
        tipo_usuario: datosPaciente.tipoUsuario || undefined,
        municipio_residencia_codigo: datosPaciente.codMunicipioResidencia || undefined,
        zona_territorial: datosPaciente.codZonaTerritorial || undefined,
        eps_nombre: datosPaciente.epsNombre || undefined,
        eps_codigo: datosPaciente.epsCodigo || undefined,
        incapacidad: datosPaciente.incapacidad || "NO",
        telefono: datosPaciente.telefono || undefined,
        email: datosPaciente.email || undefined,
        direccion: datosPaciente.direccion || undefined,
      },
    });

    if (res.success && res.data) {
      router.push(`/facturas/${res.data.id}`);
    } else {
      setError(res.error || "Error al crear factura");
    }
    setCreando(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-md border border-medi-light/50 overflow-hidden">
      <div className="bg-gradient-to-r from-medi-accent to-medi-primary px-8 py-5 text-white">
        <h4 className="font-bold text-lg uppercase tracking-wider">Resumen Pre-Factura</h4>
      </div>
      <div className="p-6">
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-black text-medi-deep">{resultado.diagnosticos.length}</div>
            <div className="text-[10px] font-bold text-medi-dark/50 uppercase">Diagnósticos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-medi-deep">{resultado.procedimientos.length}</div>
            <div className="text-[10px] font-bold text-medi-dark/50 uppercase">Procedimientos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-medi-deep">{formatCOP(valorConsulta)}</div>
            <div className="text-[10px] font-bold text-medi-dark/50 uppercase">Consulta</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-medi-deep">{formatCOP(subtotal)}</div>
            <div className="text-[10px] font-bold text-medi-dark/50 uppercase">Subtotal</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-green-600">{formatCOP(valorTotal)}</div>
            <div className="text-[10px] font-bold text-medi-dark/50 uppercase">Total Neto</div>
          </div>
        </div>

        {subtotalProcedimientos > 0 && valorConsulta > 0 && (
          <div className="text-[10px] text-medi-dark/50 text-center mb-2">
            Procedimientos: {formatCOP(subtotalProcedimientos)} + Consulta: {formatCOP(valorConsulta)}
          </div>
        )}

        {copago > 0 && (
          <div className="text-xs text-medi-dark/60 text-center mb-4">
            Copago/Cuota moderadora: {formatCOP(copago)}
          </div>
        )}

        {/* Alerta procedimientos sin tarifa */}
        {procSinTarifa.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4 text-sm text-red-700">
            <span className="font-bold">⚠️ {procSinTarifa.length} procedimiento(s) sin tarifa asignada:</span>
            <ul className="mt-1 ml-4 list-disc text-xs">
              {procSinTarifa.map((p, i) => (
                <li key={i}>{p.codigo_cups} — {p.descripcion}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium">Ingrese las tarifas antes de crear la factura.</p>
          </div>
        )}

        {/* Alerta sin resolución */}
        {sinResolucion && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 text-sm text-amber-800">
            <span className="font-bold">⚠️ Sin resolución DIAN configurada.</span>{" "}
            La factura se creará con número temporal.{" "}
            <a href="/configuracion/perfil" className="underline font-bold text-amber-900">Configurar resolución →</a>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4 text-sm text-red-700 whitespace-pre-line">{error}</div>
        )}

        {/* Botón de aprobación */}
        <button
          onClick={handleAprobar}
          disabled={creando || procSinTarifa.length > 0}
          className="w-full py-4 bg-gradient-to-r from-medi-accent to-medi-primary text-white font-black text-lg rounded-2xl hover:from-medi-primary hover:to-medi-deep transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creando ? "Creando factura..." : procSinTarifa.length > 0 ? "Complete las tarifas para continuar" : "Aprobar y Crear Factura →"}
        </button>

        <p className="text-[10px] text-center text-medi-dark/40 mt-3">
          Se creará como borrador. Podrás revisar y aprobar formalmente desde el detalle.
        </p>
      </div>
    </div>
  );
}
