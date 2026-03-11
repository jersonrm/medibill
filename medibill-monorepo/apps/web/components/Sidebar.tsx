"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { obtenerBadgesSidebar } from "@/app/actions/dashboard";
import { obtenerFeaturesUsuario } from "@/lib/suscripcion";
import { tienePermiso } from "@/lib/permisos";
import type { RolOrganizacion } from "@/lib/types/suscripcion";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
  children?: { href: string; label: string }[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(
    pathname.startsWith("/configuracion")
  );
  const [carteraOpen, setCarteraOpen] = useState(
    pathname.startsWith("/pagos")
  );
  const [badges, setBadges] = useState({ glosasUrgentes: 0, facturasBorrador: 0, carteraVencida: 0 });
  const [planFeatures, setPlanFeatures] = useState<{
    rol: RolOrganizacion;
    iaSugerenciasGlosas: boolean;
    importacionSabana: boolean;
    importacionMasiva: boolean;
    botTelegram: boolean;
    maxUsuarios: number;
  } | null>(null);

  useEffect(() => {
    obtenerBadgesSidebar().then(setBadges).catch((e) => console.error("Error cargando badges", e));
    obtenerFeaturesUsuario()
      .then((res) => {
        if (res) setPlanFeatures({
          rol: res.rol as RolOrganizacion,
          ...res.features,
          maxUsuarios: res.maxUsuarios,
        });
      })
      .catch((e) => console.error("Error cargando features", e));
  }, [pathname]);

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      ),
    },
    {
      href: "/",
      label: "Nueva Factura",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      href: "/facturas",
      label: "Facturas",
      badge: badges.facturasBorrador,
      badgeColor: "amber",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      ),
    },
    {
      href: "/pacientes",
      label: "Pacientes",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      href: "/glosas",
      label: "Glosas",
      badge: badges.glosasUrgentes,
      badgeColor: "red",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      href: "/pagos",
      label: "Cartera",
      badge: badges.carteraVencida,
      badgeColor: "red",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
      children: [
        { href: "/pagos", label: "Pendientes" },
        { href: "/pagos/importar", label: "Importar sábana" },
      ],
    },
  ];

  const configItems: NavItem = {
    href: "/configuracion",
    label: "Configuración",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    children: [
      { href: "/configuracion/perfil", label: "Perfil" },
      { href: "/configuracion/acuerdos", label: "Acuerdos" },
      { href: "/configuracion", label: "Tarifas" },
      { href: "/configuracion/suscripcion", label: "Suscripción" },
      { href: "/configuracion/equipo", label: "Equipo" },
      { href: "/configuracion/telegram", label: "Bot Telegram" },
    ],
  };

  // Map routes to required permissions for role-based filtering
  const routePermissions: Record<string, string> = {
    "/": "crear_factura",
    "/facturas": "ver_facturas",
    "/glosas": "ver_glosas",
    "/pagos": "ver_facturas",
  };

  // Filter nav items based on plan features AND role permissions
  const filteredNavItems = planFeatures
    ? navItems
        .filter((item) => {
          if (item.href === "/glosas" && !planFeatures.iaSugerenciasGlosas) return false;
          const permiso = routePermissions[item.href];
          if (permiso && !tienePermiso(planFeatures.rol, permiso)) return false;
          return true;
        })
        .map((item) => {
          if (item.href === "/pagos" && item.children) {
            let children = item.children;
            if (!planFeatures.importacionSabana || !tienePermiso(planFeatures.rol, "importar_sabana")) {
              children = children.filter((c) => c.href !== "/pagos/importar");
            }
            return { ...item, children };
          }
          return item;
        })
    : navItems;

  const filteredConfigItems: NavItem = planFeatures
    ? {
        ...configItems,
        children: configItems.children?.filter((child) => {
          if (child.href === "/configuracion/equipo" && (planFeatures.maxUsuarios <= 1 || !tienePermiso(planFeatures.rol, "gestionar_equipo"))) return false;
          if (child.href === "/configuracion/acuerdos" && !tienePermiso(planFeatures.rol, "gestionar_acuerdos")) return false;
          if (child.href === "/configuracion" && !tienePermiso(planFeatures.rol, "config_organizacion")) return false;
          if (child.href === "/configuracion/suscripcion" && !tienePermiso(planFeatures.rol, "gestionar_billing")) return false;
          return true;
        }),
      }
    : configItems;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-medi-primary text-white shadow-md"
            : "text-medi-dark hover:bg-medi-light/40 hover:text-medi-primary"
        }`}
      >
        <span className="w-5 h-5 flex-shrink-0 relative">
          {item.icon}
          {collapsed && (item.badge ?? 0) > 0 && (
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
              item.badgeColor === "red" ? "bg-red-500" : "bg-amber-500"
            }`} />
          )}
        </span>
        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>{item.label}</span>
        {(item.badge ?? 0) > 0 && (
          <span
            className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${collapsed ? "hidden" : ""} ${
              item.badgeColor === "red"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-medi-light/50 flex items-center gap-3">
        <div className="bg-medi-primary text-white p-2 rounded-lg shadow-lg flex-shrink-0">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <div className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
          <h1 className="text-lg font-bold text-medi-deep">Medibill</h1>
          <p className="text-[9px] text-medi-dark uppercase tracking-widest font-bold">Health-Tech Pasto</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) =>
          item.children ? (
            <div key={item.href}>
              <button
                onClick={() => setCarteraOpen(!carteraOpen)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? "text-medi-primary bg-medi-light/30"
                    : "text-medi-dark hover:bg-medi-light/40 hover:text-medi-primary"
                }`}
              >
                <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>{item.label}</span>
                <svg
                  className={`ml-auto w-4 h-4 flex-shrink-0 transition-all duration-300 ${carteraOpen ? "rotate-180" : ""} ${collapsed ? "opacity-0 w-0" : "opacity-100"}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <div className={`ml-8 mt-1 space-y-0.5 overflow-hidden transition-all duration-300 ${carteraOpen && !collapsed ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 rounded-md text-sm transition-all ${
                      pathname === child.href
                        ? "text-medi-primary font-semibold bg-medi-light/20"
                        : "text-medi-dark/70 hover:text-medi-primary hover:bg-medi-light/20"
                    }`}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            renderNavLink(item)
          )
        )}

        {/* Config with submenu */}
        <div>
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive("/configuracion")
                ? "text-medi-primary bg-medi-light/30"
                : "text-medi-dark hover:bg-medi-light/40 hover:text-medi-primary"
            }`}
          >
            <span className="w-5 h-5 flex-shrink-0">{filteredConfigItems.icon}</span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>{filteredConfigItems.label}</span>
            <svg
              className={`ml-auto w-4 h-4 flex-shrink-0 transition-all duration-300 ${configOpen ? "rotate-180" : ""} ${collapsed ? "opacity-0 w-0" : "opacity-100"}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div className={`ml-8 mt-1 space-y-0.5 overflow-hidden transition-all duration-300 ${configOpen && !collapsed ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
              {filteredConfigItems.children?.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm transition-all ${
                    pathname === child.href
                      ? "text-medi-primary font-semibold bg-medi-light/20"
                      : "text-medi-dark/70 hover:text-medi-primary hover:bg-medi-light/20"
                  }`}
                >
                  {child.label}
                </Link>
              ))}
          </div>
        </div>

        {/* Ayuda */}
        <Link
          href="/ayuda"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isActive("/ayuda")
              ? "bg-medi-primary text-white shadow-md"
              : "text-medi-dark hover:bg-medi-light/40 hover:text-medi-primary"
          }`}
        >
          <span className="w-5 h-5 flex-shrink-0">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </span>
          <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>Ayuda</span>
        </Link>
      </nav>



      {/* Logout */}
      <div className="px-3 py-3 border-t border-medi-light/50">
        <form action={cerrarSesion}>
          <button
            type="submit"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600/70 hover:bg-red-50 hover:text-red-700 transition-all duration-200`}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md border border-medi-light"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-medi-deep">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={`fixed top-0 left-0 h-full bg-white border-r border-medi-light/50 shadow-sm z-40 transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-[68px]" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden absolute top-4 right-3 p-1 rounded-md hover:bg-medi-light/30"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-medi-dark">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {sidebarContent}
      </aside>

      {/* Spacer to push content */}
      <div className={`hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-60"}`} />
    </>
  );
}
