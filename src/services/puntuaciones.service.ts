import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import type {
  MiPuntuacion,
  NivelPuntaje,
  PuntuacionesFiltros,
  PuntuacionesLista,
  PuntuacionesPeriodo,
  PuntuacionesResumen,
} from '../types/puntuaciones.types';

// Puntuaciones de "Gracias por venir". Van con el login de siempre: NO llevan
// la contraseña de la sección Campañas (viven en Métricas y en el Perfil).
// El detalle (resumen, lista, contador, revisar) es solo del super admin;
// `/mia` es de cualquier usuario y solo trae su promedio.
const BASE = '/api/puntuaciones';

export const NIVEL_TEXTO: Record<NivelPuntaje, string> = {
  4: 'Excelente',
  3: 'Bueno',
  2: 'Regular',
  1: 'Malo',
};

export const NIVELES: NivelPuntaje[] = [4, 3, 2, 1];

export const esBajo = (puntaje: number): boolean => puntaje <= 2;

// '3,6 de 4' (o '—' sin puntajes). Un decimal: suficiente para leerlo de un vistazo.
export function formatPromedio(promedio: number | null | undefined, conEscala = true): string {
  if (promedio === null || promedio === undefined || !Number.isFinite(promedio)) return '—';
  const texto = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(promedio);
  return conEscala ? `${texto} de 4` : texto;
}

// --- Cache ---

export const claveContadorParaRevisar = () => buildKey(ENTITIES.PUNTUACIONES, 'para-revisar', 'contador');

// El contador se muestra en el menú (otro componente): cuando cambia se avisa a
// quien esté escuchando, además de dejarlo en el cache.
type Oyente = (pendientes: number) => void;
const oyentes = new Set<Oyente>();

export function escucharContadorParaRevisar(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

function publicarContador(pendientes: number): void {
  cacheService.set(claveContadorParaRevisar(), pendientes, TTL.SHORT);
  oyentes.forEach((o) => o(pendientes));
}

export function invalidarCachePuntuaciones(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
}

// Quita claves vacías para no mandar `usuario_id=` en la query
function limpiarParams(params: Record<string, string | number | boolean | undefined | null>): Record<string, string | number | boolean> {
  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') limpio[clave] = valor;
  }
  return limpio;
}

export const puntuacionesService = {
  async getResumen(periodo: PuntuacionesPeriodo): Promise<PuntuacionesResumen> {
    const response = await axiosInstance.get(`${BASE}/resumen`, {
      params: { fecha_desde: periodo.fecha_desde, fecha_hasta: periodo.fecha_hasta },
    });
    return response.data.data;
  },

  async getLista(filtros: PuntuacionesFiltros): Promise<PuntuacionesLista> {
    const params = limpiarParams({
      fecha_desde: filtros.fecha_desde,
      fecha_hasta: filtros.fecha_hasta,
      solo_bajos: filtros.solo_bajos === undefined ? undefined : String(filtros.solo_bajos),
      revision: filtros.revision,
      usuario_id: filtros.usuario_id,
      pagina: filtros.pagina,
      por_pagina: filtros.por_pagina ?? 20,
    });
    const response = await axiosInstance.get(BASE, { params });
    const data = response.data.data ?? {};
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      pagina: data.pagina ?? filtros.pagina,
      por_pagina: data.por_pagina ?? filtros.por_pagina ?? 20,
    };
  },

  async getContadorParaRevisar(): Promise<number> {
    const response = await axiosInstance.get(`${BASE}/para-revisar/contador`);
    return Number(response.data.data?.pendientes ?? 0);
  },

  // Marca (o desmarca) un Regular/Malo como revisado. Devuelve los pendientes al día.
  async marcarRevisado(id: string, revisado: boolean): Promise<number> {
    const response = await axiosInstance.patch(`${BASE}/${id}`, { revisado });
    const pendientes = Number(response.data.data?.pendientes ?? 0);
    invalidarCachePuntuaciones();
    publicarContador(pendientes);
    return pendientes;
  },

  async getMia(): Promise<MiPuntuacion> {
    const response = await axiosInstance.get(`${BASE}/mia`);
    return response.data.data;
  },
};
