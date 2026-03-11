import { SectionBadge } from "../components/SectionBadge";
import { SectionHeading } from "../components/SectionHeading";
import { FeatureCard } from "../components/FeatureCard";
import { StepCard } from "../components/StepCard";
import { PricingCard } from "../components/PricingCard";
import { FAQAccordion } from "../components/FAQAccordion";
import { ContactForm } from "../components/ContactForm";
import { StatCounter } from "../components/StatCounter";
import { SavingsCalculator } from "../components/SavingsCalculator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.medibill.co";

/* ─────────────────────── SVG Icons ─────────────────────── */

function IconBrain() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  );
}

/* ─────────────────────── Data ─────────────────────── */

const features = [
  {
    icon: <IconBrain />,
    title: "Clasificación con IA",
    description:
      "Pega la nota clínica y obtén códigos CUPS y CIE-10 en segundos. Nuestro modelo de inteligencia artificial está entrenado con terminología médica colombiana y validado contra los catálogos oficiales.",
  },
  {
    icon: <IconDocument />,
    title: "Generación RIPS",
    description:
      "Genera archivos JSON FEV-RIPS listos para radicar, conformes a la Resolución 2275 de 2023. Incluye validación automática antes de la descarga.",
  },
  {
    icon: <IconChat />,
    title: "Gestión de Glosas",
    description:
      "Recibe, clasifica y responde glosas con sugerencias inteligentes. Cumple los tiempos legales de la Resolución 2284 de 2023 con alertas automáticas de vencimiento.",
  },
  {
    icon: <IconCheck />,
    title: "Validación de Facturas",
    description:
      "Valida coherencia paciente-diagnóstico-procedimiento, tarifas contra acuerdos y completitud de datos antes de aprobar cada factura.",
  },
  {
    icon: <IconCurrency />,
    title: "Cartera y Pagos",
    description:
      "Seguimiento completo desde la radicación hasta el cobro. Importa sábanas de pago, concilia automáticamente y visualiza tu cartera en tiempo real.",
  },
  {
    icon: <IconChart />,
    title: "Dashboard Inteligente",
    description:
      "Indicadores clave de facturación, distribución por EPS, alertas de glosas pendientes y tendencias de tu práctica médica en un solo lugar.",
  },
  {
    icon: <IconChat />,
    title: "Clasificación por Telegram",
    description:
      "Envía una nota de voz al Bot de Telegram y recibí los códigos CUPS y CIE-10 en segundos. Creá la factura directamente desde el chat.",
  },
];

const whyUs = [
  {
    icon: <IconBrain />,
    title: "Precisión con IA",
    description:
      "Modelos de lenguaje entrenados con terminología médica colombiana y catálogos CUPS/CIE-10 oficiales. Búsqueda semántica para encontrar el código correcto incluso con descripciones imprecisas.",
  },
  {
    icon: <IconDocument />,
    title: "Normativa Actualizada",
    description:
      "Resoluciones 2275 y 2284 de 2023 integradas en cada validación. Cálculo automático de plazos en días hábiles con festivos colombianos.",
  },
  {
    icon: <IconShield />,
    title: "Seguridad Clínica",
    description:
      "Cifrado extremo a extremo, HTTPS forzado, aislamiento multi-tenant y anonimización de datos en el procesamiento con IA. Tus datos clínicos están protegidos.",
  },
  {
    icon: <IconChat />,
    title: "Soporte Dedicado",
    description:
      "Un equipo que combina experiencia en salud y tecnología. Entendemos el contexto de la facturación médica en Colombia porque lo vivimos.",
  },
];

const steps = [
  {
    step: 1,
    title: "Registra tu consulta",
    description:
      "Escribe o pega la nota clínica del paciente. Medibill acepta texto libre — no necesitas un formato específico.",
  },
  {
    step: 2,
    title: "Clasifica con IA",
    description:
      "La inteligencia artificial identifica diagnósticos CIE-10 y procedimientos CUPS en segundos, con precisión validada contra catálogos oficiales.",
  },
  {
    step: 3,
    title: "Genera RIPS y factura electrónica",
    description:
      "Medibill arma automáticamente el JSON RIPS y el XML de la factura electrónica de venta (FEV) con firma DIAN — sin intervención manual.",
  },
  {
    step: 4,
    title: "Empaqueta todo en un .zip",
    description:
      "Se genera el comprimido con el JSON RIPS, el XML firmado y todos los soportes listos para radicar — todo en un solo clic.",
  },
  {
    step: 5,
    title: "Radica ante la EPS",
    description:
      "Descarga el paquete completo o radícalo directamente. Tú solo revisas y apruebas, Medibill hace el resto.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$99.000",
    period: "/mes",
    description: "Ideal para médicos independientes que están comenzando a digitalizar su facturación.",
    features: [
      "100 clasificaciones IA al mes",
      "50 facturas DIAN",
      "Soporte por email",
      "Dashboard básico",
      "RIPS JSON + FEV XML",
    ],
  },
  {
    name: "Profesional",
    price: "$199.000",
    period: "/mes",
    description: "Para profesionales con un volumen constante de consultas y facturación.",
    features: [
      "500 clasificaciones IA al mes",
      "200 facturas DIAN",
      "Soporte email + chat",
      "Dashboard completo",
      "Gestión de glosas con IA",
      "Bot Telegram (audio)",
      "Importación de sábana de pagos",
    ],
    highlighted: true,
  },
  {
    name: "Clínica",
    price: "$149.000",
    period: "/usuario/mes",
    description: "Para clínicas y centros médicos con múltiples profesionales.",
    features: [
      "Clasificaciones ilimitadas",
      "Facturas ilimitadas",
      "Hasta 20 usuarios",
      "Soporte prioritario",
      "Todas las funcionalidades",
      "Bot Telegram (audio)",
      "Gestión de equipo y roles",
      "Importación masiva",
    ],
  },
  {
    name: "IPS",
    price: "Personalizado",
    period: "",
    description: "Para instituciones prestadoras de servicios de salud con necesidades a escala.",
    features: [
      "Todo lo de Clínica",
      "Sedes ilimitadas",
      "Soporte dedicado 24/7",
      "Implementación asistida",
      "SLA garantizado",
      "Integración personalizada",
    ],
    ctaLabel: "Contactar Ventas",
    ctaHref: "/#contacto",
  },
];

const faqItems = [
  {
    question: "¿Qué es la clasificación RIPS con IA?",
    answer:
      "Es un proceso en el que nuestra inteligencia artificial analiza la nota clínica de un paciente y asigna automáticamente los códigos CUPS (procedimientos) y CIE-10 (diagnósticos) correspondientes, siguiendo los estándares del Ministerio de Salud de Colombia. Esto reemplaza la codificación manual que típicamente toma varios minutos por consulta.",
  },
  {
    question: "¿Medibill cumple con la Resolución 2275 de 2023?",
    answer:
      "Sí. Medibill genera archivos JSON FEV-RIPS conforme a la estructura definida en la Resolución 2275 de 2023. Cada archivo es validado automáticamente contra el esquema oficial antes de la descarga, incluyendo la estructura de usuarios, servicios, diagnósticos y procedimientos.",
  },
  {
    question: "¿Puedo usar Medibill si soy médico independiente?",
    answer:
      "Por supuesto. El plan Starter está diseñado específicamente para médicos independientes. Solo necesitas tu NIT, una resolución de facturación vigente y completar el onboarding de tres pasos para empezar a facturar.",
  },
  {
    question: "¿Cómo maneja Medibill las glosas?",
    answer:
      "Medibill implementa un sistema de tres capas: prevención (validación pre-radicación), mitigación (sugerencias automáticas basadas en IA) y resolución (gestión de respuestas con códigos RS01 a RS05 según la Resolución 2284 de 2023). Además, calcula plazos legales en días hábiles para que nunca pierdas un vencimiento.",
  },
  {
    question: "¿Mis datos clínicos están seguros?",
    answer:
      "Sí. Usamos cifrado en tránsito (HTTPS forzado con HSTS), aislamiento multi-tenant (cada organización solo accede a sus datos), anonimización automática antes del procesamiento con IA, y headers de seguridad estrictos (CSP, X-Frame-Options, entre otros). La infraestructura está alojada en Supabase con PostgreSQL gestionado.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Aceptamos tarjetas de crédito y débito, PSE (transferencia bancaria) y Nequi a través de Wompi, el procesador de pagos líder en Colombia. Todos los pagos son recurrentes mensuales y puedes cancelar en cualquier momento.",
  },
  {
    question: "¿Puedo cambiar de plan después?",
    answer:
      "Sí, puedes actualizar o cambiar tu plan en cualquier momento desde la sección de Configuración > Suscripción. El cambio se aplica de inmediato y se prorratea el costo restante del período actual.",
  },
  {
    question: "¿Ofrecen período de prueba?",
    answer:
      "Sí. Al registrarte, accedes a un período de prueba gratuito con acceso a todas las funcionalidades. No necesitas ingresar datos de pago para comenzar.",
  },  {
    question: "¿Cómo funciona el Bot de Telegram?",
    answer:
      "El Bot de Telegram te permite clasificar notas clínicas por audio. Enviás una nota de voz con la atención del paciente y recibís los códigos CUPS y CIE-10 en segundos. Desde el chat podés crear la factura directamente en Medibill con los datos pre-cargados. Disponible en planes Profesional, Clínica e IPS.",
  },];

/* ─────────────────────── Page ─────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-medi-light/20 to-white pb-20 pt-32 md:pt-40">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <SectionBadge text="Facturación médica con IA" />
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-medi-deep md:text-6xl">
            Facturación médica inteligente,{" "}
            <span className="text-medi-primary">impulsada por IA</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Clasifica códigos RIPS, genera facturas electrónicas y gestiona
            glosas — todo en una sola plataforma diseñada para profesionales de
            salud en Colombia.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={`${APP_URL}/login`}
              className="rounded-xl bg-medi-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-medi-primary/25 transition-all hover:bg-medi-accent hover:shadow-xl"
            >
              Comenzar Prueba Gratuita
            </a>
            <a
              href="#servicios"
              className="rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-medi-dark transition-colors hover:border-medi-light hover:bg-medi-light/10"
            >
              Ver Funcionalidades
            </a>
          </div>
          <div className="mx-auto mt-16 grid max-w-xl grid-cols-3 gap-8">
            <StatCounter value="99.2" suffix="%" label="Precisión RIPS" />
            <StatCounter prefix="-" value="80" suffix="%" label="Tiempo facturación" />
            <StatCounter prefix="+" value="500" label="Clasificaciones IA" />
          </div>
        </div>
        {/* Background decoration */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-medi-primary/5 blur-3xl" />
      </section>

      {/* ── Servicios ── */}
      <section id="servicios" className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge text="Funcionalidades" />
          <div className="mt-4">
            <SectionHeading
              title="Todo lo que necesitas para facturar con confianza"
              subtitle="Desde la nota clínica hasta la radicación ante la EPS: un flujo completo, automatizado y conforme a la normativa vigente."
            />
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Por qué elegirnos ── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge text="Por qué Medibill" />
          <div className="mt-4">
            <SectionHeading
              title="Respaldo tecnológico para tu práctica médica"
              subtitle="Combinamos inteligencia artificial de última generación con un profundo conocimiento de la facturación médica en Colombia."
            />
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {whyUs.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Ahorro ── */}
      <section className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge text="Tu tiempo vale dinero" />
          <div className="mt-4">
            <SectionHeading
              title="¿Cuánto dinero estás dejando de ganar?"
              subtitle="Cada minuto que gastas codificando RIPS manualmente es dinero que no estás facturando. Calcula cuánto recuperas con Medibill."
            />
          </div>
          <div className="mt-14">
            <SavingsCalculator />
          </div>
        </div>
      </section>

      {/* ── Proceso ── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge text="Proceso" />
          <div className="mt-4">
            <SectionHeading
              title="De la nota clínica a la radicación, sin salir de Medibill"
              subtitle="Todo el proceso automatizado: clasificación, RIPS, factura electrónica, comprimido y radicación. Tú solo revisas y apruebas."
            />
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {steps.map((step) => (
              <StepCard key={step.step} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Precios ── */}
      <section id="precios" className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionBadge text="Planes" />
          <div className="mt-4">
            <SectionHeading
              title="Precios transparentes, sin sorpresas"
              subtitle="Elige el plan que se ajuste al volumen de tu práctica. Todos incluyen período de prueba gratuito."
            />
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <SectionBadge text="Preguntas Frecuentes" />
          <div className="mt-4">
            <SectionHeading
              title="Resolvemos tus dudas"
              subtitle="Si tu pregunta no aparece aquí, contáctanos y te responderemos en menos de 24 horas."
            />
          </div>
          <div className="mt-14">
            <FAQAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section id="contacto" className="bg-gray-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionBadge text="Contacto" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-medi-deep md:text-4xl">
                ¿Listo para transformar tu facturación?
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Escríbenos y un miembro de nuestro equipo te contactará para
                resolver tus preguntas y ayudarte a comenzar.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-medi-light/30 text-medi-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-medi-dark">Email</p>
                    <a href="mailto:soporte@medibill.co" className="text-sm text-gray-600 hover:text-medi-primary">
                      soporte@medibill.co
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-medi-light/30 text-medi-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-medi-dark">Ubicación</p>
                    <p className="text-sm text-gray-600">Pasto, Nariño — Colombia</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-medi-deep py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Empieza a facturar con inteligencia hoy
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Únete a los profesionales de salud que ya confían en Medibill para
            simplificar su facturación médica.
          </p>
          <a
            href={`${APP_URL}/login`}
            className="mt-8 inline-block rounded-xl bg-medi-primary px-10 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-medi-accent hover:shadow-xl"
          >
            Comenzar Prueba Gratuita
          </a>
        </div>
      </section>
    </>
  );
}
