import { useEffect, useState } from "react";

/**
 * Trails a fast-changing value by `delay` ms.
 *
 * Used for search inputs so typing "northwind" fires one request instead of
 * nine. The immediate value still drives the input, so typing stays responsive.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
