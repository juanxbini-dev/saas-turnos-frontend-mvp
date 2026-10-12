import { useEffect, useSyncExternalStore } from 'react';
import {
  claveContadorAvisos,
  getEstadoContadorAvisos,
  refrescarContadorAvisos,
  suscribirContadorAvisos,
} from '../services/avisos.service';

// Cuántos clientes esperan que alguien del salón les escriba ("Para contactar"). El número
// vive en el store del servicio de avisos: aunque lo muestren el menú y la pantalla, se pide
// una sola vez. Solo se suscribe si `habilitado` (recepción, admin o super admin): a un
// profesional el backend le da 403, así que no se pide nada.

const sinSuscripcion = () => () => {};

export function useContadorParaContactar(habilitado: boolean) {
  const estado = useSyncExternalStore(
    habilitado ? suscribirContadorAvisos : sinSuscripcion,
    getEstadoContadorAvisos
  );

  const clave = habilitado ? claveContadorAvisos() : null;

  useEffect(() => {
    if (!clave) return;
    void refrescarContadorAvisos();
  }, [clave]);

  // Un número de otra empresa (cambio de sesión) no se muestra
  const vigente = !!clave && estado.clave === clave;
  const contador = vigente ? estado.contador : null;

  return {
    pendientes: contador?.pendientes ?? 0,
    alta: contador?.alta ?? 0,
    media: contador?.media ?? 0,
    loading: !!clave && estado.loading,
    error: vigente ? estado.error : null,
    revalidate: () => { if (clave) void refrescarContadorAvisos(true); },
  };
}
