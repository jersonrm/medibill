import { solicitarRecuperacion } from "./actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-medi-light">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-medi-soft">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-medi-deep text-white p-3 rounded-xl shadow-lg mb-4">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-medi-deep">Recuperar Contraseña</h1>
          <p className="text-sm text-medi-muted mt-2 text-center">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>

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

          <button
            formAction={solicitarRecuperacion}
            className="w-full bg-medi-deep hover:bg-medi-dark text-white font-black text-lg py-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            Enviar enlace de recuperación
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-medi-dark/60 hover:text-medi-deep transition-colors"
          >
            ← Volver al inicio de sesión
          </a>
        </div>

      </div>
    </div>
  );
}
