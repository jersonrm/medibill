import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de privacidad y protección de datos personales de Medibill, conforme a la Ley 1581 de 2012 de Colombia.",
};

export default function PrivacidadPage() {
  return (
    <section className="pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-bold tracking-tight text-medi-deep md:text-4xl">
          Política de Privacidad
        </h1>
        <p className="mt-4 text-sm text-gray-500">
          Última actualización: 1 de marzo de 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              1. Responsable del Tratamiento
            </h2>
            <p>
              Medibill, con domicilio en Pasto, Nariño, Colombia, es responsable
              del tratamiento de los datos personales recopilados a través de la
              plataforma, de conformidad con la Ley 1581 de 2012 y el Decreto
              1377 de 2013.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              2. Datos que Recopilamos
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong>Datos de registro:</strong> nombre, correo electrónico,
                NIT o cédula, nombre de la organización.
              </li>
              <li>
                <strong>Datos de facturación:</strong> información de planes y
                métodos de pago procesados a través de Wompi. No almacenamos
                números completos de tarjetas de crédito.
              </li>
              <li>
                <strong>Datos clínicos:</strong> notas clínicas, diagnósticos y
                procedimientos ingresados para la clasificación y facturación.
                Estos datos se procesan con aislamiento multi-tenant y se
                anonimizan antes de ser procesados por modelos de IA.
              </li>
              <li>
                <strong>Datos de uso:</strong> información técnica sobre el uso
                de la plataforma para mejorar el servicio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              3. Finalidad del Tratamiento
            </h2>
            <p>
              Los datos personales son utilizados para: prestación del servicio
              de facturación médica, clasificación de códigos RIPS con IA,
              generación de archivos FEV-RIPS, gestión de glosas, procesamiento
              de pagos, comunicaciones relacionadas con el servicio y
              cumplimiento de obligaciones legales.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              4. Seguridad de los Datos
            </h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para
              proteger sus datos, incluyendo:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>Cifrado en tránsito (HTTPS con HSTS)</li>
              <li>Aislamiento multi-tenant en la base de datos</li>
              <li>
                Anonimización de datos clínicos antes del procesamiento con IA
              </li>
              <li>
                Headers de seguridad (CSP, X-Frame-Options, X-Content-Type-Options)
              </li>
              <li>Infraestructura alojada en Supabase con PostgreSQL gestionado</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              5. Derechos del Titular
            </h2>
            <p>
              De acuerdo con la Ley 1581 de 2012, usted tiene derecho a conocer,
              actualizar, rectificar y suprimir sus datos personales, así como a
              revocar la autorización otorgada. Para ejercer estos derechos,
              puede contactarnos en{" "}
              <a
                href="mailto:soporte@medibill.co"
                className="text-medi-primary hover:underline"
              >
                soporte@medibill.co
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              6. Transferencia de Datos
            </h2>
            <p>
              Sus datos pueden ser procesados por proveedores de servicios
              tecnológicos (Supabase, Wompi, proveedores de IA) que cumplen con
              estándares de seguridad equivalentes. No vendemos ni compartimos
              sus datos personales con terceros para fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              7. Retención de Datos
            </h2>
            <p>
              Los datos personales se conservan durante el período necesario para
              cumplir con las finalidades descritas y las obligaciones legales
              aplicables. Al solicitar la eliminación de su cuenta, sus datos
              serán eliminados transcurridos 7 días calendario (período de
              gracia), salvo aquellos requeridos por disposiciones legales.
              Las notas clínicas ingresadas para clasificación son procesadas de
              forma transitoria y no se almacenan como historia clínica.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              8. Modificaciones
            </h2>
            <p>
              Nos reservamos el derecho de modificar esta Política de Privacidad.
              Las modificaciones serán notificadas a través de la plataforma o
              por correo electrónico. El uso continuado del servicio después de
              la notificación constituye su aceptación.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              9. Contacto
            </h2>
            <p>
              Para consultas relacionadas con la protección de sus datos
              personales, puede contactarnos en{" "}
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
