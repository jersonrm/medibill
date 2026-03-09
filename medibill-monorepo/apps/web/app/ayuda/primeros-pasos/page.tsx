export default function PrimerosPasosPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">🚀 Primeros Pasos</h2>
      <p className="mt-2 text-gray-600">
        Bienvenido a Medibill. Esta guía te ayudará a configurar tu cuenta y
        comenzar a facturar en minutos.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        {/* Paso 1 */}
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            1. Registro y confirmación de email
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Al ingresar por primera vez, crea tu cuenta con un email y
              contraseña. Recibirás un correo de confirmación — haz clic en el
              enlace para activar tu cuenta.
            </p>
            <div className="mt-3 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Si no recibes el email de confirmación,
                revisa tu carpeta de spam o correo no deseado. El remitente es{" "}
                <code className="rounded bg-blue-100 px-1">noreply@medibill.co</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Paso 2 */}
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            2. Onboarding: Configura tu perfil profesional
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Después de confirmar tu email, serás redirigido al proceso de
              onboarding de 3 pasos:
            </p>
            <ol className="mt-3 list-inside space-y-3">
              <li>
                <strong>Paso 1 — Perfil:</strong> Ingresa tu nombre, tipo
                de documento, número de identificación, NIT y razón social.
                Esta información se usará en tus facturas.
              </li>
              <li>
                <strong>Paso 2 — Ubicación:</strong> Selecciona tu
                departamento y municipio (código DIVIPOLA). Es necesario para
                los registros RIPS.
              </li>
              <li>
                <strong>Paso 3 — Resolución de facturación:</strong> Ingresa
                el número de resolución DIAN, el prefijo, y el rango de
                numeración autorizada (desde-hasta). Si aún no tienes
                resolución, puedes omitir este paso y configurarlo después en{" "}
                <strong>Configuración {">"} Perfil</strong>.
              </li>
            </ol>
          </div>
        </div>

        {/* Paso 3 */}
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            3. Navegación principal
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Una vez completado el onboarding, llegarás al Dashboard. La
              navegación se organiza en la barra lateral izquierda:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Dashboard:</strong> Vista general con KPIs de facturación,
                distribución por EPS y alertas.
              </li>
              <li>
                <strong>Nueva Factura:</strong> El flujo principal — pega una nota
                clínica, clasifica con IA y genera la factura.
              </li>
              <li>
                <strong>Facturas:</strong> Lista de todas tus facturas con filtros
                por estado (borrador, aprobada, radicada, etc.).
              </li>
              <li>
                <strong>Pacientes:</strong> Gestión de la base de datos de
                pacientes.
              </li>
              <li>
                <strong>Glosas:</strong> Glosas recibidas de EPS con plazos y
                estado de respuesta.
              </li>
              <li>
                <strong>Cartera:</strong> Seguimiento de pagos pendientes e
                importación de sábanas de pago.
              </li>
              <li>
                <strong>Configuración:</strong> Perfil, acuerdos, tarifas,
                suscripción y gestión de equipo.
              </li>
            </ul>
          </div>
        </div>

        {/* Paso 4 */}
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            4. Tu primera factura
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>Para crear tu primera factura:</p>
            <ol className="mt-3 list-inside space-y-2">
              <li>
                <strong>1.</strong> Haz clic en <strong>Nueva Factura</strong>{" "}
                en la barra lateral.
              </li>
              <li>
                <strong>2.</strong> Selecciona o crea un paciente.
              </li>
              <li>
                <strong>3.</strong> Pega la nota clínica en el campo de texto.
              </li>
              <li>
                <strong>4.</strong> Haz clic en <strong>Clasificar</strong>{" "}
                — la IA generará diagnósticos y procedimientos automáticamente.
              </li>
              <li>
                <strong>5.</strong> Revisa los resultados, ajusta si es
                necesario y haz clic en <strong>Guardar Factura</strong>.
              </li>
            </ol>
            <div className="mt-3 rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Importante:</strong> La factura se guarda como borrador.
                Revísala con cuidado antes de aprobarla, ya que una vez aprobada
                no podrás modificar los códigos ni los datos del paciente.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
