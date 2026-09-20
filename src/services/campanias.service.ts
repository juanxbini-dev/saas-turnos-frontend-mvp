import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import type {
  Campania,
  CampaniaMetricas,
  CampaniaMetricasPeriodo,
  CampaniaPatch,
  CampaniasAccesoFallo,
  CampaniaTipo,
  EnviosFiltros,
  EnviosRespuesta,
  PaginacionMeta,
  VistaPreviaFiltros,
  VistaPreviaRespuesta,
} from '../types/campanias.types';

// Mismo patrón que Gastos: el token de la sección vive en sessionStorage (muere
// al cerrar la pestaña, no queda en disco) y solo se inyecta como
// X-Campanias-Token en los requests de /api/campanias. Es un token distinto al
// de Gastos: uno no abre la otra sección.
const STORAGE_KEY = 'campaniasToken';
const BASE = '/api/campanias';

export function getCampaniasToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearCampaniasToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

const conToken = () => {
  const token = getCampaniasToken();
  return { headers: token ? { 'X-Campanias-Token': token } : {} };
};

interface ErrorHttp {
  response?: {
    status?: number;
    data?: { message?: string; code?: string; retry_after?: number };
  };
}

// Traduce el error de axios al fallo tipado que consume el gate
function traducirFallo(error: unknown): CampaniasAccesoFallo {
  const response = (error as ErrorHttp)?.response;
  const status = response?.status;

  if (status === 429) {
    return {
      tipo: 'demasiados_intentos',
      mensaje: response?.data?.message || 'Demasiados intentos. Probá de nuevo más tarde.',
      segundosRestantes: response?.data?.retry_after,
    };
  }
  if (status === 503) {
    return { tipo: 'no_configurado', mensaje: 'La sección no está configurada. Avisale a soporte.' };
  }
  if (status === 401) {
    return { tipo: 'password_incorrecta', mensaje: 'Contraseña incorrecta' };
  }
  return { tipo: 'error', mensaje: 'No se pudo validar el acceso. Intentá de nuevo.' };
}

// ¿Este error es el backend rechazando el token de la sección (vencido, ajeno a
// la sesión o ausente)? El middleware responde 401/403 con code
// CAMPANIAS_TOKEN_*. El interceptor de axiosInstance trata todo 401 como JWT
// vencido, refresca y reintenta una vez; si el token de la sección sigue
// vencido el reintento vuelve a fallar y el error llega acá. Quien lo reciba
// delega en CampaniasGate (useCampaniasGate().bloquear).
export function esFalloTokenCampanias(error: unknown): boolean {
  const response = (error as ErrorHttp | null)?.response;
  const status = response?.status;
  const code = response?.data?.code;
  return (status === 401 || status === 403) && typeof code === 'string' && code.startsWith('CAMPANIAS_TOKEN');
}

// Mensaje del backend si vino, para mostrarlo en toasts de error
export function mensajeDeError(error: unknown, porDefecto: string): string {
  return (error as ErrorHttp | null)?.response?.data?.message || porDefecto;
}

// Todo lo cacheado de campañas depende de lo mismo (config, servicios, fichas
// de clientes): ante cualquier cambio se tira el prefijo completo.
export function invalidarCacheCampanias(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
}

const META_VACIA: PaginacionMeta = { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 };

// Quita claves vacías para no mandar `motivo=` o `busqueda=` en la query
function limpiarParams(params: Record<string, string | number | undefined | null>): Record<string, string | number> {
  const limpio: Record<string, string | number> = {};
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') limpio[clave] = valor;
  }
  return limpio;
}

export const campaniasService = {
  // ------------------------------------------------------------------ Acceso

  async validarAcceso(password: string): Promise<void> {
    try {
      const response = await axiosInstance.post(`${BASE}/acceso`, { password });
      const token = response.data?.data?.token;
      if (!token) throw new Error('El backend no devolvió el token de campañas');
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch (error) {
      clearCampaniasToken();
      throw traducirFallo(error);
    }
  },

  // ¿El token guardado sigue siendo válido? Se llama al montar la página.
  async verificarAcceso(): Promise<boolean> {
    if (!getCampaniasToken()) return false;
    try {
      await axiosInstance.get(`${BASE}/ping`, conToken());
      return true;
    } catch {
      clearCampaniasToken();
      return false;
    }
  },

  // ---------------------------------------------------------------- Campaña

  async getCampania(tipo: CampaniaTipo): Promise<Campania> {
    const response = await axiosInstance.get(`${BASE}/${tipo}`, conToken());
    return response.data.data;
  },

  async actualizarCampania(tipo: CampaniaTipo, cambios: CampaniaPatch): Promise<Campania> {
    const response = await axiosInstance.patch(`${BASE}/${tipo}`, cambios, conToken());
    invalidarCacheCampanias();
    return response.data.data;
  },

  // ------------------------------------------------------------ Vista previa

  async getVistaPrevia(tipo: CampaniaTipo, filtros: VistaPreviaFiltros): Promise<VistaPreviaRespuesta> {
    const params = limpiarParams({
      grupo: filtros.grupo,
      // `motivo` solo es válido con grupo=no_recibe (§3.3)
      motivo: filtros.grupo === 'no_recibe' ? filtros.motivo : undefined,
      busqueda: filtros.busqueda?.trim(),
      pagina: filtros.pagina,
      por_pagina: filtros.por_pagina ?? 20,
    });
    const response = await axiosInstance.get(`${BASE}/${tipo}/vista-previa`, { ...conToken(), params });
    const data = response.data.data;
    return {
      fecha: data.fecha,
      resumen: data.resumen,
      items: data.items ?? [],
      meta: response.data.meta ?? META_VACIA,
    };
  },

  // --------------------------------------------------------------- Historial

  async getEnvios(tipo: CampaniaTipo, filtros: EnviosFiltros): Promise<EnviosRespuesta> {
    const params = limpiarParams({
      pagina: filtros.pagina,
      por_pagina: filtros.por_pagina ?? 20,
      estado: filtros.estado,
      fecha_desde: filtros.fecha_desde,
      fecha_hasta: filtros.fecha_hasta,
      busqueda: filtros.busqueda?.trim(),
    });
    const response = await axiosInstance.get(`${BASE}/${tipo}/envios`, { ...conToken(), params });
    // La spec §3.4 muestra solo la forma del ítem. Se acepta tanto `data: []`
    // (como GET /api/clientes) como `data: { items: [] }` (como la vista previa).
    const data = response.data.data;
    const items = Array.isArray(data) ? data : data?.items ?? [];
    return { items, meta: response.data.meta ?? META_VACIA };
  },

  // -------------------------------------------------------------- Resultados

  async getMetricas(tipo: CampaniaTipo, periodo: CampaniaMetricasPeriodo): Promise<CampaniaMetricas> {
    const response = await axiosInstance.get(`${BASE}/${tipo}/metricas`, {
      ...conToken(),
      params: { fecha_desde: periodo.fecha_desde, fecha_hasta: periodo.fecha_hasta },
    });
    return response.data.data;
  },
};
