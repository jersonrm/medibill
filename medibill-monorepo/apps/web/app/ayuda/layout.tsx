"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const helpCategories = [
  {
    label: "Primeros Pasos",
    href: "/ayuda/primeros-pasos",
    icon: "🚀",
  },
  {
    label: "Facturas",
    href: "/ayuda/facturas",
    icon: "📄",
  },
  {
    label: "Clasificación IA",
    href: "/ayuda/clasificacion-ia",
    icon: "🤖",
  },
  {
    label: "Glosas",
    href: "/ayuda/glosas",
    icon: "⚠️",
  },
  {
    label: "Pagos y Cartera",
    href: "/ayuda/pagos",
    icon: "💰",
  },
  {
    label: "Configuración",
    href: "/ayuda/configuracion",
    icon: "⚙️",
  },
];

export default function AyudaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-medi-deep">Centro de Ayuda</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aprende a usar cada función de Medibill paso a paso.
          </p>
        </div>
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar de ayuda */}
          <nav className="w-full shrink-0 lg:w-56">
            <ul className="space-y-1">
              <li>
                <Link
                  href="/ayuda"
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname === "/ayuda"
                      ? "bg-medi-primary text-white"
                      : "text-medi-dark hover:bg-medi-light/40"
                  }`}
                >
                  📚 Todos los temas
                </Link>
              </li>
              {helpCategories.map((cat) => (
                <li key={cat.href}>
                  <Link
                    href={cat.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname === cat.href
                        ? "bg-medi-primary text-white"
                        : "text-medi-dark hover:bg-medi-light/40"
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
