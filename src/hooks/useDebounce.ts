import { useEffect, useState } from 'react';

/**
 * Devuelve una versión "retrasada" del valor: solo se actualiza cuando el valor
 * deja de cambiar durante `delay` ms. Útil para no disparar una petición al
 * servidor en cada tecla (ej: buscadores con búsqueda server-side).
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
