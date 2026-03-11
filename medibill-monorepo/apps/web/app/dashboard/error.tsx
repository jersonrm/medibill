"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <h2 className="text-xl font-bold text-medi-deep mb-2">Error en el dashboard</h2>
      <p className="text-sm text-medi-dark/60 mb-6">
        Ocurrió un error inesperado. El equipo ha sido notificado automáticamente.
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 text-sm font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent transition-all"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
