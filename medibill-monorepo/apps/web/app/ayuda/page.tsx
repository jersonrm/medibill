import Link from "next/link";

const topics = [
  {
    title: "Primeros Pasos",
    description:
      "Completa tu registro, configura tu perfil y aprende los conceptos básicos de Medibill.",
    href: "/ayuda/primeros-pasos",
    icon: "🚀",
  },
  {
    title: "Facturas",
    description:
      "Cómo crear, aprobar, descargar y radicar facturas electrónicas paso a paso.",
    href: "/ayuda/facturas",
    icon: "📄",
  },
  {
    title: "Clasificación IA",
    description:
      "Cómo funciona la clasificación automática de códigos CUPS y CIE-10 con inteligencia artificial.",
    href: "/ayuda/clasificacion-ia",
    icon: "🤖",
  },
  {
    title: "Glosas",
    description:
      "Gestión de glosas recibidas, plazos legales y cómo responder con asistencia de IA.",
    href: "/ayuda/glosas",
    icon: "⚠️",
  },
  {
    title: "Pagos y Cartera",
    description:
      "Seguimiento de cartera, importar sábana de pagos y conciliación automática.",
    href: "/ayuda/pagos",
    icon: "💰",
  },
  {
    title: "Configuración",
    description:
      "Perfil profesional, equipo, acuerdos con EPS, tarifas y suscripción.",
    href: "/ayuda/configuracion",
    icon: "⚙️",
  },
];

export default function AyudaPage() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <Link
            key={topic.href}
            href={topic.href}
            className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-medi-light hover:shadow-md"
          >
            <span className="text-2xl">{topic.icon}</span>
            <h2 className="mt-3 text-lg font-semibold text-medi-deep group-hover:text-medi-primary">
              {topic.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{topic.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
