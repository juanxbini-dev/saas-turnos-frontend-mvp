import { useEffect, useState } from 'react';
import { useFetch } from './useFetch';
import { TTL } from '../cache/ttl';
import {
  claveContadorParaRevisar,
  escucharContadorParaRevisar,
  puntuacionesService,
} from '../services/puntuaciones.service';

// Cuántas puntuaciones Regular/Malo quedan sin revisar (aviso del menú y de la
// pestaña Puntuaciones). Solo pide si `habilitado` (super admin): para el resto
// el backend responde 403. Cache corto y se refresca al volver a la pestaña del
// navegador; al marcar algo como revisado el servicio publica el número nuevo
// y se ve al instante, sin esperar al cache.
export function useContadorParaRevisar(habilitado: boolean) {
  const { data, loading, error, revalidate } = useFetch(
    habilitado ? claveContadorParaRevisar() : null,
    () => puntuacionesService.getContadorParaRevisar(),
    { ttl: TTL.SHORT, revalidateOnFocus: true }
  );

  const [publicado, setPublicado] = useState<number | null>(null);

  useEffect(() => {
    if (!habilitado) return;
    return escucharContadorParaRevisar(setPublicado);
  }, [habilitado]);

  // Lo que llegue del servidor después pisa a lo publicado
  useEffect(() => { setPublicado(null); }, [data]);

  return {
    pendientes: habilitado ? (publicado ?? data ?? 0) : 0,
    loading,
    error,
    revalidate,
  };
}
