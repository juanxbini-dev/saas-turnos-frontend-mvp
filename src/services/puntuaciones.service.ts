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

// --- Contador "Para revisar" (un solo origen para toda la app) ---
//
// El número se muestra en el menú (escritorio y celular), en la pestaña de
// Métricas y en "Para revisar". Antes cada uno lo pedía por su cuenta; ahora
// todos se suscriben a este store, que hace UN solo pedido a la vez, lo guarda
// en el cache corto y lo refresca una sola vez al volver a la ventana.
// Solo se activa cuando hay alguien suscripto (los componentes se suscriben
// únicamente si el usuario es super admin: al resto el backend le da 403).

export interface EstadoContador {
  clave: string | null;        // de qué empresa es el número
  pendientes: number | null;   // null = todavía no llegó
  loading: boolean;
  error: Error | null;
}

const ESTADO_INICIAL: EstadoContador = { clave: null, pendientes: null, loading: false, error: null };

let estadoContador: EstadoContador = ESTADO_INICIAL;
const suscriptores = new Set<() => void>();
let pedidoEnVuelo: Promise<void> | null = null;
// Sube con cada número nuevo (del servidor o publicado al marcar). Una respuesta
// de un pedido que salió ANTES de un cambio llega vieja y se descarta.
let versionContador = 0;

function cambiarEstado(parcial: Partial<EstadoContador>): void {
  estadoContador = { ...estadoContador, ...parcial };
  suscriptores.forEach((s) => s());
}

function guardarNumero(clave: string, pendientes: number): void {
  versionContador += 1;
  cacheService.set(clave, pendientes, TTL.SHORT);
  cambiarEstado({ clave, pendientes, loading: false, error: null });
}

export function getEstadoContador(): EstadoContador {
  return estadoContador;
}

// Pide el número al servidor. Si ya hay un pedido en vuelo, se suma a ese.
// Sin `forzar`, usa el cache corto si todavía sirve.
export function refrescarContadorParaRevisar(forzar = false): Promise<void> {
  const clave = claveContadorParaRevisar();
  if (pedidoEnVuelo) return pedidoEnVuelo;

  if (!forzar) {
    const enCache = cacheService.get<number>(clave);
    if (enCache !== null) {
      if (estadoContador.clave !== clave || estadoContador.pendientes !== enCache) {
        cambiarEstado({ clave, pendientes: enCache, loading: false, error: null });
      }
      return Promise.resolve();
    }
  }

  const versionAlPedir = versionContador;
  cambiarEstado({
    clave,
    pendientes: estadoContador.clave === clave ? estadoContador.pendientes : null,
    loading: true,
    error: null,
  });
  pedidoEnVuelo = puntuacionesService.getContadorParaRevisar()
    .then((pendientes) => {
      // Si mientras tanto se marcó algo, lo publicado es más nuevo que esta respuesta
      if (versionContador !== versionAlPedir) cambiarEstado({ loading: false });
      else guardarNumero(clave, pendientes);
    })
    .catch((error: unknown) => {
      console.error('[puntuaciones] No se pudo pedir el contador para revisar', error);
      if (versionContador !== versionAlPedir) { cambiarEstado({ loading: false }); return; }
      cambiarEstado({ loading: false, error: error instanceof Error ? error : new Error(String(error)) });
    })
    .finally(() => { pedidoEnVuelo = null; });
  return pedidoEnVuelo;
}

const alVolverALaVentana = () => { void refrescarContadorParaRevisar(true); };

// Para useSyncExternalStore. El refresco al volver a la ventana existe solo
// mientras haya alguien suscripto, y es uno solo para todos.
export function suscribirContadorParaRevisar(suscriptor: () => void): () => void {
  suscriptores.add(suscriptor);
  if (suscriptores.size === 1) window.addEventListener('focus', alVolverALaVentana);
  return () => {
    suscriptores.delete(suscriptor);
    if (suscriptores.size === 0) window.removeEventListener('focus', alVolverALaVentana);
  };
}

function publicarContador(pendientes: number): void {
  guardarNumero(claveContadorParaRevisar(), pendientes);
}

// Solo para tests: deja el store como recién cargada la app
export function reiniciarContadorParaRevisar(): void {
  estadoContador = ESTADO_INICIAL;
  pedidoEnVuelo = null;
  versionContador += 1;   // un pedido viejo que llegue tarde se descarta
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
