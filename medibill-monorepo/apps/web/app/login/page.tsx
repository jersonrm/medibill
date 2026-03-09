import { iniciarSesion, registrarCuenta } from './actions'

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "https://medibill.co";

/** Mensajes permitidos — evita XSS reflejado vía query params */
const MENSAJES_PERMITIDOS: Record<string, string> = {
  email_no_confirmado: "Debes confirmar tu correo electrónico antes de acceder. Revisa tu bandeja de entrada.",
  registro_ok: "Registro exitoso. Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.",
  sesion_expirada: "Tu sesión ha expirado. Inicia sesión nuevamente.",
  error_credenciales: "Correo electrónico o contraseña incorrectos.",
  cuenta_no_encontrada: "No se encontró una cuenta con ese correo electrónico.",
  consentimiento_requerido: "Debes aceptar los Términos y la Política de Privacidad para registrarte.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mensaje?: string }>
}) {
  const { mensaje } = await searchParams
  const mensajeSeguro = mensaje ? MENSAJES_PERMITIDOS[mensaje] ?? null : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-medi-light">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-medi-soft">
        
        {/* Header del Login */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-medi-deep text-white p-3 rounded-xl shadow-lg mb-4">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-medi-deep">Medibill</h1>
          <p className="text-sm font-bold text-medi-muted uppercase tracking-widest mt-1">Acceso a Profesionales</p>
        </div>

        {/* Mensaje informativo */}
        {mensajeSeguro && (
          <div className="mb-5 p-4 bg-medi-light/50 border border-medi-soft rounded-xl text-sm text-medi-dark text-center font-medium">
            {mensajeSeguro}
          </div>
        )}

        {/* Formulario */}
        <form className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-bold text-medi-dark uppercase ml-1">
              Correo Electrónico
            </label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              placeholder="doctor@clinica.com"
              className="p-4 bg-medi-light/30 border-2 border-medi-soft rounded-xl outline-none focus:border-medi-deep transition-all text-medi-deep font-medium"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-xs font-bold text-medi-dark uppercase ml-1">
              Contraseña
            </label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              placeholder="••••••••"
              className="p-4 bg-medi-light/30 border-2 border-medi-soft rounded-xl outline-none focus:border-medi-deep transition-all text-medi-deep font-medium"
            />
          </div>

          <div className="flex flex-col gap-3 mt-4">
            {/* Consentimiento — visible solo al registrar, validado server-side */}
            <label className="flex items-start gap-2 text-xs text-medi-dark/70">
              <input type="checkbox" name="consentimiento" value="1" className="mt-0.5 accent-medi-deep" />
              <span>
                Al registrarme acepto los{" "}
                <a href={`${LANDING_URL}/terminos`} target="_blank" rel="noopener noreferrer" className="underline text-medi-deep">
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a href={`${LANDING_URL}/privacidad`} target="_blank" rel="noopener noreferrer" className="underline text-medi-deep">
                  Política de Privacidad
                </a>.
              </span>
            </label>

            <button 
              formAction={iniciarSesion} 
              className="w-full bg-medi-deep hover:bg-medi-dark text-white font-black text-lg py-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Iniciar Sesión
            </button>
            <button 
              formAction={registrarCuenta} 
              className="w-full bg-white hover:bg-medi-light text-medi-deep border-2 border-medi-soft font-bold text-lg py-4 rounded-xl transition-all active:scale-[0.98]"
            >
              Registrar Consultorio
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <a
            href={LANDING_URL}
            className="text-sm text-medi-dark/60 hover:text-medi-deep transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>

      </div>
    </div>
  )
}