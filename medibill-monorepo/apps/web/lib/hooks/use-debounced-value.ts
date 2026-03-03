"use client";

import { useState, useEffect } from "react";

/**
 * Hook que devuelve el valor con un retraso (debounce).
 * Útil para evitar recálculos costosos en cada keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
