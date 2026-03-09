import React from "react";
import type { Metadata } from "next";
import { SectionBadge } from "../../components/SectionBadge";
import { SectionHeading } from "../../components/SectionHeading";
import { PricingCard } from "../../components/PricingCard";
import { FAQAccordion } from "../../components/FAQAccordion";

export const metadata: Metadata = {
  title: "Precios",
  description:
    "Planes de Medibill para médicos independientes y clínicas. Precios transparentes con período de prueba gratuito. Desde $99.000 COP/mes.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.medibill.co";

const plans = [
  {
    name: "Starter",
    price: "$99.000",
    period: "/mes",
    description:
      "Ideal para médicos independientes que están comenzando a digitalizar su facturación.",
    features: [
      "100 clasificaciones IA al mes",
      "50 facturas DIAN",
      "RIPS JSON + FEV XML",
      "Dashboard básico",
      "Validación de facturas",
      "Soporte por email",
    ],
  },
  {
    name: "Profesional",
    price: "$199.000",
    period: "/mes",
    description:
      "Para profesionales con volumen constante de consultas que necesitan gestión integral.",
    features: [
      "500 clasificaciones IA al mes",
      "200 facturas DIAN",
      "Todo lo de Starter",
      "Dashboard completo con KPIs",
      "Gestión de glosas con IA",
      "Importación de sábana de pagos",
      "Conciliación automática",
      "Soporte por email + chat",
    ],
    highlighted: true,
  },
  {
    name: "Clínica",
    price: "$149.000",
    period: "/usuario/mes",
    description:
      "Para clínicas y centros médicos con múltiples profesionales que necesitan colaboración.",
    features: [
      "Clasificaciones ilimitadas",
      "Facturas ilimitadas",
      "Todo lo de Profesional",
      "Hasta 20 usuarios",
      "Gestión de equipo y roles",
      "Importación masiva de datos",
      "Acuerdos de voluntades por EPS",
      "Soporte prioritario",
    ],
  },
];

const comparisonFeatures = [
  {
    category: "Clasificación y Facturación",
    items: [
      {
        name: "Clasificaciones IA al mes",
        starter: "100",
        profesional: "500",
        clinica: "Ilimitadas",
      },
      {
        name: "Facturas DIAN",
        starter: "50",
        profesional: "200",
        clinica: "Ilimitadas",
      },
      {
        name: "Generación RIPS JSON",
        starter: true,
        profesional: true,
        clinica: true,
      },
      {
        name: "Validación pre-radicación",
        starter: true,
        profesional: true,
        clinica: true,
      },
    ],
  },
  {
    category: "Gestión Avanzada",
    items: [
      {
        name: "Gestión de glosas con IA",
        starter: false,
        profesional: true,
        clinica: true,
      },
      {
        name: "Importación sábana de pagos",
        starter: false,
        profesional: true,
        clinica: true,
      },
      {
        name: "Conciliación automática",
        starter: false,
        profesional: true,
        clinica: true,
      },
      {
        name: "Importación masiva",
        starter: false,
        profesional: false,
        clinica: true,
      },
    ],
  },
  {
    category: "Colaboración",
    items: [
      {
        name: "Usuarios por organización",
        starter: "1",
        profesional: "1",
        clinica: "Hasta 20",
      },
      {
        name: "Gestión de equipo y roles",
        starter: false,
        profesional: false,
        clinica: true,
      },
      {
        name: "Acuerdos por EPS",
        starter: false,
        profesional: false,
        clinica: true,
      },
    ],
  },
  {
    category: "Soporte",
    items: [
      {
        name: "Email",
        starter: true,
        profesional: true,
        clinica: true,
      },
      {
        name: "Chat",
        starter: false,
        profesional: true,
        clinica: true,
      },
      {
        name: "Soporte prioritario",
        starter: false,
        profesional: false,
        clinica: true,
      },
    ],
  },
];

const pricingFaq = [
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer:
      "Sí. Puedes actualizar o reducir tu plan desde Configuración > Suscripción. Los cambios se aplican de inmediato y el costo se prorratea automáticamente.",
  },
  {
    question: "¿Qué pasa si supero el límite de clasificaciones?",
    answer:
      "Recibirás una notificación cuando alcances el 80% de tu límite mensual. Si lo superas, podrás seguir usando la plataforma pero las clasificaciones adicionales quedarán pendientes hasta el próximo período o hasta que actualices tu plan.",
  },
  {
    question: "¿El período de prueba requiere tarjeta de crédito?",
    answer:
      "No. Puedes registrarte y comenzar tu período de prueba sin ingresar ningún método de pago. Solo necesitarás agregar un método de pago cuando decidas continuar con un plan.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Aceptamos tarjetas de crédito y débito, PSE (transferencia bancaria) y Nequi a través de Wompi. Los pagos son recurrentes mensuales.",
  },
  {
    question: "¿Puedo cancelar mi suscripción?",
    answer:
      "Sí, puedes cancelar tu suscripción en cualquier momento. La cancelación se programa para el final del período de facturación actual, por lo que seguirás teniendo acceso hasta esa fecha.",
  },
  {
    question: "¿Ofrecen descuentos para pagos anuales?",
    answer:
      "Actualmente manejamos facturación mensual. Contáctanos si estás interesado en un acuerdo anual y evaluaremos una propuesta personalizada.",
  },
];

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 text-medi-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="h-5 w-5 text-gray-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function renderCell(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? <CheckIcon /> : <XIcon />;
  }
  return <span className="text-sm font-medium text-medi-deep">{value}</span>;
}

export default function PreciosPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-medi-light/20 to-white pb-16 pt-32 md:pt-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <SectionBadge emoji="💰" text="Precios" />
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-medi-deep md:text-5xl">
            Precios transparentes, sin sorpresas
          </h1>
          <p className="mt-6 text-lg text-gray-600">
            Elige el plan que se ajuste al volumen de tu práctica médica. Todos
            incluyen período de prueba gratuito sin necesidad de tarjeta de
            crédito.
          </p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="Comparación detallada de planes"
            subtitle="Encuentra exactamente lo que necesitas."
          />
          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-4 text-left text-sm font-medium text-gray-500">
                    Funcionalidad
                  </th>
                  <th className="pb-4 text-center text-sm font-semibold text-medi-dark">
                    Starter
                  </th>
                  <th className="pb-4 text-center text-sm font-semibold text-medi-primary">
                    Profesional
                  </th>
                  <th className="pb-4 text-center text-sm font-semibold text-medi-dark">
                    Clínica
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((group) => (
                  <React.Fragment key={group.category}>
                    <tr>
                      <td
                        colSpan={4}
                        className="pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-gray-400"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-gray-100"
                      >
                        <td className="py-3 text-sm text-gray-700">
                          {item.name}
                        </td>
                        <td className="py-3 text-center">
                          {renderCell(item.starter)}
                        </td>
                        <td className="py-3 text-center">
                          {renderCell(item.profesional)}
                        </td>
                        <td className="py-3 text-center">
                          {renderCell(item.clinica)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <SectionBadge emoji="❓" text="Preguntas sobre precios" />
          <div className="mt-4">
            <SectionHeading
              title="Preguntas frecuentes sobre precios"
              subtitle="Todo lo que necesitas saber sobre nuestros planes y facturación."
            />
          </div>
          <div className="mt-14">
            <FAQAccordion items={pricingFaq} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-medi-deep py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            ¿Aún tienes dudas?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Agenda una demostración personalizada y te mostramos cómo Medibill
            puede simplificar tu facturación.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={`${APP_URL}/login`}
              className="rounded-xl bg-medi-primary px-10 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-medi-accent hover:shadow-xl"
            >
              Comenzar Prueba Gratuita
            </a>
            <a
              href="/#contacto"
              className="rounded-xl border border-gray-600 px-10 py-4 text-sm font-semibold text-white transition-colors hover:border-gray-400"
            >
              Contactar Ventas
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
