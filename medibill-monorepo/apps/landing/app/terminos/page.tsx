import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones de Servicio — Medibill",
  description:
    "Términos y condiciones de uso de la plataforma Medibill para facturación médica electrónica en Colombia. Incluye condiciones del período de prueba gratuito, planes, limitaciones de responsabilidad y más.",
};

export default function TerminosPage() {
  return (
    <section className="pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-bold tracking-tight text-medi-deep md:text-4xl">
          Términos y Condiciones de Servicio
        </h1>
        <p className="mt-4 text-sm text-gray-500">
          Última actualización: 11 de marzo de 2026
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-gray-700">
          {/* ── 1 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder, registrarse o utilizar de cualquier forma la plataforma
              Medibill (en adelante, &quot;el Servicio&quot;), operada por Medibill
              S.A.S. (en adelante, &quot;Medibill&quot;, &quot;nosotros&quot; o
              &quot;la Empresa&quot;), con domicilio en Pasto, Nariño, Colombia,
              usted (en adelante, &quot;el Usuario&quot;) declara que ha leído,
              comprendido y aceptado en su totalidad estos Términos y Condiciones
              de Servicio (en adelante, &quot;los Términos&quot;), los cuales
              constituyen un contrato legalmente vinculante entre usted y
              Medibill conforme a la legislación colombiana aplicable, incluyendo
              el Código de Comercio, el Estatuto del Consumidor (Ley 1480 de
              2011) y la Ley 527 de 1999 sobre comercio electrónico.
            </p>
            <p className="mt-2">
              Si usted no está de acuerdo con alguna parte de estos Términos, no
              deberá acceder ni utilizar el Servicio. El simple acceso o uso del
              Servicio implica la aceptación plena e incondicional de estos
              Términos.
            </p>
            <p className="mt-2">
              Si usted actúa en nombre de una persona jurídica (empresa,
              clínica, IPS u otra organización), declara que tiene la autoridad
              legal para vincular a dicha entidad a estos Términos. En tal caso,
              &quot;usted&quot; se referirá tanto a la persona natural como a la
              entidad representada.
            </p>
          </section>

          {/* ── 2 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              2. Descripción del Servicio
            </h2>
            <p>
              Medibill es una plataforma de Software como Servicio (SaaS) de
              facturación médica electrónica que utiliza inteligencia artificial
              para:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>Clasificación asistida de códigos CUPS y CIE-10.</li>
              <li>
                Generación de archivos RIPS conforme a la Resolución 2275 de
                2023 del Ministerio de Salud.
              </li>
              <li>
                Creación y transmisión de facturas electrónicas de venta en
                salud (FEV) a través de proveedores tecnológicos habilitados
                ante la DIAN.
              </li>
              <li>
                Gestión de glosas según la Resolución 2284 de 2023.
              </li>
              <li>
                Administración de cartera, conciliación de pagos e importación
                de sábana de pagos.
              </li>
              <li>
                Validación pre-radicación de facturas.
              </li>
              <li>
                Bot de dictado por audio vía Telegram (disponible en planes
                compatibles).
              </li>
            </ul>
            <p className="mt-2">
              Medibill se reserva el derecho de añadir, modificar, suspender o
              descontinuar cualquier funcionalidad del Servicio en cualquier
              momento, con o sin previo aviso.
            </p>
          </section>

          {/* ── 3 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              3. Registro y Cuentas de Usuario
            </h2>
            <p>
              Para utilizar el Servicio, usted debe crear una cuenta
              proporcionando información veraz, completa, exacta y actualizada,
              incluyendo pero no limitándose a: nombre completo, correo
              electrónico, NIT o número de cédula, y nombre de la organización
              (si aplica).
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                <strong>Responsabilidad sobre credenciales:</strong> Usted es el
                único responsable de mantener la confidencialidad de sus
                credenciales de acceso (correo electrónico y contraseña) y de
                todas las actividades que ocurran bajo su cuenta. Debe
                notificarnos inmediatamente cualquier uso no autorizado.
              </li>
              <li>
                <strong>Una cuenta por persona:</strong> Cada cuenta es personal
                e intransferible. No podrá compartir, ceder ni permitir que
                terceros utilicen su cuenta.
              </li>
              <li>
                <strong>Edad mínima:</strong> Usted declara tener al menos 18
                años de edad o la mayoría de edad legal en su jurisdicción.
              </li>
              <li>
                <strong>Veracidad de la información:</strong> La provisión de
                información falsa, inexacta o incompleta constituye un
                incumplimiento de estos Términos y podrá dar lugar a la
                suspensión o terminación inmediata de su cuenta.
              </li>
            </ul>
          </section>

          {/* ── 4 ── */}
          <section id="prueba-gratuita">
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              4. Período de Prueba Gratuita
            </h2>
            <p>
              Medibill ofrece un período de prueba gratuita (&quot;Prueba
              Gratuita&quot; o &quot;Trial&quot;) sujeto a las siguientes
              condiciones específicas:
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              4.1. Duración y Activación
            </h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                La Prueba Gratuita tiene una duración de <strong>14 días
                calendario</strong> contados a partir de la fecha de creación de
                la cuenta.
              </li>
              <li>
                No se requiere tarjeta de crédito ni método de pago para
                activar la Prueba Gratuita.
              </li>
              <li>
                La Prueba Gratuita se activa automáticamente al registrarse con
                éxito en la plataforma y completar el proceso de onboarding.
              </li>
              <li>
                Cada persona natural o jurídica tiene derecho a{" "}
                <strong>una única Prueba Gratuita</strong>. Medibill se reserva
                el derecho de denegar pruebas gratuitas adicionales a usuarios
                que intenten registrarse con datos diferentes para evadir esta
                restricción.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              4.2. Límites y Restricciones del Período de Prueba
            </h3>
            <p>
              Durante la Prueba Gratuita, el uso del Servicio está sujeto a los
              siguientes límites:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                <strong>Clasificaciones con IA:</strong> Máximo de 10
                clasificaciones durante todo el período de prueba (no es un
                límite mensual, sino acumulativo).
              </li>
              <li>
                <strong>Resultados completos:</strong> Solo las primeras 3
                clasificaciones mostrarán los resultados completos con todos
                los códigos sugeridos. Las clasificaciones restantes mostrarán
                resultados parciales a modo de demostración.
              </li>
              <li>
                <strong>Facturas electrónicas ante la DIAN:</strong> La
                generación y transmisión de facturas electrónicas a la DIAN{" "}
                <strong>no está disponible</strong> durante la Prueba Gratuita.
                Esta funcionalidad requiere un plan de pago activo.
              </li>
              <li>
                <strong>Funcionalidades limitadas:</strong> Algunas
                funcionalidades avanzadas como gestión de glosas con IA,
                importación de sábana de pagos, importación masiva de facturas,
                bot de Telegram y gestión de equipos no están disponibles
                durante la Prueba Gratuita.
              </li>
              <li>
                <strong>Usuarios:</strong> La Prueba Gratuita permite un máximo
                de 1 usuario por organización.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              4.3. Finalización del Período de Prueba
            </h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Al expirar los 14 días de la Prueba Gratuita, su acceso al
                Servicio será restringido automáticamente. No podrá crear nuevas
                clasificaciones, generar facturas ni acceder a las
                funcionalidades operativas del Servicio.
              </li>
              <li>
                Los datos ingresados durante la Prueba Gratuita{" "}
                <strong>se conservarán</strong> durante un período razonable
                para que pueda contratar un plan de pago y continuar desde donde
                lo dejó.
              </li>
              <li>
                Si no contrata un plan de pago, Medibill se reserva el derecho
                de eliminar los datos de cuentas inactivas después de{" "}
                <strong>90 días calendario</strong> posteriores a la
                finalización de la Prueba Gratuita.
              </li>
              <li>
                <strong>No hay cobro automático al finalizar la Prueba
                Gratuita.</strong> La transición a un plan de pago requiere una
                acción explícita del Usuario a través del panel de suscripción.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              4.4. Naturaleza de la Prueba Gratuita
            </h3>
            <p>
              La Prueba Gratuita se ofrece &quot;como está&quot; (&quot;as
              is&quot;) con el único propósito de evaluar la plataforma.
              Medibill no garantiza que las funcionalidades disponibles durante
              la Prueba Gratuita sean idénticas a las de los planes de pago. La
              Prueba Gratuita no genera ninguna obligación contractual de
              contratación futura ni constituye una oferta irrevocable en los
              términos del artículo 845 del Código de Comercio colombiano.
              Medibill podrá modificar, suspender o eliminar la Prueba Gratuita
              en cualquier momento sin previo aviso.
            </p>
          </section>

          {/* ── 5 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              5. Planes de Suscripción y Facturación
            </h2>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              5.1. Planes Disponibles
            </h3>
            <p>
              Medibill ofrece diferentes planes de suscripción (Starter,
              Profesional y Clínica) con distintos niveles de
              funcionalidad, límites de uso y precios. Los detalles actualizados
              de cada plan, incluyendo precios, límites y funcionalidades, se
              encuentran disponibles en la página de precios de la plataforma.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              5.2. Precios
            </h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Todos los precios están expresados en Pesos Colombianos (COP) e
                incluyen el Impuesto al Valor Agregado (IVA).
              </li>
              <li>
                Medibill se reserva el derecho de modificar los precios de los
                planes en cualquier momento. Cualquier cambio de precio se
                comunicará con al menos <strong>30 días de anticipación</strong>{" "}
                y se aplicará al siguiente período de facturación. El uso
                continuado del Servicio después de la entrada en vigor de los
                nuevos precios constituye su aceptación.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              5.3. Pagos y Procesamiento
            </h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Los pagos se procesan de forma recurrente (mensual o anual,
                según el período seleccionado) a través de Wompi, un proveedor
                de pagos regulado por la Superintendencia Financiera de
                Colombia. Medibill no almacena números completos de tarjetas de
                crédito ni información financiera sensible.
              </li>
              <li>
                Usted autoriza a Medibill (a través de Wompi) a realizar los
                cargos recurrentes correspondientes a su plan de suscripción
                hasta que usted cancele expresamente.
              </li>
              <li>
                En caso de que un pago sea rechazado o fallido, Medibill podrá
                intentar procesar el pago nuevamente. Si el pago no puede ser
                procesado, su suscripción podrá ser suspendida temporalmente
                (estado &quot;past_due&quot;) o cancelada.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              5.4. Cancelación y Reembolsos
            </h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Usted puede cancelar su suscripción en cualquier momento desde
                el panel de configuración. Al cancelar, mantendrá el acceso
                hasta el final del período de facturación vigente.
              </li>
              <li>
                <strong>No se realizan reembolsos</strong> por períodos parciales
                no utilizados, salvo en los casos expresamente exigidos por la
                legislación colombiana de protección al consumidor (Ley 1480 de
                2011).
              </li>
              <li>
                El derecho de retracto previsto en el artículo 47 de la Ley
                1480 de 2011 será aplicable cuando corresponda conforme a la
                normativa vigente.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              5.5. Cambio de Plan
            </h3>
            <p>
              Usted puede cambiar de plan en cualquier momento. El cambio a un
              plan superior (upgrade) se aplicará de forma inmediata y se
              prorrateará el cobro. El cambio a un plan inferior (downgrade) se
              aplicará al inicio del siguiente período de facturación. Al
              realizar un downgrade, las funcionalidades no incluidas en el nuevo
              plan dejarán de estar disponibles.
            </p>
          </section>

          {/* ── 6 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              6. Naturaleza del Servicio y Exclusiones
            </h2>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              6.1. No es Historia Clínica Electrónica
            </h3>
            <p>
              Medibill es <strong>exclusivamente</strong> una plataforma de
              facturación y gestión administrativa. <strong>No constituye</strong>{" "}
              un sistema de historia clínica electrónica (HCE) ni un sistema de
              gestión de información clínica en los términos de la Resolución
              3374 de 2000 o la normativa que la modifique o sustituya. Las
              notas clínicas que usted ingrese son procesadas de forma
              transitoria y automatizada para la clasificación de códigos y
              generación de facturas, y{" "}
              <strong>no se conservan como registros clínicos</strong>.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              6.2. Intermediario Tecnológico — No Proveedor DIAN
            </h3>
            <p>
              La transmisión de facturas electrónicas de venta en salud (FEV) a
              la DIAN es realizada por el Proveedor Tecnológico habilitado.
              Medibill actúa exclusivamente como <strong>intermediario
              tecnológico</strong> que facilita la integración entre el usuario y
              el Proveedor Tecnológico. Medibill{" "}
              <strong>no asume la condición de Proveedor Tecnológico</strong>{" "}
              ante la DIAN en los términos de la Resolución 000042 de 2020 ni
              garantiza la aceptación o validación de las facturas por parte de
              la DIAN.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              6.3. No Asesoría Profesional
            </h3>
            <p>
              El Servicio no constituye asesoría jurídica, contable, tributaria
              ni médica. Las sugerencias, clasificaciones y resultados
              generados por la plataforma son de naturaleza informativa y
              asistencial. Usted es el único responsable de verificar, validar
              y aprobar toda la información generada antes de su uso, radicación
              o transmisión ante cualquier entidad.
            </p>
          </section>

          {/* ── 7 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              7. Uso de Inteligencia Artificial — Descargo de Responsabilidad
            </h2>
            <p>
              Medibill utiliza modelos de inteligencia artificial (IA) de
              terceros para asistir en la clasificación de códigos CUPS, CIE-10
              y la gestión de glosas. Al utilizar estas funcionalidades, usted
              reconoce y acepta lo siguiente:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                Las clasificaciones y sugerencias generadas por IA son{" "}
                <strong>aproximaciones probabilísticas</strong> basadas en
                modelos estadísticos. No son determinísticas ni infalibles.
              </li>
              <li>
                Toda clasificación generada por IA{" "}
                <strong>
                  debe ser revisada, verificada y aprobada por un profesional
                  de salud calificado
                </strong>{" "}
                antes de su uso en facturación, radicación o cualquier trámite
                ante entidades de salud o la DIAN.
              </li>
              <li>
                Medibill <strong>no garantiza</strong> la exactitud, completitud
                ni idoneidad de las clasificaciones generadas por IA para ningún
                propósito específico.
              </li>
              <li>
                Medibill <strong>no se responsabiliza</strong> por errores,
                glosas, rechazos, sanciones, multas o cualquier perjuicio que
                resulte de la utilización de clasificaciones de IA que no hayan
                sido debidamente revisadas por el Usuario.
              </li>
              <li>
                Los datos clínicos ingresados para clasificación por IA son{" "}
                <strong>anonimizados</strong> antes de ser procesados por los
                modelos de IA. Sin embargo, usted es responsable de no incluir
                información de identificación directa del paciente que no sea
                estrictamente necesaria para la clasificación.
              </li>
              <li>
                Los proveedores de los modelos de IA pueden cambiar sin previo
                aviso, siempre manteniendo estándares equivalentes o superiores
                de precisión y seguridad.
              </li>
            </ul>
          </section>

          {/* ── 8 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              8. Uso Aceptable
            </h2>
            <p>
              Usted se compromete a utilizar el Servicio únicamente para fines
              legales, legítimos y de conformidad con estos Términos y la
              legislación colombiana aplicable. Queda expresamente prohibido:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                Utilizar el Servicio para actividades ilícitas, fraudulentas o
                que violen la legislación colombiana o internacional.
              </li>
              <li>
                Generar facturas ficticias, infladas o que no correspondan a
                servicios de salud efectivamente prestados.
              </li>
              <li>
                Utilizar la plataforma para evadir impuestos, cometer fraude
                al sistema de salud o presentar información falsa ante la DIAN,
                EPS, IPS u otras entidades.
              </li>
              <li>
                Transmitir virus, malware, código malicioso o cualquier contenido
                que pueda dañar, deshabilitar o comprometer el Servicio o la
                infraestructura de terceros.
              </li>
              <li>
                Intentar acceder sin autorización a datos, cuentas o
                funcionalidades de otros usuarios, o a las áreas restringidas
                del Servicio.
              </li>
              <li>
                Realizar ingeniería inversa, descompilar, desensamblar o intentar
                derivar el código fuente del Servicio.
              </li>
              <li>
                Utilizar el Servicio de cualquier manera que pueda sobrecargar,
                deteriorar o comprometer los servidores, redes o infraestructura
                de Medibill.
              </li>
              <li>
                Revender, sublicenciar, redistribuir o comercializar el acceso
                al Servicio sin autorización escrita de Medibill.
              </li>
              <li>
                Utilizar bots, scrapers, técnicas automatizadas o de minería de
                datos para acceder o extraer información del Servicio, salvo
                las funcionalidades expresamente provistas (como la API del bot
                de Telegram).
              </li>
            </ul>
            <p className="mt-2">
              El incumplimiento de esta sección podrá resultar en la suspensión
              o terminación inmediata de la cuenta, sin derecho a reembolso y
              sin perjuicio de las acciones legales que Medibill pueda ejercer.
            </p>
          </section>

          {/* ── 9 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              9. Disponibilidad y Nivel de Servicio
            </h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Medibill hará esfuerzos comercialmente razonables para mantener
                el Servicio disponible, pero{" "}
                <strong>no garantiza una disponibilidad ininterrumpida</strong>{" "}
                ni libre de errores.
              </li>
              <li>
                El Servicio puede experimentar interrupciones por mantenimiento
                programado, actualizaciones, fallos de infraestructura de
                terceros (incluyendo Supabase, proveedores de IA, Wompi o el
                Proveedor Tecnológico de facturación), caso fortuito o fuerza
                mayor.
              </li>
              <li>
                Medibill no será responsable por pérdidas, daños o perjuicios
                derivados de la interrupción, suspensión, lentitud o
                indisponibilidad temporal del Servicio.
              </li>
              <li>
                Medibill se reserva el derecho de suspender el Servicio temporal
                o permanentemente, con o sin previo aviso, por razones técnicas,
                de seguridad, legales o comerciales.
              </li>
            </ul>
          </section>

          {/* ── 10 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              10. Propiedad Intelectual
            </h2>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              10.1. Propiedad de Medibill
            </h3>
            <p>
              El Servicio, incluyendo pero no limitándose a su código fuente,
              algoritmos, modelos de IA entrenados, diseño de interfaz, marcas,
              logotipos, textos, gráficos y documentación, es propiedad
              exclusiva de Medibill y está protegido por las leyes de propiedad
              intelectual de Colombia (Decisión Andina 486 de 2000, Ley 23 de
              1982 y demás normas concordantes) y tratados internacionales
              aplicables. Ningún derecho de propiedad intelectual es transferido
              al Usuario por virtud de estos Términos.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              10.2. Licencia de Uso
            </h3>
            <p>
              Medibill le otorga una licencia limitada, no exclusiva, no
              transferible, no sublicenciable y revocable para utilizar el
              Servicio conforme a estos Términos y al plan de suscripción
              contratado. Esta licencia no otorga ningún derecho sobre el código
              fuente, los algoritmos ni la tecnología subyacente del Servicio.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              10.3. Datos del Usuario
            </h3>
            <p>
              Los datos, facturas, notas clínicas y demás información que usted
              ingrese en la plataforma siguen siendo de su propiedad. Usted
              otorga a Medibill una licencia limitada para procesar dichos datos
              exclusivamente con el fin de prestar el Servicio.
            </p>
          </section>

          {/* ── 11 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              11. Limitación de Responsabilidad
            </h2>
            <p className="font-semibold uppercase">
              EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEGISLACIÓN COLOMBIANA
              APLICABLE:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                Medibill proporciona el Servicio{" "}
                <strong>&quot;TAL CUAL&quot; (&quot;AS IS&quot;) y &quot;SEGÚN
                DISPONIBILIDAD&quot; (&quot;AS AVAILABLE&quot;)</strong>, sin
                garantías de ningún tipo, ya sean expresas, implícitas o
                legales, incluyendo pero no limitándose a garantías de
                comerciabilidad, idoneidad para un propósito particular, no
                infracción o cumplimiento normativo.
              </li>
              <li>
                Medibill{" "}
                <strong>
                  no será responsable por daños indirectos, incidentales,
                  especiales, consecuentes o punitivos
                </strong>
                , incluyendo pero no limitándose a: pérdida de beneficios,
                pérdida de datos, pérdida de oportunidades de negocio,
                interrupción de la actividad comercial, costos de adquisición
                de servicios sustitutivos, sanciones impuestas por autoridades
                regulatorias o glosas de EPS, independientemente de la causa y
                de la teoría de responsabilidad aplicada (contractual,
                extracontractual o cualquier otra).
              </li>
              <li>
                <strong>
                  La responsabilidad total acumulada de Medibill por cualquier
                  reclamación
                </strong>{" "}
                relacionada con el Servicio estará limitada al monto
                efectivamente pagado por el Usuario a Medibill durante los
                doce (12) meses inmediatamente anteriores al evento que dio
                origen a la reclamación, o a $500.000 COP, lo que sea mayor.
              </li>
              <li>
                Medibill no será responsable por errores en la codificación,
                clasificación o facturación que no hayan sido{" "}
                <strong>verificados, aprobados y confirmados</strong> por el
                Usuario antes de su radicación o transmisión.
              </li>
              <li>
                Medibill no será responsable por el rechazo, glosa o no pago de
                facturas por parte de EPS, IPS, ADRES o cualquier otra entidad
                del Sistema General de Seguridad Social en Salud (SGSSS).
              </li>
              <li>
                Medibill no será responsable por decisiones comerciales,
                clínicas o administrativas que el Usuario tome basándose en la
                información proporcionada por el Servicio.
              </li>
            </ul>
          </section>

          {/* ── 12 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              12. Indemnización
            </h2>
            <p>
              Usted se obliga a indemnizar, defender y mantener indemne a
              Medibill, sus directores, empleados, agentes, contratistas y
              afiliados, frente a cualquier reclamación, demanda, acción, pérdida,
              responsabilidad, daño, costo o gasto (incluyendo honorarios
              razonables de abogados) que surja de o esté relacionado con:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>Su uso del Servicio o cualquier actividad bajo su cuenta.</li>
              <li>Su violación de estos Términos.</li>
              <li>
                Su violación de cualquier ley, regulación o derecho de terceros.
              </li>
              <li>
                La información, datos o contenido que usted ingrese en la
                plataforma.
              </li>
              <li>
                Reclamaciones de terceros (incluidos pacientes, EPS, IPS,
                autoridades regulatorias o la DIAN) relacionadas con las
                facturas, clasificaciones o documentos generados a través de su
                cuenta.
              </li>
            </ul>
          </section>

          {/* ── 13 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              13. Protección de Datos Personales
            </h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{" "}
              <a href="/privacidad" className="text-medi-primary hover:underline">
                Política de Privacidad
              </a>
              , la cual forma parte integral de estos Términos. Al utilizar el
              Servicio, usted acepta el tratamiento de sus datos conforme a la
              Ley 1581 de 2012 (Ley de Protección de Datos Personales), el
              Decreto 1377 de 2013 y las demás normas concordantes.
            </p>
            <p className="mt-2">
              En la medida en que usted ingrese datos de terceros (pacientes,
              colaboradores u otros) en la plataforma, usted declara y garantiza
              que cuenta con la autorización expresa de los titulares de dichos
              datos para su tratamiento conforme a la finalidad del Servicio, y
              asume toda responsabilidad por el incumplimiento de esta
              obligación.
            </p>
          </section>

          {/* ── 14 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              14. Confidencialidad
            </h2>
            <p>
              Cada parte se compromete a mantener la confidencialidad de la
              información confidencial de la otra parte que haya recibido en
              virtud de la relación derivada de estos Términos. Se entiende por
              información confidencial los datos técnicos, comerciales,
              financieros y operativos que no sean de conocimiento público. Esta
              obligación subsistirá incluso después de la terminación de la
              relación contractual.
            </p>
          </section>

          {/* ── 15 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              15. Eliminación de Cuenta y Terminación
            </h2>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              15.1. Eliminación Voluntaria
            </h3>
            <p>
              Usted puede solicitar la eliminación de su cuenta desde la
              configuración de perfil. Una vez solicitada, contará con un
              período de gracia de <strong>7 días calendario</strong> durante el
              cual podrá cancelar la solicitud. Transcurrido ese plazo, todos
              sus datos serán eliminados de forma permanente e irrecuperable,
              incluyendo perfil, membresías a organizaciones, facturas,
              clasificaciones y registros de uso.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              15.2. Terminación por parte de Medibill
            </h3>
            <p>
              Medibill se reserva el derecho de suspender o terminar su cuenta
              de manera inmediata y sin previo aviso si:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>Usted incumple estos Términos.</li>
              <li>
                Se detecta un uso fraudulento, abusivo o ilegal de la plataforma.
              </li>
              <li>
                La cuenta ha estado inactiva por más de 12 meses sin un plan de
                pago activo.
              </li>
              <li>
                Es requerido por orden judicial, mandamiento de autoridad
                competente o disposición legal.
              </li>
              <li>
                Medibill decide descontinuar el Servicio total o parcialmente.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              15.3. Efectos de la Terminación
            </h3>
            <p>
              La terminación de la relación contractual, por cualquier causa, no
              afectará las obligaciones adquiridas durante la vigencia del
              contrato, incluyendo las obligaciones de pago pendientes, las
              cláusulas de limitación de responsabilidad, indemnización,
              propiedad intelectual, confidencialidad y resolución de
              controversias, las cuales sobrevivirán a la terminación.
            </p>
          </section>

          {/* ── 16 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              16. Servicios de Terceros
            </h2>
            <p>
              El Servicio se integra o depende de servicios de terceros,
              incluyendo pero no limitándose a:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                <strong>Supabase:</strong> Infraestructura de base de datos y
                autenticación.
              </li>
              <li>
                <strong>Wompi:</strong> Procesamiento de pagos.
              </li>
              <li>
                <strong>Proveedores de IA:</strong> Modelos de inteligencia
                artificial para clasificación de códigos.
              </li>
              <li>
                <strong>Proveedor Tecnológico de facturación electrónica:</strong>{" "}
                Transmisión de facturas a la DIAN.
              </li>
              <li>
                <strong>Telegram:</strong> Bot de dictado por audio (en planes
                compatibles).
              </li>
            </ul>
            <p className="mt-2">
              Medibill no se responsabiliza por la disponibilidad, rendimiento,
              errores, cambios en los términos o interrupciones de los servicios
              de terceros. El uso de dichos servicios está sujeto a sus
              respectivos términos y condiciones.
            </p>
          </section>

          {/* ── 17 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              17. Fuerza Mayor
            </h2>
            <p>
              Medibill no será responsable por el incumplimiento o retraso en el
              cumplimiento de sus obligaciones cuando dicho incumplimiento sea
              causado por eventos de fuerza mayor o caso fortuito, incluyendo
              pero no limitándose a: desastres naturales, pandemias, conflictos
              armados, actos de terrorismo, fallos de infraestructura de
              internet, ciberataques, cambios legislativos o regulatorios,
              decisiones gubernamentales, huelgas, o cualquier otro evento fuera
              del control razonable de Medibill.
            </p>
          </section>

          {/* ── 18 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              18. Cumplimiento Normativo del Sector Salud
            </h2>
            <p>
              El Usuario reconoce y acepta que:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                Es su responsabilidad exclusiva cumplir con toda la
                normatividad aplicable al sector salud colombiano, incluyendo
                las resoluciones del Ministerio de Salud sobre RIPS, las normas
                de la DIAN sobre facturación electrónica, y las regulaciones de
                la Superintendencia Nacional de Salud.
              </li>
              <li>
                Medibill facilita herramientas para asistir en el cumplimiento,
                pero no garantiza que el uso del Servicio por sí solo constituya
                cumplimiento total de las obligaciones regulatorias del Usuario.
              </li>
              <li>
                Cualquier cambio normativo que afecte la funcionalidad del
                Servicio será implementado por Medibill en plazos razonables,
                sin que la demora en la implementación genere responsabilidad
                alguna para Medibill.
              </li>
            </ul>
          </section>

          {/* ── 19 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              19. Modificaciones a los Términos
            </h2>
            <p>
              Medibill se reserva el derecho de modificar estos Términos en
              cualquier momento. Las modificaciones serán publicadas en esta
              página con la fecha de &quot;Última actualización&quot;
              correspondiente. Para cambios sustanciales, Medibill notificará a
              los usuarios registrados a través de correo electrónico o
              mediante un aviso visible en la plataforma con al menos 15 días de
              anticipación.
            </p>
            <p className="mt-2">
              El uso continuado del Servicio después de la publicación o
              notificación de cambios constituye su aceptación de los Términos
              modificados. Si no está de acuerdo con los cambios, deberá dejar
              de utilizar el Servicio y podrá solicitar la eliminación de su
              cuenta.
            </p>
          </section>

          {/* ── 20 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              20. Resolución de Controversias
            </h2>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              20.1. Ley Aplicable
            </h3>
            <p>
              Estos Términos se rigen e interpretan de conformidad con las leyes
              de la República de Colombia.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              20.2. Resolución Amistosa
            </h3>
            <p>
              Las partes se comprometen a intentar resolver cualquier
              controversia de forma directa y amistosa dentro de un plazo de 30
              días calendario contados a partir de la notificación escrita de la
              controversia.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-medi-dark">
              20.3. Jurisdicción
            </h3>
            <p>
              En caso de no alcanzar un acuerdo amistoso, las partes se someten
              a la jurisdicción de los jueces y tribunales de la ciudad de Pasto,
              Nariño, Colombia, renunciando a cualquier otro fuero que pudiera
              corresponderles, sin perjuicio de los derechos que la ley otorgue
              al consumidor conforme al Estatuto del Consumidor (Ley 1480 de
              2011).
            </p>
          </section>

          {/* ── 21 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              21. Disposiciones Generales
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong>Acuerdo completo:</strong> Estos Términos, junto con la{" "}
                <a
                  href="/privacidad"
                  className="text-medi-primary hover:underline"
                >
                  Política de Privacidad
                </a>
                , constituyen el acuerdo completo entre usted y Medibill con
                respecto al Servicio, y reemplazan cualquier acuerdo, propuesta
                o comunicación anterior, ya sea oral o escrita.
              </li>
              <li>
                <strong>Separabilidad:</strong> Si alguna disposición de estos
                Términos es declarada inválida, ilegal o inejecutable por un
                tribunal competente, dicha disposición será modificada en la
                medida mínima necesaria para hacerla válida y ejecutable, o en
                su defecto será eliminada, sin afectar la validez y
                ejecutabilidad del resto de los Términos.
              </li>
              <li>
                <strong>Renuncia:</strong> La omisión o demora de Medibill en
                ejercer cualquier derecho previsto en estos Términos no
                constituirá renuncia al mismo. Cualquier renuncia deberá ser
                expresa y por escrito.
              </li>
              <li>
                <strong>Cesión:</strong> Usted no podrá ceder ni transferir sus
                derechos u obligaciones bajo estos Términos sin el
                consentimiento previo y escrito de Medibill. Medibill podrá
                ceder estos Términos libremente en caso de fusión, adquisición,
                venta de activos o por disposición legal.
              </li>
              <li>
                <strong>Notificaciones:</strong> Las notificaciones de Medibill
                al Usuario se realizarán a la dirección de correo electrónico
                proporcionada en la cuenta. Las notificaciones del Usuario a
                Medibill deberán enviarse a soporte@medibill.co.
              </li>
              <li>
                <strong>Relación entre las partes:</strong> Nada en estos
                Términos crea una relación de sociedad, agencia, empleo,
                franquicia o joint venture entre Medibill y el Usuario.
              </li>
            </ul>
          </section>

          {/* ── 22 ── */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-medi-deep">
              22. Contacto
            </h2>
            <p>
              Si tiene preguntas, inquietudes o reclamaciones sobre estos
              Términos y Condiciones de Servicio, puede contactarnos a través de
              los siguientes canales:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                Correo electrónico:{" "}
                <a
                  href="mailto:soporte@medibill.co"
                  className="text-medi-primary hover:underline"
                >
                  soporte@medibill.co
                </a>
              </li>
              <li>
                Formulario de contacto en:{" "}
                <a
                  href="/#contacto"
                  className="text-medi-primary hover:underline"
                >
                  medibill.co
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
