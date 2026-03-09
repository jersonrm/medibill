import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.medibill.co";

const productLinks = [
  { label: "Clasificación IA", href: "/#servicios" },
  { label: "Generación RIPS", href: "/#servicios" },
  { label: "Gestión de Glosas", href: "/#servicios" },
  { label: "Precios", href: "/precios" },
];

const companyLinks = [
  { label: "Quiénes Somos", href: "/nosotros" },
  { label: "Contacto", href: "/#contacto" },
];

const legalLinks = [
  { label: "Términos de Servicio", href: "/terminos" },
  { label: "Política de Privacidad", href: "/privacidad" },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-medi-deep text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-medi-primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-white"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold">Medibill</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Facturación médica inteligente para profesionales de salud en
              Colombia. Impulsada por inteligencia artificial.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Producto
            </h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Empresa
            </h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Contacto
              </h4>
              <a
                href="mailto:soporte@medibill.co"
                className="text-sm text-gray-300 transition-colors hover:text-white"
              >
                soporte@medibill.co
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 md:flex-row">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Medibill. Todos los derechos
            reservados.
          </p>
          <a
            href={`${APP_URL}/login`}
            className="rounded-lg bg-medi-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-medi-accent"
          >
            Comenzar Gratis
          </a>
        </div>
      </div>
    </footer>
  );
}
