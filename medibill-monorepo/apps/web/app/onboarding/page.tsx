"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarPerfil, guardarResolucion } from "@/app/actions/perfil";
import { guardarCredencialesMuv } from "@/app/actions/muv";
import { DEPARTAMENTOS, MUNICIPIOS } from "@/lib/data/divipola";
import type { TipoPrestador, RegimenFiscal } from "@/lib/types/perfil";
import type { CredencialesMuvInput } from "@/lib/types/muv";

type Paso = 1 | 2 | 3 | 4;

interface DatosPrestador {
  tipo_prestador: TipoPrestador;
  tipo_documento: string;
  numero_documento: string;
  digito_verificacion: string;
  razon_social: string;
  nombre_comercial: string;
  codigo_habilitacion: string;
  especialidad_principal: string;
  registro_medico: string;
}

interface DatosUbicacion {
  direccion: string;
  departamento_codigo: string;
  departamento_nombre: string;
  municipio_codigo: string;
  municipio_nombre: string;
  telefono: string;
  email_facturacion: string;
  responsable_iva: boolean;
  regimen_fiscal: RegimenFiscal;
}

interface DatosResolucion {
  numero_resolucion: string;
  fecha_resolucion: string;
  prefijo: string;
  rango_desde: string;
  rango_hasta: string;
  fecha_vigencia_desde: string;
  fecha_vigencia_hasta: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [prestador, setPrestador] = useState<DatosPrestador>({
    tipo_prestador: "profesional_independiente",
    tipo_documento: "NIT",
    numero_documento: "",
    digito_verificacion: "",
    razon_social: "",
    nombre_comercial: "",
    codigo_habilitacion: "",
    especialidad_principal: "",
    registro_medico: "",
  });

  const [ubicacion, setUbicacion] = useState<DatosUbicacion>({
    direccion: "",
    departamento_codigo: "",
    departamento_nombre: "",
    municipio_codigo: "",
    municipio_nombre: "",
    telefono: "",
    email_facturacion: "",
    responsable_iva: false,
    regimen_fiscal: "simplificado",
  });

  const [resolucion, setResolucion] = useState<DatosResolucion>({
    numero_resolucion: "",
    fecha_resolucion: "",
    prefijo: "",
    rango_desde: "",
    rango_hasta: "",
    fecha_vigencia_desde: "",
    fecha_vigencia_hasta: "",
  });

  const [muvCreds, setMuvCreds] = useState<CredencialesMuvInput>({
    tipo_usuario: "02",
    tipo_identificacion: "NIT",
    numero_identificacion: "",
    contrasena: "",
    nit_prestador: "",
  });

  const municipiosDepto =
    ubicacion.departamento_codigo
      ? (MUNICIPIOS[ubicacion.departamento_codigo] ?? [])
      : [];

  const handleDepartamentoChange = (codigo: string) => {
    const depto = DEPARTAMENTOS.find((d) => d.codigo === codigo);
    setUbicacion((prev) => ({
      ...prev,
      departamento_codigo: codigo,
      departamento_nombre: depto?.nombre ?? "",
      municipio_codigo: "",
      municipio_nombre: "",
    }));
  };

  const handleMunicipioChange = (codigo: string) => {
    const mun = municipiosDepto.find((m) => m.codigo === codigo);
    setUbicacion((prev) => ({
      ...prev,
      municipio_codigo: codigo,
      municipio_nombre: mun?.nombre ?? "",
    }));
  };

  const guardarTodo = async (conResolucion: boolean, conMuv: boolean) => {
    setGuardando(true);
    setError("");

    const resPerfil = await guardarPerfil({
      ...prestador,
      ...ubicacion,
      onboarding_completo: true,
    });

    if (!resPerfil.success) {
      setError(resPerfil.error ?? "Error al guardar perfil");
      setGuardando(false);
      return;
    }

    if (conResolucion && resolucion.numero_resolucion) {
      const resRes = await guardarResolucion({
        numero_resolucion: resolucion.numero_resolucion,
        fecha_resolucion: resolucion.fecha_resolucion,
        prefijo: resolucion.prefijo,
        rango_desde: parseInt(resolucion.rango_desde) || 0,
        rango_hasta: parseInt(resolucion.rango_hasta) || 0,
        fecha_vigencia_desde: resolucion.fecha_vigencia_desde,
        fecha_vigencia_hasta: resolucion.fecha_vigencia_hasta,
        clave_tecnica: null,
        activa: true,
      });
      if (!resRes.success) {
        setError(resRes.error ?? "Error al guardar resolución");
        setGuardando(false);
        return;
      }
    }

    if (conMuv && muvCreds.numero_identificacion && muvCreds.contrasena) {
      const resMuv = await guardarCredencialesMuv({
        ...muvCreds,
        nit_prestador: muvCreds.nit_prestador || prestador.numero_documento,
      });
      if (!resMuv.success) {
        setError(resMuv.error ?? "Error al guardar credenciales MUV");
        setGuardando(false);
        return;
      }
    }

    router.push("/dashboard");
  };

  const pasoValido = () => {
    if (paso === 1) {
      return (
        prestador.numero_documento.trim() !== "" &&
        prestador.razon_social.trim() !== ""
      );
    }
    if (paso === 2) {
      return ubicacion.email_facturacion.trim() !== "";
    }
    return true;
  };

  const inputClasses = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-medi-primary/30 focus:border-medi-primary outline-none transition-all";
  const labelClasses = "block text-sm font-medium text-medi-dark mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-medi-light/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="bg-medi-primary text-white p-3 rounded-xl shadow-lg">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-medi-deep">Medibill</h1>
          </div>
          <p className="text-medi-dark/70">Configure su perfil de prestador para comenzar a facturar</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((p) => (
            <React.Fragment key={p}>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  p === paso
                    ? "bg-medi-primary text-white shadow-md"
                    : p < paso
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {p < paso ? "✓" : p}
              </div>
              {p < 4 && (
                <div className={`w-12 h-1 rounded-full ${p < paso ? "bg-green-500" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* PASO 1: Datos del Prestador */}
          {paso === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-medi-deep mb-1">Datos del Prestador</h2>
              <p className="text-sm text-medi-dark/60 mb-4">Información básica de su consultorio o clínica</p>

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
                      onClick={() => setPrestador((p) => ({ ...p, tipo_prestador: val }))}
                      className={`px-3 py-2.5 text-sm rounded-lg border-2 font-medium transition-all ${
                        prestador.tipo_prestador === val
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
                    value={prestador.tipo_documento}
                    onChange={(e) => setPrestador((p) => ({ ...p, tipo_documento: e.target.value }))}
                    className={inputClasses}
                  >
                    <option value="NIT">NIT</option>
                    <option value="CC">CC</option>
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Número de documento *</label>
                  <input
                    type="text"
                    value={prestador.numero_documento}
                    onChange={(e) => setPrestador((p) => ({ ...p, numero_documento: e.target.value }))}
                    className={inputClasses}
                    placeholder="900.123.456"
                  />
                </div>
                {prestador.tipo_documento === "NIT" && (
                  <div>
                    <label className={labelClasses}>DV</label>
                    <input
                      type="text"
                      maxLength={1}
                      value={prestador.digito_verificacion}
                      onChange={(e) => setPrestador((p) => ({ ...p, digito_verificacion: e.target.value }))}
                      className={inputClasses}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Razón social *</label>
                  <input
                    type="text"
                    value={prestador.razon_social}
                    onChange={(e) => setPrestador((p) => ({ ...p, razon_social: e.target.value }))}
                    className={inputClasses}
                    placeholder="Consultorio Dr. Pérez"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Nombre comercial</label>
                  <input
                    type="text"
                    value={prestador.nombre_comercial}
                    onChange={(e) => setPrestador((p) => ({ ...p, nombre_comercial: e.target.value }))}
                    className={inputClasses}
                    placeholder="Centro Médico Pérez"
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Código de habilitación REPS</label>
                <input
                  type="text"
                  value={prestador.codigo_habilitacion}
                  onChange={(e) => setPrestador((p) => ({ ...p, codigo_habilitacion: e.target.value }))}
                  className={inputClasses}
                  placeholder="52001..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Especialidad principal</label>
                  <input
                    type="text"
                    value={prestador.especialidad_principal}
                    onChange={(e) => setPrestador((p) => ({ ...p, especialidad_principal: e.target.value }))}
                    className={inputClasses}
                    placeholder="Medicina general"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Registro médico (tarjeta profesional)</label>
                  <input
                    type="text"
                    value={prestador.registro_medico}
                    onChange={(e) => setPrestador((p) => ({ ...p, registro_medico: e.target.value }))}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Ubicación y Contacto */}
          {paso === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-medi-deep mb-1">Ubicación y Contacto</h2>
              <p className="text-sm text-medi-dark/60 mb-4">Datos de ubicación y contacto del prestador</p>

              <div>
                <label className={labelClasses}>Dirección</label>
                <input
                  type="text"
                  value={ubicacion.direccion}
                  onChange={(e) => setUbicacion((u) => ({ ...u, direccion: e.target.value }))}
                  className={inputClasses}
                  placeholder="Cra 10 # 20-30, Consultorio 201"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Departamento</label>
                  <select
                    value={ubicacion.departamento_codigo}
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
                    value={ubicacion.municipio_codigo}
                    onChange={(e) => handleMunicipioChange(e.target.value)}
                    className={inputClasses}
                    disabled={!ubicacion.departamento_codigo}
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
                    value={ubicacion.telefono}
                    onChange={(e) => setUbicacion((u) => ({ ...u, telefono: e.target.value }))}
                    className={inputClasses}
                    placeholder="(602) 123 4567"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Email de facturación *</label>
                  <input
                    type="email"
                    value={ubicacion.email_facturacion}
                    onChange={(e) => setUbicacion((u) => ({ ...u, email_facturacion: e.target.value }))}
                    className={inputClasses}
                    placeholder="facturacion@consultorio.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Responsable de IVA</label>
                  <div className="flex gap-4 mt-2">
                    {[
                      [true, "Sí"],
                      [false, "No"],
                    ].map(([val, label]) => (
                      <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={ubicacion.responsable_iva === val}
                          onChange={() => setUbicacion((u) => ({ ...u, responsable_iva: val as boolean }))}
                          className="text-medi-primary"
                        />
                        <span className="text-sm text-medi-dark">{label as string}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClasses}>Régimen fiscal</label>
                  <select
                    value={ubicacion.regimen_fiscal}
                    onChange={(e) => setUbicacion((u) => ({ ...u, regimen_fiscal: e.target.value as RegimenFiscal }))}
                    className={inputClasses}
                  >
                    <option value="simplificado">Simplificado</option>
                    <option value="comun">Común</option>
                    <option value="no_responsable">No responsable</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Resolución DIAN */}
          {paso === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-medi-deep mb-1">Resolución de Facturación DIAN</h2>
              <p className="text-sm text-medi-dark/60 mb-4">Datos de su resolución de facturación electrónica</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">ℹ️ Información</p>
                <p>Esta es la resolución que la DIAN le autorizó para facturar electrónicamente. Si aún no la tiene, puede dejar este paso para después, pero no podrá generar facturas con numeración oficial.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Número de resolución</label>
                  <input
                    type="text"
                    value={resolucion.numero_resolucion}
                    onChange={(e) => setResolucion((r) => ({ ...r, numero_resolucion: e.target.value }))}
                    className={inputClasses}
                    placeholder="18764012345678"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Fecha de resolución</label>
                  <input
                    type="date"
                    value={resolucion.fecha_resolucion}
                    onChange={(e) => setResolucion((r) => ({ ...r, fecha_resolucion: e.target.value }))}
                    className={inputClasses}
                    min="2000-01-01"
                    max="2099-12-31"
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Prefijo</label>
                <input
                  type="text"
                  value={resolucion.prefijo}
                  onChange={(e) => setResolucion((r) => ({ ...r, prefijo: e.target.value.toUpperCase() }))}
                  className={inputClasses}
                  placeholder="FEV"
                  maxLength={10}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Rango desde</label>
                  <input
                    type="number"
                    value={resolucion.rango_desde}
                    onChange={(e) => setResolucion((r) => ({ ...r, rango_desde: e.target.value }))}
                    className={inputClasses}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Rango hasta</label>
                  <input
                    type="number"
                    value={resolucion.rango_hasta}
                    onChange={(e) => setResolucion((r) => ({ ...r, rango_hasta: e.target.value }))}
                    className={inputClasses}
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Vigencia desde</label>
                  <input
                    type="date"
                    value={resolucion.fecha_vigencia_desde}
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
                    value={resolucion.fecha_vigencia_hasta}
                    onChange={(e) => setResolucion((r) => ({ ...r, fecha_vigencia_hasta: e.target.value }))}
                    className={inputClasses}
                    min="2000-01-01"
                    max="2099-12-31"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: Credenciales MUV (MinSalud) */}
          {paso === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-medi-deep mb-1">Credenciales MUV — MinSalud</h2>
              <p className="text-sm text-medi-dark/60 mb-4">Credenciales del portal MUV para validar RIPS ante el Ministerio de Salud</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">ℹ️ Información</p>
                <p>Estas son las credenciales que usa para ingresar al portal MUV del MinSalud. Se almacenan encriptadas y son necesarias para la validación automática de RIPS. Si aún no las tiene, puede configurarlas después.</p>
              </div>

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
                  <label className={labelClasses}>Contraseña MUV</label>
                  <input
                    type="password"
                    value={muvCreds.contrasena}
                    onChange={(e) => setMuvCreds((c) => ({ ...c, contrasena: e.target.value }))}
                    className={inputClasses}
                    placeholder="••••••••"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>NIT del prestador</label>
                <input
                  type="text"
                  value={muvCreds.nit_prestador || prestador.numero_documento}
                  onChange={(e) => setMuvCreds((c) => ({ ...c, nit_prestador: e.target.value }))}
                  className={inputClasses}
                  placeholder="900123456"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="mt-8 flex items-center justify-between">
            {paso > 1 ? (
              <button
                type="button"
                onClick={() => setPaso((p) => (p - 1) as Paso)}
                className="px-5 py-2.5 text-sm font-medium text-medi-dark border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                ← Anterior
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              {paso === 3 && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => guardarTodo(false, false)}
                  className="px-5 py-2.5 text-sm font-medium text-medi-dark border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Completar después
                </button>
              )}
              {paso === 4 && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => guardarTodo(true, false)}
                  className="px-5 py-2.5 text-sm font-medium text-medi-dark border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Omitir MUV
                </button>
              )}
              {paso < 4 ? (
                <button
                  type="button"
                  disabled={!pasoValido()}
                  onClick={() => setPaso((p) => (p + 1) as Paso)}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => guardarTodo(true, true)}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md transition-all disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Completar configuración ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
