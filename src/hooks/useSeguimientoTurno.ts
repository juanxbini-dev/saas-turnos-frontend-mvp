import { useCallback } from 'react';
import { useFetch } from './useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { turnoService } from '../services/turno.service';
import { SeguimientoTurno } from '../types/seguimiento.types';

export interface UseSeguimientoTurnoResult {
  data: SeguimientoTurno | null;
  loading: boolean;
  /** Mensaje listo para mostrar, o null si no hubo error */
  error: string | null;
  reintentar: () => void;
}

// Texto para el usuario según el error de la API. 404 = no existe o no lo puede
// ver (el backend no distingue a propósito).
export function mensajeErrorSeguimiento(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404) return 'No encontramos este turno o no tenés acceso a su detalle.';
  return 'No pudimos cargar cómo se sacó el turno. Probá de nuevo en un rato.';
}

/**
 * Seguimiento de un turno (cómo se sacó y qué pasó con sus mensajes).
 * - Con el modal cerrado (`open=false`) o sin id no pide nada.
 * - Cache con TTL corto (1 min, igual que turnos) para que los estados de los
 *   mensajes (entregado/leído) se refresquen. Es solo lectura: nada lo invalida.
 */
export function useSeguimientoTurno(turnoId: string | null | undefined, open: boolean): UseSeguimientoTurnoResult {
  const activo = open && !!turnoId;
  const key = activo ? buildKey(ENTITIES.SEGUIMIENTO, turnoId as string) : null;

  const fetcher = useCallback(() => turnoService.getSeguimiento(turnoId as string), [turnoId]);
  const { data, loading, error, revalidate } = useFetch<SeguimientoTurno>(key, fetcher, { ttl: TTL.SHORT });

  if (!activo) {
    return { data: null, loading: false, error: null, reintentar: () => {} };
  }

  // useFetch conserva la data anterior mientras busca la nueva: si es de otro
  // turno no se muestra (evita ver un segundo el detalle del turno anterior).
  const dataDelTurno = data && data.turno?.id === turnoId ? data : null;

  return {
    data: dataDelTurno,
    // Entre el render que abre el modal y el efecto que dispara el pedido no hay
    // ni data ni error: eso también es "cargando".
    loading: loading || (!dataDelTurno && !error),
    error: error ? mensajeErrorSeguimiento(error) : null,
    reintentar: revalidate,
  };
}
