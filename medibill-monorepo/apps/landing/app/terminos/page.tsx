import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description:
    "Términos y condiciones de uso de la plataforma Medibill para facturación médica electrónica en Colombia.",
};

export default function TerminosPage() {
  return (
    <section className="pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-bold tracking-tight text-medi-deep md:text-4xl">
          Términos de Servicio
        </h1>
        <p className="mt-4 text-sm text-gray-500">
          Última actualización: 1 de marzo de 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder y utilizar la plataforma Medibill (en adelante, &quot;el
              Servicio&quot;), usted acepta estar vinculado por estos Términos de
              Servicio. Si no está de acuerdo con alguna parte de estos términos,
              no podrá acceder al Servicio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              2. Descripción del Servicio
            </h2>
            <p>
              Medibill es una plataforma de facturación médica electrónica que
              utiliza inteligencia artificial para la clasificación de códigos
              CUPS y CIE-10, generación de archivos RIPS conforme a la
              Resolución 2275 de 2023, gestión de glosas según la Resolución
              2284 de 2023, y administración de cartera y pagos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              3. Registro y Cuentas
            </h2>
            <p>
              Para utilizar el Servicio, usted debe crear una cuenta
              proporcionando información veraz, completa y actualizada. Usted es
              responsable de mantener la confidencialidad de sus credenciales de
              acceso y de todas las actividades que ocurran bajo su cuenta.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              4. Planes y Facturación
            </h2>
            <p>
              Medibill ofrece diferentes planes de suscripción con distintos
              niveles de funcionalidad y límites de uso. Los precios están
              expresados en Pesos Colombianos (COP) e incluyen IVA. Los pagos se
              procesan de forma recurrente a través de Wompi. Usted puede
              cancelar su suscripción en cualquier momento y mantendrá el acceso
              hasta el final del período de facturación vigente.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              5. Naturaleza del Servicio
            </h2>
            <p>
              Medibill es una plataforma de facturación y gestión administrativa.
              No constituye un sistema de historia clínica electrónica (HCE) ni
              almacena historia clínica de pacientes. Las notas clínicas que
              usted ingrese son procesadas de forma transitoria para la
              clasificación de códigos y generación de facturas, y no se
              conservan como registros clínicos.
            </p>
            <p className="mt-2">
              La transmisión de facturas electrónicas a la DIAN es realizada por
              el Proveedor Tecnológico habilitado (Matias / Dataico). Medibill
              actúa como intermediario tecnológico y no asume la condición de
              Proveedor Tecnológico ante la DIAN.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              6. Uso Aceptable
            </h2>
            <p>
              Usted se compromete a utilizar el Servicio únicamente para fines
              legales y de conformidad con estos Términos. No podrá utilizar el
              Servicio para actividades ilícitas, transmitir contenido malicioso,
              intentar acceder a datos de otros usuarios, o realizar ingeniería
              inversa del software.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              7. Eliminación de Cuenta
            </h2>
            <p>
              Usted puede solicitar la eliminación de su cuenta desde la
              configuración de perfil. Una vez solicitada, contará con un período
              de gracia de 7 días calendario durante el cual podrá cancelar la
              solicitud. Transcurrido ese plazo, todos sus datos serán eliminados
              de forma permanente e irrecuperable, incluyendo perfil,
              membresías, facturas y registros de uso.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              8. Propiedad Intelectual
            </h2>
            <p>
              El Servicio, incluyendo su código fuente, diseño, logotipos y
              contenido, es propiedad de Medibill y está protegido por las leyes
              de propiedad intelectual de Colombia y tratados internacionales.
              Los datos que usted ingrese en la plataforma siguen siendo de su
              propiedad.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              9. Limitación de Responsabilidad
            </h2>
            <p>
              Medibill proporciona herramientas de asistencia para la
              facturación médica. Las clasificaciones generadas por inteligencia
              artificial son sugerencias que deben ser revisadas y aprobadas por
              un profesional de salud calificado. Medibill no se responsabiliza
              por errores en la codificación que no hayan sido verificados por el
              usuario antes de su radicación.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              10. Modificaciones
            </h2>
            <p>
              Nos reservamos el derecho de modificar estos Términos en cualquier
              momento. Las modificaciones entrarán en vigor al ser publicadas en
              esta página. El uso continuado del Servicio después de la
              publicación de cambios constituye su aceptación de los nuevos
              Términos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              11. Contacto
            </h2>
            <p>
              Si tiene preguntas sobre estos Términos de Servicio, puede
              contactarnos en{" "}
              <a
                href="mailto:soporte@medibill.co"
                className="text-medi-primary hover:underline"
              >
                soporte@medibill.co
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
