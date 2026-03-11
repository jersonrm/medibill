import { useEffect } from "react";

/**
 * Muestra confirmación del navegador al intentar cerrar/recargar la pestaña
 * cuando hay datos sin guardar.
 */
export function useBeforeUnload(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);
}
