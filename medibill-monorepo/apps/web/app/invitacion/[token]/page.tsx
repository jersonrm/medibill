"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { aceptarInvitacion } from "@/app/actions/equipo";

export default function InvitacionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [orgNombre, setOrgNombre] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("error");
      setErrorMsg("Token de invitación no válido.");
      return;
    }

    const aceptar = async () => {
      const result = await aceptarInvitacion(token);
      if (result.success) {
        setEstado("ok");
        setOrgNombre(result.orgNombre || "la organización");
      } else {
        setEstado("error");
        setErrorMsg(result.error || "Error al aceptar la invitación.");
      }
    };

    aceptar();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        {estado === "cargando" && (
          <>
            <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500">Aceptando invitación...</p>
          </>
        )}

        {estado === "ok" && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">¡Bienvenido!</h1>
            <p className="text-gray-600">
              Te has unido exitosamente a <strong>{orgNombre}</strong>.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              Ir al dashboard
            </button>
          </>
        )}

        {estado === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Error</h1>
            <p className="text-gray-600">{errorMsg}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
            >
              Ir al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
