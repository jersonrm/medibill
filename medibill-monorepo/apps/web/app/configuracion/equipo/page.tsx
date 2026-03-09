"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  listarMiembros,
  invitarUsuario,
  cambiarRolMiembro,
  desactivarMiembro,
  cancelarInvitacion,
} from "@/app/actions/equipo";
import { obtenerFeaturesUsuario } from "@/lib/suscripcion";
import type { UsuarioOrganizacion, Invitacion, RolOrganizacion } from "@/lib/types/suscripcion";

const ROLES: { value: RolOrganizacion; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "facturador", label: "Facturador" },
  { value: "auditor", label: "Auditor" },
];

const ROL_BADGE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  doctor: "bg-emerald-100 text-emerald-700",
  facturador: "bg-amber-100 text-amber-700",
  auditor: "bg-gray-100 text-gray-700",
};

export default function EquipoPage() {
  const [miembros, setMiembros] = useState<(UsuarioOrganizacion & { email?: string })[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState("");
  const [rolInvitacion, setRolInvitacion] = useState<RolOrganizacion>("doctor");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [featureBloqueada, setFeatureBloqueada] = useState(false);

  useEffect(() => {
    obtenerFeaturesUsuario()
      .then((res) => {
        if (!res || res.maxUsuarios <= 1) setFeatureBloqueada(true);
      })
      .catch(() => setFeatureBloqueada(true));
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    const result = await listarMiembros();
    if (result.error) {
      setMensaje({ tipo: "error", texto: result.error });
    } else {
      setMiembros(result.miembros);
      setInvitaciones(result.invitaciones);
    }
    setCargando(false);
  };

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    setMensaje(null);
    const result = await invitarUsuario(email.trim(), rolInvitacion);
    if (result.success) {
      setMensaje({ tipo: "ok", texto: `Invitación enviada a ${email}` });
      setEmail("");
      await cargarDatos();
    } else {
      setMensaje({ tipo: "error", texto: result.error || "Error al invitar" });
    }
    setEnviando(false);
  };

  const handleCambiarRol = async (miembroId: string, nuevoRol: RolOrganizacion) => {
    const result = await cambiarRolMiembro(miembroId, nuevoRol);
    if (result.error) {
      setMensaje({ tipo: "error", texto: result.error });
    } else {
      await cargarDatos();
    }
  };

  const handleDesactivar = async (miembroId: string) => {
    if (!confirm("¿Seguro que deseas desactivar este usuario? Perderá acceso a la organización.")) return;
    const result = await desactivarMiembro(miembroId);
    if (result.error) {
      setMensaje({ tipo: "error", texto: result.error });
    } else {
      await cargarDatos();
    }
  };

  const handleCancelarInvitacion = async (invitacionId: string) => {
    const result = await cancelarInvitacion(invitacionId);
    if (!result.success) {
      setMensaje({ tipo: "error", texto: result.error || "Error" });
    } else {
      await cargarDatos();
    }
  };

  if (cargando) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (featureBloqueada) {
    return (
      <div className="max-w-lg mx-auto p-8 mt-20 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <svg className="w-12 h-12 mx-auto text-amber-500 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <h2 className="text-xl font-bold text-medi-deep mb-2">Equipo no disponible</h2>
          <p className="text-medi-dark mb-6">Tu plan actual es individual. Actualiza al plan Clínica o superior para invitar miembros a tu equipo.</p>
          <Link href="/configuracion/suscripcion" className="inline-block bg-medi-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-medi-primary/90 transition-colors">
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-500 mt-1">Gestiona los miembros de tu organización</p>
        </div>
        <Link
          href="/configuracion"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Configuración
        </Link>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div
          className={`p-3 rounded-lg text-sm ${
            mensaje.tipo === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Invitar usuario */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invitar usuario</h2>
        <form onSubmit={handleInvitar} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@ejemplo.com"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm text-gray-600 mb-1">Rol</label>
            <select
              value={rolInvitacion}
              onChange={(e) => setRolInvitacion(e.target.value as RolOrganizacion)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {enviando ? "Enviando..." : "Invitar"}
          </button>
        </form>
      </div>

      {/* Miembros activos */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Miembros ({miembros.filter((m) => m.activo).length})
        </h2>
        <div className="divide-y divide-gray-100">
          {miembros
            .filter((m) => m.activo)
            .map((miembro) => (
              <div key={miembro.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                    {(miembro.invitado_email || miembro.user_id || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {miembro.invitado_email || miembro.user_id}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROL_BADGE_COLORS[miembro.rol] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {miembro.rol}
                    </span>
                  </div>
                </div>
                {miembro.rol !== "owner" && (
                  <div className="flex items-center gap-2">
                    <select
                      value={miembro.rol}
                      onChange={(e) =>
                        handleCambiarRol(miembro.id, e.target.value as RolOrganizacion)
                      }
                      className="text-xs px-2 py-1 border border-gray-200 rounded-md"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDesactivar(miembro.id)}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                      title="Desactivar usuario"
                    >
                      Desactivar
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Invitaciones pendientes */}
      {invitaciones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Invitaciones pendientes ({invitaciones.length})
          </h2>
          <div className="divide-y divide-gray-100">
            {invitaciones.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Rol: {inv.rol} · Expira:{" "}
                    {new Date(inv.expira_at).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelarInvitacion(inv.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
