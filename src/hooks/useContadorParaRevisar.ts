import { useEffect, useSyncExternalStore } from 'react';
import {
  claveContadorParaRevisar,
  getEstadoContador,
  refrescarContadorParaRevisar,
  suscribirContadorParaRevisar,
} from '../services/puntuaciones.service';

// Cuántas puntuaciones Regular/Malo quedan sin revisar (aviso del menú y de la
// pestaña Puntuaciones). El número vive en un solo lugar (el store del servicio
// de puntuaciones): aunque lo muestren varios componentes, se pide una sola vez,
// con cache corto y un único refresco al volver a la ventana. Al marcar algo como
// revisado el servicio publica el número nuevo y se ve al instante en todos lados.
// Solo se suscribe si `habilitado` (super admin): al resto el backend le da 403,
// así que no se pide nada, ni al montar ni al volver a la ventana.

const sinSuscripcion = () => () => {};

export function useContadorParaRevisar(habilitado: boolean) {
  const estado = useSyncExternalStore(
    habilitado ? suscribirContadorParaRevisar : sinSuscripcion,
    getEstadoContador
  );

  const clave = habilitado ? claveContadorParaRevisar() : null;

  useEffect(() => {
    if (!clave) return;
    void refrescarContadorParaRevisar();
  }, [clave]);

  // Un número de otra empresa (cambio de sesión) no se muestra
  const vigente = !!clave && estado.clave === clave;

  return {
    pendientes: vigente ? (estado.pendientes ?? 0) : 0,
    loading: !!clave && estado.loading,
    error: vigente ? estado.error : null,
    revalidate: () => { if (clave) void refrescarContadorParaRevisar(true); },
  };
}
