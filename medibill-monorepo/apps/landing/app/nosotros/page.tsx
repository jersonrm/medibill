import type { Metadata } from "next";
import { SectionBadge } from "../../components/SectionBadge";
import { SectionHeading } from "../../components/SectionHeading";

export const metadata: Metadata = {
  title: "Quiénes Somos",
  description:
    "Conoce al equipo detrás de Medibill. Nuestra misión es democratizar la facturación médica en Colombia con inteligencia artificial.",
};

const values = [
  {
    title: "Precisión",
    description:
      "Cada código, cada validación, cada plazo legal debe ser exacto. En facturación médica no hay margen para el error y nuestro software lo refleja.",
    icon: "🎯",
  },
  {
    title: "Transparencia",
    description:
      "Precios claros, procesos visibles, auditoría trazable. Sabemos que la confianza se construye mostrando cómo funcionan las cosas.",
    icon: "🔍",
  },
  {
    title: "Innovación",
    description:
      "Aplicamos inteligencia artificial y búsqueda semántica a problemas que el sector salud todavía resuelve de forma manual. Cada actualización busca simplificar tu día a día.",
    icon: "💡",
  },
  {
    title: "Empatía",
    description:
      "Entendemos la presión de los plazos, la complejidad de las glosas y la frustración de la codificación manual. Construimos Medibill para que tú puedas enfocarte en tus pacientes.",
    icon: "❤️",
  },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.medibill.co";

export default function NosotrosPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-medi-light/20 to-white pb-16 pt-32 md:pt-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <SectionBadge emoji="👥" text="Quiénes Somos" />
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-medi-deep md:text-5xl">
            Simplificamos la facturación médica en Colombia
          </h1>
          <p className="mt-6 text-lg text-gray-600">
            Somos un equipo que combina tecnología de vanguardia con un profundo
            conocimiento del sistema de salud colombiano. Creemos que facturar no
            debería ser más difícil que atender a un paciente.
          </p>
        </div>
      </section>

      {/* Misión y Visión */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
              <span className="text-3xl">🎯</span>
              <h2 className="mt-4 text-2xl font-bold text-medi-deep">
                Nuestra Misión
              </h2>
              <p className="mt-4 leading-relaxed text-gray-600">
                Empoderar a los profesionales de salud en Colombia con
                herramientas inteligentes que transformen la facturación médica
                de un proceso tedioso y propenso a errores en un flujo ágil,
                preciso y conforme a la normativa. Queremos que cada médico,
                clínica pueda facturar con confianza — sin importar su
                tamaño o recursos.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
              <span className="text-3xl">🔭</span>
              <h2 className="mt-4 text-2xl font-bold text-medi-deep">
                Nuestra Visión
              </h2>
              <p className="mt-4 leading-relaxed text-gray-600">
                Ser la plataforma de referencia para la facturación médica
                electrónica en Colombia. Un ecosistema donde la clasificación
                RIPS, la gestión de glosas y la conciliación de pagos funcionen
                de forma integrada, automatizada e inteligente — permitiendo que
                los profesionales de salud se concentren en lo que realmente
                importa: sus pacientes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge emoji="💎" text="Nuestros Valores" />
          <div className="mt-4">
            <SectionHeading
              title="Lo que nos guía cada día"
              subtitle="Cuatro principios que definen cómo construimos producto, atendemos clientes y tomamos decisiones."
            />
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
              >
                <span className="text-3xl">{value.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-medi-deep">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* El problema que resolvemos */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <SectionBadge emoji="📋" text="El Problema" />
          <div className="mt-4">
            <SectionHeading
              title="¿Por qué creamos Medibill?"
              centered={false}
            />
          </div>
          <div className="mt-8 space-y-6 text-gray-600">
            <p className="leading-relaxed">
              La facturación médica en Colombia es un proceso complejo que
              involucra decenas de códigos CUPS y CIE-10, resoluciones
              cambiantes, plazos legales estrictos y un sistema de glosas que
              puede paralizar el flujo de caja de cualquier práctica médica.
            </p>
            <p className="leading-relaxed">
              Los profesionales de salud dedican horas cada semana a tareas
              administrativas que no requieren su experticia clínica: buscar
              códigos en catálogos extensos, verificar coherencia
              diagnóstico-procedimiento, calcular plazos en días hábiles y
              redactar respuestas a glosas con argumentación normativa.
            </p>
            <p className="leading-relaxed">
              Medibill nació para resolver exactamente este problema. Usando
              inteligencia artificial entrenada con terminología médica
              colombiana y los catálogos oficiales del Ministerio de Salud,
              automatizamos la codificación y validación — devolviendo tiempo
              valioso a quienes más lo necesitan.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-medi-deep py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            ¿Quieres ser parte del cambio?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Únete a los profesionales de salud que ya simplifican su facturación
            con Medibill.
          </p>
          <a
            href={`${APP_URL}/login`}
            className="mt-8 inline-block rounded-xl bg-medi-primary px-10 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-medi-accent hover:shadow-xl"
          >
            Comenzar Prueba Gratuita
          </a>
          <p className="mt-4 text-sm text-gray-500">
            Consulta nuestros{" "}
            <a href="/terminos" className="underline hover:text-gray-300">Términos y Condiciones</a>{" "}
            y las{" "}
            <a href="/terminos#prueba-gratuita" className="underline hover:text-gray-300">condiciones de la Prueba Gratuita</a>.
          </p>
        </div>
      </section>
    </>
  );
}
