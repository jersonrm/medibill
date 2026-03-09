"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

/** Rutas donde NO se muestra el sidebar */
const NO_SIDEBAR_ROUTES = ["/login", "/onboarding", "/invitacion"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_ROUTES.some((r) => pathname.startsWith(r));
  const [trialDias, setTrialDias] = useState<number | null>(null);

  useEffect(() => {
    if (!showSidebar) return;
    // Leer trial info de cookie set por middleware o fetch ligero
    const fetchTrial = async () => {
      try {
        const res = await fetch("/api/trial-status");
        if (res.ok) {
          const data = await res.json();
          if (data.trialing && data.diasRestantes != null) {
            setTrialDias(data.diasRestantes);
          }
        }
      } catch (e) {
        console.warn("[LayoutShell] Trial status fetch failed", e instanceof Error ? e.message : e);
      }
    };
    fetchTrial();
  }, [showSidebar]);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {trialDias !== null && trialDias >= 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-amber-800">
              Te quedan <strong>{trialDias}</strong> {trialDias === 1 ? "día" : "días"} de prueba gratuita
            </span>
            <Link
              href="/configuracion/suscripcion/seleccionar-plan"
              className="px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium transition-colors"
            >
              Elegir plan
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
