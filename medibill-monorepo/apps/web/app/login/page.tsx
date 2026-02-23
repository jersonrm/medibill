import React from "react";
import { iniciarSesion, registrarCuenta } from "./actions";


export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mensaje: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 text-white p-3 rounded-xl shadow-sm">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          Acceso Clínico
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Medibill | Auditoría Inteligente RIPS
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-slate-200">
          <form className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-colors"
                  placeholder="dr@hospital.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Mensaje de error si las credenciales fallan */}
            {params?.mensaje && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg border border-red-100">
                {params.mensaje}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                formAction={iniciarSesion}
                className="flex w-full justify-center rounded-lg border border-transparent bg-blue-600 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Ingresar
              </button>
              <button
                formAction={registrarCuenta}
                className="flex w-full justify-center rounded-lg border border-slate-300 bg-white py-2.5 px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Registrarme
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}