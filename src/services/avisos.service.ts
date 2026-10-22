import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import type {
  AvisoDetalle,
  AvisosFiltros,
  AvisosLista,
  ClasificacionAviso,
  ContadorAvisos,
} from '../types/avisos.types';

// "Para contactar" (spec de productos §11.1 y §11.3). Va con el login de siempre: lo ven
// recepción, admin y super admin; a un profesional el backend le responde 403.
const BASE = '/api/avisos';

/** Roles que ven "Para contactar" (los mismos que acepta el backend: ROLES_AVISOS). */
export const ROLES_PARA_CONTACTAR = ['recepcion', 'admin', 'super_admin'] as const;

export function puedeVerParaContactar(roles: readonly string[] | null | undefined): boolean {
  return !!roles && roles.some((r) => (ROLES_PARA_CONTACTAR as readonly string[]).includes(r));
}

/** "Para contactar" vive como pestaña de Productos (la usa recepción; Campañas queda detrás
 *  de la contraseña de super admin). Los links viejos a /para-contactar redirigen acá. */
export const PARAM_TAB_PRODUCTOS = 'tab';
export const TAB_PARA_CONTACTAR = 'para-contactar';
export const RUTA_PARA_CONTACTAR = `/productos?${PARAM_TAB_PRODUCTOS}=${TAB_PARA_CONTACTAR}`;

export const AVISOS_POR_PAGINA = 20;
export const MAX_NOTA_AVISO = 1000;

// --- Cache ---

export const claveContadorAvisos = () => buildKey(ENTITIES.AVISOS, 'contador');

export function invalidarCacheAvisos(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.AVISOS));
}

// --- Contador de pendientes (un solo origen para toda la app) ---
//
// Mismo patrón que el de "Para revisar" de puntuaciones: el menú lateral (escritorio y
// celular) y la pantalla se suscriben a este store, que hace UN pedido a la vez, lo guarda en
// el cache corto y lo refresca una sola vez al volver a la ventana. Al clasificar un aviso, el
// PATCH devuelve el contador al día y se publica acá: se ve al instante en todos lados.

export interface EstadoContadorAvisos {
  clave: string | null;                 // de qué empresa es el número
  contador: ContadorAvisos | null;      // null = todavía no llegó
  loading: boolean;
  error: Error | null;
}

const ESTADO_INICIAL: EstadoContadorAvisos = { clave: null, contador: null, loading: false, error: null };

let estado: EstadoContadorAvisos = ESTADO_INICIAL;
const suscriptores = new Set<() => void>();
let pedidoEnVuelo: Promise<void> | null = null;
// Sube con cada número nuevo: una respuesta de un pedido que salió antes de un cambio se descarta
let version = 0;

function cambiarEstado(parcial: Partial<EstadoContadorAvisos>): void {
  estado = { ...estado, ...parcial };
  suscriptores.forEach((s) => s());
}

function guardarContador(clave: string, contador: ContadorAvisos): void {
  version += 1;
  cacheService.set(clave, contador, TTL.SHORT);
  cambiarEstado({ clave, contador, loading: false, error: null });
}

function normalizarContador(crudo: unknown): ContadorAvisos {
  const c = (crudo ?? {}) as Partial<Record<keyof ContadorAvisos, unknown>>;
  return {
    pendientes: Number(c.pendientes ?? 0) || 0,
    alta: Number(c.alta ?? 0) || 0,
    media: Number(c.media ?? 0) || 0,
  };
}

export function getEstadoContadorAvisos(): EstadoContadorAvisos {
  return estado;
}

export function refrescarContadorAvisos(forzar = false): Promise<void> {
  const clave = claveContadorAvisos();
  if (pedidoEnVuelo) return pedidoEnVuelo;

  if (!forzar) {
    const enCache = cacheService.get<ContadorAvisos>(clave);
    if (enCache !== null) {
      if (estado.clave !== clave || estado.contador !== enCache) {
        cambiarEstado({ clave, contador: enCache, loading: false, error: null });
      }
      return Promise.resolve();
    }
  }

  const versionAlPedir = version;
  cambiarEstado({ clave, contador: estado.clave === clave ? estado.contador : null, loading: true, error: null });
  pedidoEnVuelo = avisosService.getContador()
    .then((contador) => {
      if (version !== versionAlPedir) cambiarEstado({ loading: false });
      else guardarContador(clave, contador);
    })
    .catch((error: unknown) => {
      console.error('[avisos] No se pudo pedir el contador de Para contactar', error);
      if (version !== versionAlPedir) { cambiarEstado({ loading: false }); return; }
      cambiarEstado({ loading: false, error: error instanceof Error ? error : new Error(String(error)) });
    })
    .finally(() => { pedidoEnVuelo = null; });
  return pedidoEnVuelo;
}

const alVolverALaVentana = () => { void refrescarContadorAvisos(true); };

export function suscribirContadorAvisos(suscriptor: () => void): () => void {
  suscriptores.add(suscriptor);
  if (suscriptores.size === 1) window.addEventListener('focus', alVolverALaVentana);
  return () => {
    suscriptores.delete(suscriptor);
    if (suscriptores.size === 0) window.removeEventListener('focus', alVolverALaVentana);
  };
}

export function publicarContadorAvisos(contador: ContadorAvisos): void {
  guardarContador(claveContadorAvisos(), contador);
}

// Solo para tests: deja el store como recién cargada la app
export function reiniciarContadorAvisos(): void {
  estado = ESTADO_INICIAL;
  pedidoEnVuelo = null;
  version += 1;
}

// --- Errores del PATCH, en lenguaje del salón ---

interface ErrorHttp {
  response?: { status?: number; data?: { message?: string; code?: string } };
}

export type FalloClasificar = 'ya_resuelto' | 'no_existe' | 'datos' | 'sin_permiso' | 'otro';

export function tipoDeFallo(error: unknown): FalloClasificar {
  const response = (error as ErrorHttp | null)?.response;
  if (response?.status === 409 || response?.data?.code === 'AVISO_RESUELTO') return 'ya_resuelto';
  if (response?.status === 404) return 'no_existe';
  if (response?.status === 400) return 'datos';
  if (response?.status === 403) return 'sin_permiso';
  return 'otro';
}

export const MENSAJE_FALLO: Record<FalloClasificar, string> = {
  ya_resuelto: 'Este cliente ya reservó o compró, así que el aviso se cerró solo. No hace falta clasificarlo.',
  no_existe: 'Este aviso ya no está. Actualizamos la lista.',
  datos: 'Faltan datos: si lo contactaste, elegí qué pasó; con «Otro», contá en la nota qué pasó.',
  sin_permiso: 'Tu usuario no puede marcar avisos. Pedile a un administrador que lo haga.',
  otro: 'No se pudo guardar. Probá de nuevo.',
};

// --- API ---

export const avisosService = {
  async getLista(filtros: AvisosFiltros): Promise<AvisosLista> {
    const porPagina = filtros.por_pagina ?? AVISOS_POR_PAGINA;
    const response = await axiosInstance.get(BASE, {
      params: { estado: filtros.estado, pagina: filtros.pagina, por_pagina: porPagina },
    });
    const data = response.data?.data ?? {};
    return {
      items: data.items ?? [],
      total: Number(data.total ?? 0) || 0,
      pagina: Number(data.pagina ?? filtros.pagina) || filtros.pagina,
      por_pagina: Number(data.por_pagina ?? porPagina) || porPagina,
    };
  },

  async getContador(): Promise<ContadorAvisos> {
    const response = await axiosInstance.get(`${BASE}/contador`);
    return normalizarContador(response.data?.data);
  },

  // "Contactado" / no contestó / descartado. Devuelve el aviso al día y publica el contador.
  async clasificar(id: string, clasificacion: ClasificacionAviso): Promise<AvisoDetalle> {
    const body: Record<string, unknown> = { estado: clasificacion.estado };
    if (clasificacion.estado === 'contactado') body.resultado = clasificacion.resultado ?? null;
    const nota = clasificacion.nota?.trim();
    if (nota) body.nota = nota;
    const response = await axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}`, body);
    const data = response.data?.data ?? {};
    invalidarCacheAvisos();
    if (data.contador) publicarContadorAvisos(normalizarContador(data.contador));
    else void refrescarContadorAvisos(true);
    return data.aviso;
  },
};
