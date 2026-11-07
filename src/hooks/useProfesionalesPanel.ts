import { useMemo } from 'react';
import { useFetch } from './useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { disponibilidadService } from '../services/disponibilidad.service';
import type { Profesional } from '../types/turno.types';

// Profesionales del panel (GET /api/usuarios/profesionales, solo admin): la
// misma consulta y la misma clave de cache que el alta de turno y el Dashboard.
// Se sacan los super_admin, igual que en el selector del Dashboard. La
// respuesta viene como `{ data: { profesionales } }` (o `{ data: [] }` en
// respuestas viejas): se aceptan las dos.

export function profesionalesDeRespuesta(respuesta: unknown): Profesional[] {
  const data = (respuesta as { data?: unknown } | null)?.data;
  const lista = Array.isArray(data)
    ? data
    : Array.isArray((data as { profesionales?: unknown } | null)?.profesionales)
      ? (data as { profesionales: unknown[] }).profesionales
      : [];
  return (lista as Profesional[]).filter(
    (p) => !!p && typeof p.id === 'string' && !(p.roles ?? []).includes('super_admin') && p.activo !== false
  );
}

export function useProfesionalesPanel(habilitado = true) {
  const { data, loading, error, revalidate } = useFetch(
    habilitado ? buildKey(ENTITIES.PROFESIONALES) : null,
    () => disponibilidadService.getProfesionales({ limit: 100 }),
    { ttl: TTL.MEDIUM }
  );
  const profesionales = useMemo(() => profesionalesDeRespuesta(data), [data]);
  return { profesionales, loading: habilitado && loading, error, revalidate };
}
