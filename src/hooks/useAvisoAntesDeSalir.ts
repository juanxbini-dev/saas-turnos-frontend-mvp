import { useEffect } from 'react';

/**
 * Mientras `activo` sea true, el navegador pide confirmación al cerrar o recargar la pestaña
 * (evento `beforeunload`). El listener se quita cuando `activo` pasa a false o al desmontar.
 * No bloquea la navegación interna del router.
 */
export function useAvisoAntesDeSalir(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores viejos necesitan returnValue seteado para mostrar el diálogo
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activo]);
}
