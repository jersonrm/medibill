"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ClasificacionPendiente {
  id: string;
  token: string;
  resultado_json: {
    diagnosticos?: { codigo_cie10: string; descripcion: string; rol: string }[];
    procedimientos?: { codigo_cups: string; descripcion: string; cantidad: number }[];
    atencion?: Record<string, unknown>;
    texto_transcrito?: string;
    nombre_paciente?: string;
    documento_paciente?: string;
  };
  texto_transcrito: string | null;
  documento_paciente: string | null;
  paciente_encontrado: boolean;
  datos_paciente: {
    nombre_completo?: string;
    tipo_documento?: string;
    numero_documento?: string;
    fecha_nacimiento?: string;
    sexo?: string;
    eps_codigo?: string;
    eps_nombre?: string;
  } | null;
}

export default function DesdeTelegramClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClasificacionPendiente | null>(null);

  useEffect(() => {
    async function cargarClasificacion() {
      try {
        const res = await fetch(`/api/telegram/clasificacion-pendiente?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Error cargando clasificación");
          return;
        }
        const clasificacion = await res.json();
        setData(clasificacion);
      } catch {
        setError("Error de conexión. Intentá de nuevo.");
      } finally {
        setLoading(false);
      }
    }
    cargarClasificacion();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-medi-primary mx-auto" />
          <p className="mt-4 text-gray-600">Cargando clasificación...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{error || "Clasificación no encontrada"}</h2>
          <p className="mt-2 text-sm text-gray-600">El enlace puede haber expirado. Generá uno nuevo desde el Bot de Telegram.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-medi-primary text-white rounded-lg text-sm font-medium hover:bg-medi-accent transition-colors"
          >
            Ir a Nueva Factura
          </button>
        </div>
      </div>
    );
  }

  const resultado = data.resultado_json;
  const paciente = data.datos_paciente;
  const dxPrincipal = resultado.diagnosticos?.find(d => d.rol === "principal");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clasificación desde Telegram</h1>
            <p className="text-sm text-gray-600">Revisá los datos y creá la factura</p>
          </div>
        </div>
      </div>

      {/* Paciente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Paciente</h2>
        {paciente && data.paciente_encontrado ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">{paciente.nombre_completo}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Documento:</span>{" "}
                <span className="font-medium">{paciente.tipo_documento} {paciente.numero_documento}</span>
              </div>
              <div>
                <span className="text-gray-500">EPS:</span>{" "}
                <span className="font-medium">{paciente.eps_nombre || "Sin EPS"}</span>
              </div>
              {paciente.fecha_nacimiento && (
                <div>
                  <span className="text-gray-500">Fecha Nac.:</span>{" "}
                  <span className="font-medium">{paciente.fecha_nacimiento}</span>
                </div>
              )}
              {paciente.sexo && (
                <div>
                  <span className="text-gray-500">Sexo:</span>{" "}
                  <span className="font-medium">{paciente.sexo === "M" ? "Masculino" : "Femenino"}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-green-600 mt-2">✅ Paciente registrado — datos pre-cargados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.documento_paciente && (
              <p className="text-sm">
                <span className="text-gray-500">Cédula detectada:</span>{" "}
                <span className="font-medium">{data.documento_paciente}</span>
              </p>
            )}
            <p className="text-sm text-amber-600">⚠️ Paciente no registrado — completar datos manualmente</p>
          </div>
        )}
      </div>

      {/* Diagnósticos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Diagnósticos</h2>
        <div className="space-y-3">
          {resultado.diagnosticos?.map((dx, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                dx.rol === "principal"
                  ? "bg-red-100 text-red-700"
                  : dx.rol === "causa_externa"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {dx.rol === "principal" ? "P" : dx.rol === "causa_externa" ? "C" : "R"}
              </span>
              <div>
                <span className="font-mono text-sm font-semibold text-gray-900">{dx.codigo_cie10}</span>
                <span className="text-sm text-gray-700 ml-2">{dx.descripcion}</span>
              </div>
            </div>
          ))}
          {(!resultado.diagnosticos || resultado.diagnosticos.length === 0) && (
            <p className="text-sm text-gray-500">Sin diagnósticos detectados</p>
          )}
        </div>
      </div>

      {/* Procedimientos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Procedimientos</h2>
        <div className="space-y-3">
          {resultado.procedimientos?.map((proc, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                {proc.cantidad || 1}
              </span>
              <div>
                <span className="font-mono text-sm font-semibold text-gray-900">{proc.codigo_cups}</span>
                <span className="text-sm text-gray-700 ml-2">{proc.descripcion}</span>
              </div>
            </div>
          ))}
          {(!resultado.procedimientos || resultado.procedimientos.length === 0) && (
            <p className="text-sm text-gray-500">Sin procedimientos adicionales</p>
          )}
        </div>
      </div>

      {/* Nota transcrita */}
      {data.texto_transcrito && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Nota Transcrita</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.texto_transcrito}</p>
        </div>
      )}

      {/* Acción */}
      <div className="flex gap-4">
        <button
          onClick={() => {
            // Guardar datos en sessionStorage y redirigir a la nueva factura
            const preload = {
              resultado: {
                diagnosticos: resultado.diagnosticos || [],
                procedimientos: resultado.procedimientos || [],
                atencion: resultado.atencion || {},
              },
              paciente: paciente || null,
              documento: data.documento_paciente,
              nombre: resultado.nombre_paciente || paciente?.nombre_completo,
              nota: data.texto_transcrito,
            };
            sessionStorage.setItem("telegram_preload", JSON.stringify(preload));
            router.push("/?from=telegram");
          }}
          className="flex-1 px-6 py-3 bg-medi-primary text-white rounded-xl font-semibold text-sm hover:bg-medi-accent transition-colors shadow-lg shadow-medi-primary/25"
        >
          📝 Crear Factura con estos datos
        </button>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
