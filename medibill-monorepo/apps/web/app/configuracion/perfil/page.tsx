"use client";

import React, { useState, useEffect } from "react";
import { obtenerPerfil, guardarPerfil, obtenerResolucionActiva, guardarResolucion, obtenerResoluciones, activarResolucion, obtenerConsentimientoDatos, toggleConsentimientoDatos } from "@/app/actions/perfil";
import { programarEliminacionCuenta, cancelarEliminacionCuenta, estadoEliminacionCuenta, exportarDatosUsuario } from "@/app/actions/cuenta";
import { obtenerCredencialesMuv, guardarCredencialesMuv } from "@/app/actions/muv";
import { DEPARTAMENTOS, MUNICIPIOS } from "@/lib/data/divipola";
import type { PerfilPrestador, TipoPrestador, RegimenFiscal, ResolucionFacturacion } from "@/lib/types/perfil";
import type { CredencialesMuv, CredencialesMuvInput } from "@/lib/types/muv";
import { formatFechaCO } from "@/lib/formato";

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Partial<PerfilPrestador>>({});
  const [resolucion, setResolucion] = useState<Partial<ResolucionFacturacion>>({});
  const [resoluciones, setResoluciones] = useState<ResolucionFacturacion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [eliminacion, setEliminacion] = useState<{ programada: boolean; fecha?: string }>({ programada: false });
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [muvCreds, setMuvCreds] = useState<CredencialesMuvInput>({
    tipo_usuario: "02",
    tipo_identificacion: "NIT",
    numero_identificacion: "",
    contrasena: "",
    nit_prestador: "",
  });
  const [muvExiste, setMuvExiste] = useState(false);
  const [guardandoMuv, setGuardandoMuv] = useState(false);
  const [compartirDatos, setCompartirDatos] = useState(false);
  const [guardandoCompartir, setGuardandoCompartir] = useState(false);
  const [exportando, setExportando] = useState(false);

  const cargarResoluciones = async () => {
    const lista = await obtenerResoluciones();
    setResoluciones(lista);
    const activa = lista.find((r) => r.activa);
    if (activa) setResolucion(activa);
  };

  useEffect(() => {
    (async () => {
      const p = await obtenerPerfil();
      if (p) setPerfil(p);
      await cargarResoluciones();
      const elim = await estadoEliminacionCuenta();
      setEliminacion(elim);
      const creds = await obtenerCredencialesMuv();
      if (creds) {
        setMuvCreds({
          tipo_usuario: creds.tipo_usuario,
          tipo_identificacion: creds.tipo_identificacion,
          numero_identificacion: creds.numero_identificacion,
          contrasena: "",
          nit_prestador: creds.nit_prestador,
        });
        setMuvExiste(true);
      }
      const consent = await obtenerConsentimientoDatos();
      setCompartirDatos(consent);
      setCargando(false);
    })();
  }, []);

  const municipiosDepto = perfil.departamento_codigo
    ? (MUNICIPIOS[perfil.departamento_codigo] ?? [])
    : [];

  const handleDepartamentoChange = (codigo: string) => {
    const depto = DEPARTAMENTOS.find((d) => d.codigo === codigo);
    setPerfil((p) => ({
      ...p,
      departamento_codigo: codigo,
      departamento_nombre: depto?.nombre ?? "",
      municipio_codigo: "",
      municipio_nombre: "",
    }));
  };

  const handleMunicipioChange = (codigo: string) => {
    const mun = municipiosDepto.find((m) => m.codigo === codigo);
    setPerfil((p) => ({
      ...p,
      municipio_codigo: codigo,
      municipio_nombre: mun?.nombre ?? "",
    }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setMensaje(null);

    const { id, user_id, created_at, updated_at, ...datosLimpios } = perfil as PerfilPrestador;
    const resPerfil = await guardarPerfil(datosLimpios);

    if (!resPerfil.success) {
      setMensaje({ tipo: "error", texto: resPerfil.error ?? "Error al guardar" });
      setGuardando(false);
      return;
    }

    if (resolucion.numero_resolucion) {
      const resRes = await guardarResolucion({
        id: resolucion.id,
        numero_resolucion: resolucion.numero_resolucion ?? "",
        fecha_resolucion: resolucion.fecha_resolucion ?? "",
        prefijo: resolucion.prefijo ?? "",
        rango_desde: resolucion.rango_desde ?? 0,
        rango_hasta: resolucion.rango_hasta ?? 0,
        fecha_vigencia_desde: resolucion.fecha_vigencia_desde ?? "",
        fecha_vigencia_hasta: resolucion.fecha_vigencia_hasta ?? "",
        clave_tecnica: resolucion.clave_tecnica ?? null,
        activa: resolucion.activa ?? true,
      });
      if (!resRes.success) {
        setMensaje({ tipo: "error", texto: resRes.error ?? "Error al guardar resolución" });
        setGuardando(false);
        return;
      }
      await cargarResoluciones();
    }

    setMensaje({ tipo: "ok", texto: "Perfil actualizado correctamente" });
    setGuardando(false);
  };

  const inputClasses = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary outline-none transition-all";
  const labelClasses = "block text-sm font-medium text-medi-dark mb-1";
  const sectionClasses = "bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4";

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medi-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-medi-deep mb-1">Perfil del Prestador</h1>
      <p className="text-sm text-medi-dark/60 mb-6">Administre sus datos fiscales, ubicación y resolución de facturación</p>

      {mensaje && (
        <div className={`mb-6 p-3 rounded-lg text-sm ${mensaje.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Datos del Prestador */}
      <div className={sectionClasses}>
        <h2 className="text-md font-bold text-medi-deep">Datos del Prestador</h2>

        <div>
          <label className={labelClasses}>Tipo de prestador</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["profesional_independiente", "Profesional Independiente"],
              ["clinica", "Clínica / Centro Médico"],
            ] as [TipoPrestador, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPerfil((p) => ({ ...p, tipo_prestador: val }))}
                className={`px-3 py-2.5 text-sm rounded-lg border-2 font-medium transition-all ${
                  perfil.tipo_prestador === val
                    ? "border-medi-primary bg-medi-primary/5 text-medi-primary"
                    : "border-gray-200 text-gray-600 hover:border-medi-light"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClasses}>Tipo documento</label>
            <select
              value={perfil.tipo_documento ?? "NIT"}
              onChange={(e) => setPerfil((p) => ({ ...p, tipo_documento: e.target.value }))}
              className={inputClasses}
            >
              <option value="NIT">NIT</option>
              <option value="CC">CC</option>
            </select>
          </div>
          <div>
            <label className={labelClasses}>Número de documento</label>
            <input
              type="text"
              value={perfil.numero_documento ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, numero_documento: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>DV</label>
            <input
              type="text"
              maxLength={1}
              value={perfil.digito_verificacion ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, digito_verificacion: e.target.value }))}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Razón social</label>
            <input
              type="text"
              value={perfil.razon_social ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, razon_social: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Nombre comercial</label>
            <input
              type="text"
              value={perfil.nombre_comercial ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, nombre_comercial: e.target.value }))}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClasses}>Código habilitación</label>
            <input
              type="text"
              value={perfil.codigo_habilitacion ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, codigo_habilitacion: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Especialidad</label>
            <input
              type="text"
              value={perfil.especialidad_principal ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, especialidad_principal: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Registro médico</label>
            <input
              type="text"
              value={perfil.registro_medico ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, registro_medico: e.target.value }))}
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* Ubicación y Contacto */}
      <div className={`${sectionClasses} mt-6`}>
        <h2 className="text-md font-bold text-medi-deep">Ubicación y Contacto</h2>

        <div>
          <label className={labelClasses}>Dirección</label>
          <input
            type="text"
            value={perfil.direccion ?? ""}
            onChange={(e) => setPerfil((p) => ({ ...p, direccion: e.target.value }))}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Departamento</label>
            <select
              value={perfil.departamento_codigo ?? ""}
              onChange={(e) => handleDepartamentoChange(e.target.value)}
              className={inputClasses}
            >
              <option value="">Seleccione...</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClasses}>Municipio</label>
            <select
              value={perfil.municipio_codigo ?? ""}
              onChange={(e) => handleMunicipioChange(e.target.value)}
              className={inputClasses}
              disabled={!perfil.departamento_codigo}
            >
              <option value="">Seleccione...</option>
              {municipiosDepto.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Teléfono</label>
            <input
              type="tel"
              value={perfil.telefono ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, telefono: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Email de facturación</label>
            <input
              type="email"
              value={perfil.email_facturacion ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, email_facturacion: e.target.value }))}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Responsable de IVA</label>
            <div className="flex gap-4 mt-2">
              {[true, false].map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={perfil.responsable_iva === val}
                    onChange={() => setPerfil((p) => ({ ...p, responsable_iva: val }))}
                  />
                  <span className="text-sm text-medi-dark">{val ? "Sí" : "No"}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClasses}>Régimen fiscal</label>
            <select
              value={perfil.regimen_fiscal ?? "simplificado"}
              onChange={(e) => setPerfil((p) => ({ ...p, regimen_fiscal: e.target.value as RegimenFiscal }))}
              className={inputClasses}
            >
              <option value="simplificado">Simplificado</option>
              <option value="comun">Común</option>
              <option value="no_responsable">No responsable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resolución DIAN */}
      <div className={`${sectionClasses} mt-6`}>
        <h2 className="text-md font-bold text-medi-deep">Resolución de Facturación DIAN</h2>

        {resolucion.id && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            Resolución activa: <strong>{resolucion.prefijo}</strong> — Consecutivo actual: <strong>{resolucion.consecutivo_actual}</strong> de {resolucion.rango_hasta}
            {resolucion.fecha_vigencia_hasta && (
              <span> — Vigente hasta: <strong>{formatFechaCO(resolucion.fecha_vigencia_hasta)}</strong></span>
            )}
          </div>
        )}

        {/* Lista de resoluciones existentes */}
        {resoluciones.length > 1 && (
          <div className="space-y-2">
            <label className={labelClasses}>Resoluciones registradas</label>
            <div className="space-y-1.5">
              {resoluciones.map((r) => {
                const restantes = (r.rango_hasta || 0) - (r.consecutivo_actual ?? (r.rango_desde || 1));
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${
                      r.activa ? "border-medi-primary bg-medi-primary/5" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${r.activa ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="font-mono font-medium">{r.prefijo || "(sin prefijo)"}</span>
                      <span className="text-gray-500">Res. {r.numero_resolucion}</span>
                      <span className="text-gray-400">({restantes} restantes)</span>
                    </div>
                    {!r.activa && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await activarResolucion(r.id);
                          if (res.success) {
                            await cargarResoluciones();
                            setMensaje({ tipo: "ok", texto: `Resolución ${r.prefijo} activada` });
                          }
                        }}
                        className="px-3 py-1 text-xs font-semibold text-medi-primary border border-medi-primary rounded-lg hover:bg-medi-primary hover:text-white transition-colors"
                      >
                        Activar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Número de resolución</label>
            <input
              type="text"
              value={resolucion.numero_resolucion ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, numero_resolucion: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Fecha de resolución</label>
            <input
              type="date"
              value={resolucion.fecha_resolucion ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, fecha_resolucion: e.target.value }))}
              className={inputClasses}
              min="2000-01-01"
              max="2099-12-31"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Prefijo</label>
            <input
              type="text"
              value={resolucion.prefijo ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, prefijo: e.target.value.toUpperCase() }))}
              className={inputClasses}
              maxLength={10}
            />
          </div>
          <div>
            <label className={labelClasses}>Clave técnica DIAN</label>
            <input
              type="text"
              value={resolucion.clave_tecnica ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, clave_tecnica: e.target.value }))}
              className={inputClasses}
              placeholder="fc8eac422eba16e22ffd8c6f94b3f40a..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Rango desde</label>
            <input
              type="number"
              value={resolucion.rango_desde ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, rango_desde: parseInt(e.target.value) || 0 }))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Rango hasta</label>
            <input
              type="number"
              value={resolucion.rango_hasta ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, rango_hasta: parseInt(e.target.value) || 0 }))}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Vigencia desde</label>
            <input
              type="date"
              value={resolucion.fecha_vigencia_desde ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, fecha_vigencia_desde: e.target.value }))}
              className={inputClasses}
              min="2000-01-01"
              max="2099-12-31"
            />
          </div>
          <div>
            <label className={labelClasses}>Vigencia hasta</label>
            <input
              type="date"
              value={resolucion.fecha_vigencia_hasta ?? ""}
              onChange={(e) => setResolucion((r) => ({ ...r, fecha_vigencia_hasta: e.target.value }))}
              className={inputClasses}
              min="2000-01-01"
              max="2099-12-31"
            />
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="px-8 py-3 text-sm font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent shadow-md transition-all disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {/* Credenciales MUV */}
      <div className={`${sectionClasses} mt-6`}>
        <h2 className="text-md font-bold text-medi-deep">Credenciales MUV — MinSalud</h2>
        <p className="text-sm text-medi-dark/60">Credenciales para validar RIPS ante el Ministerio de Salud. Se almacenan encriptadas.</p>

        {muvExiste && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            Credenciales configuradas — {muvCreds.tipo_identificacion} {muvCreds.numero_identificacion}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Tipo de usuario</label>
            <select
              value={muvCreds.tipo_usuario}
              onChange={(e) => setMuvCreds((c) => ({ ...c, tipo_usuario: e.target.value }))}
              className={inputClasses}
            >
              <option value="02">02 — Responsable Técnico</option>
              <option value="03">03 — Operador</option>
            </select>
          </div>
          <div>
            <label className={labelClasses}>Tipo de identificación</label>
            <select
              value={muvCreds.tipo_identificacion}
              onChange={(e) => setMuvCreds((c) => ({ ...c, tipo_identificacion: e.target.value }))}
              className={inputClasses}
            >
              <option value="NIT">NIT</option>
              <option value="CC">Cédula de Ciudadanía</option>
              <option value="CE">Cédula de Extranjería</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Número de identificación</label>
            <input
              type="text"
              value={muvCreds.numero_identificacion}
              onChange={(e) => setMuvCreds((c) => ({ ...c, numero_identificacion: e.target.value }))}
              className={inputClasses}
              placeholder="900123456"
            />
          </div>
          <div>
            <label className={labelClasses}>Contraseña MUV {muvExiste && "(dejar vacía para no cambiar)"}</label>
            <input
              type="password"
              value={muvCreds.contrasena}
              onChange={(e) => setMuvCreds((c) => ({ ...c, contrasena: e.target.value }))}
              className={inputClasses}
              placeholder={muvExiste ? "••••••••" : "Contraseña del portal MUV"}
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>NIT del prestador</label>
          <input
            type="text"
            value={muvCreds.nit_prestador || perfil.numero_documento || ""}
            onChange={(e) => setMuvCreds((c) => ({ ...c, nit_prestador: e.target.value }))}
            className={inputClasses}
            placeholder="900123456"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={async () => {
              if (!muvCreds.numero_identificacion) {
                setMensaje({ tipo: "error", texto: "Ingrese el número de identificación MUV" });
                return;
              }
              if (!muvExiste && !muvCreds.contrasena) {
                setMensaje({ tipo: "error", texto: "Ingrese la contraseña MUV" });
                return;
              }
              if (muvExiste && !muvCreds.contrasena) {
                setMensaje({ tipo: "ok", texto: "No se realizaron cambios en las credenciales MUV" });
                return;
              }
              setGuardandoMuv(true);
              const res = await guardarCredencialesMuv({
                ...muvCreds,
                nit_prestador: muvCreds.nit_prestador || perfil.numero_documento || "",
              });
              if (res.success) {
                setMuvExiste(true);
                setMuvCreds((c) => ({ ...c, contrasena: "" }));
                setMensaje({ tipo: "ok", texto: "Credenciales MUV guardadas correctamente" });
              } else {
                setMensaje({ tipo: "error", texto: res.error ?? "Error al guardar credenciales MUV" });
              }
              setGuardandoMuv(false);
            }}
            disabled={guardandoMuv}
            className="px-6 py-2.5 text-sm font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent shadow-md transition-all disabled:opacity-50"
          >
            {guardandoMuv ? "Guardando..." : muvExiste ? "Actualizar credenciales MUV" : "Guardar credenciales MUV"}
          </button>
        </div>
      </div>

      {/* Inteligencia Colectiva — Compartir datos */}
      <div className={`${sectionClasses} mt-6`}>
        <h2 className="text-md font-bold text-medi-deep">Inteligencia Colectiva</h2>
        <p className="text-sm text-medi-dark/60">
          Comparte tus datos anonimizados para obtener benchmarks comparativos de tu EPS: tasas de glosa, tiempos de pago y tarifas de referencia.
        </p>

        <div className="flex items-start gap-4 p-4 rounded-xl border border-medi-light/50 bg-medi-light/10">
          <button
            type="button"
            role="switch"
            aria-checked={compartirDatos}
            disabled={guardandoCompartir}
            onClick={async () => {
              setGuardandoCompartir(true);
              const nuevoValor = !compartirDatos;
              const res = await toggleConsentimientoDatos(nuevoValor);
              if (res.success) {
                setCompartirDatos(nuevoValor);
                setMensaje({ tipo: "ok", texto: nuevoValor ? "Datos compartidos activados" : "Datos compartidos desactivados" });
              } else {
                setMensaje({ tipo: "error", texto: res.error ?? "Error al cambiar preferencia" });
              }
              setGuardandoCompartir(false);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-medi-primary/30 disabled:opacity-50 ${
              compartirDatos ? "bg-medi-primary" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                compartirDatos ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-medi-deep">
              Compartir mis datos anonimizados para benchmarks
            </p>
            <p className="text-xs text-medi-dark/50 mt-1">
              Tus datos se agregan anónimamente. Nunca se comparte información individual. Se necesitan al menos 3 usuarios por EPS para generar comparativas.
            </p>
          </div>
        </div>
      </div>

      {/* Exportar datos — Habeas Data */}
      <div className={`${sectionClasses} mt-6`}>
        <h2 className="text-md font-bold text-medi-deep">Mis datos personales</h2>
        <p className="text-sm text-medi-dark/60">
          De acuerdo con la Ley 1581 de 2012 (Habeas Data), puedes descargar una copia de todos tus datos almacenados en Medibill.
        </p>
        <div className="flex justify-end">
          <button
            onClick={async () => {
              setExportando(true);
              const res = await exportarDatosUsuario();
              if (res.success && res.data) {
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `medibill-datos-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setMensaje({ tipo: "ok", texto: "Datos exportados correctamente" });
              } else {
                setMensaje({ tipo: "error", texto: res.error ?? "Error al exportar datos" });
              }
              setExportando(false);
            }}
            disabled={exportando}
            className="px-6 py-2.5 text-sm font-bold text-medi-primary border-2 border-medi-primary rounded-lg hover:bg-medi-primary hover:text-white transition-all disabled:opacity-50"
          >
            {exportando ? "Exportando..." : "Descargar mis datos"}
          </button>
        </div>
      </div>

      {/* Zona de peligro — Eliminar cuenta */}
      <div className="mt-12 rounded-xl border-2 border-red-200 bg-red-50/50 p-6 space-y-4">
        <h2 className="text-md font-bold text-red-700">Eliminar cuenta</h2>

        {eliminacion.programada ? (
          <>
            <p className="text-sm text-red-600">
              La eliminación de tu cuenta está programada. Todos tus datos serán eliminados permanentemente
              después del{" "}
              <strong>
                {new Date(new Date(eliminacion.fecha!).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("es-CO")}
              </strong>.
            </p>
            <button
              onClick={async () => {
                const res = await cancelarEliminacionCuenta();
                if (res.success) {
                  setEliminacion({ programada: false });
                  setMensaje({ tipo: "ok", texto: "Eliminación de cuenta cancelada." });
                }
              }}
              className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all"
            >
              Cancelar eliminación
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-red-600/80">
              Al solicitar la eliminación, tendrás 7 días para cancelarla. Después, todos tus datos serán eliminados permanentemente.
            </p>
            {!confirmEliminar ? (
              <button
                onClick={() => setConfirmEliminar(true)}
                className="px-6 py-2.5 text-sm font-bold text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-100 transition-all"
              >
                Solicitar eliminación de cuenta
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const res = await programarEliminacionCuenta();
                    if (res.success) {
                      setEliminacion({ programada: true, fecha: new Date().toISOString() });
                      setConfirmEliminar(false);
                      setMensaje({ tipo: "ok", texto: "Eliminación programada. Tienes 7 días para cancelar." });
                    }
                  }}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all"
                >
                  Confirmar eliminación
                </button>
                <button
                  onClick={() => setConfirmEliminar(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-all"
                >
                  Cancelar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
