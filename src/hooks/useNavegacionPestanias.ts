import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';

// Teclado para una fila de pestañas (patrón "tabs" de accesibilidad):
// flechas izquierda/derecha pasan a la pestaña de al lado (dando la vuelta),
// Inicio/Fin van a la primera/última. Mueven el foco Y eligen la pestaña.
// Solo la pestaña activa entra en el recorrido con Tab (tabIndex 0); las demás
// quedan en -1 y se alcanzan con las flechas.
export function useNavegacionPestanias<T extends string>(
  ids: readonly T[],
  activa: T,
  elegir: (id: T) => void
) {
  const botones = useRef(new Map<T, HTMLButtonElement>());

  const registrar = useCallback((id: T) => (el: HTMLButtonElement | null) => {
    if (el) botones.current.set(id, el);
    else botones.current.delete(id);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, desde: T) => {
    const n = ids.length;
    const i = ids.indexOf(desde);
    if (n === 0 || i === -1) return;

    let destino: number;
    switch (e.key) {
      case 'ArrowRight': destino = (i + 1) % n; break;
      case 'ArrowLeft': destino = (i - 1 + n) % n; break;
      case 'Home': destino = 0; break;
      case 'End': destino = n - 1; break;
      default: return;
    }
    e.preventDefault();
    const id = ids[destino];
    elegir(id);
    botones.current.get(id)?.focus();
  };

  const tabIndex = (id: T) => (id === activa ? 0 : -1);

  return { registrar, onKeyDown, tabIndex };
}
