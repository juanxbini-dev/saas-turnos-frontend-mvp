import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import type {
  Beneficio,
  BeneficioConCodigos,
  CodigoEmitido,
  CodigosFiltros,
  CodigosRespuesta,
  CrearBeneficioData,
  EditarBeneficioData,
} from '../types/beneficios.types';

// Beneficios y códigos de descuento (backend/docs/mails-beneficios-plan.md §4.4).
// Solo admin: el backend responde 403 a los demás roles.
const BASE = '/api/beneficios';

interface ErrorHttp {
  response?: {
    status?: number;
    data?: { message?: string; code?: string };
  };
}

// Código de error del backend (BENEFICIO_CON_CODIGOS, BENEFICIO_REQUERIDO, …), si vino
export function codigoDeError(error: unknown): string | undefined {
  return (error as ErrorHttp | null)?.response?.data?.code;
}

// Mensaje del backend si vino, para mostrarlo en toasts de error
export function mensajeDeErrorBeneficios(error: unknown, porDefecto: string): string {
  return (error as ErrorHttp | null)?.response?.data?.message || porDefecto;
}

// Lista, contadores de códigos y tablas de códigos cambian con cualquier
// mutación: ante un cambio se tira el prefijo completo.
export function invalidarCacheBeneficios(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
}

// La config de la campaña "Lista vieja" muestra el beneficio elegido (nombre,
// %, activo): crear o editar un beneficio la deja vieja.
function invalidarConfigListaVieja(): void {
  cacheService.invalidate(buildKey(ENTITIES.CAMPANIAS, 'lista_vieja', 'config'));
}

// Quita claves vacías para no mandar `estado=` o `busqueda=` en la query
function limpiarParams(params: Record<string, string | number | undefined | null>): Record<string, string | number> {
  const limpio: Record<string, string | number> = {};
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') limpio[clave] = valor;
  }
  return limpio;
}

export const beneficiosService = {
  async listar(): Promise<BeneficioConCodigos[]> {
    const response = await axiosInstance.get(BASE);
    const data = response.data.data;
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async crear(data: CrearBeneficioData): Promise<Beneficio> {
    const response = await axiosInstance.post(BASE, data);
    invalidarCacheBeneficios();
    invalidarConfigListaVieja();
    return response.data.data;
  },

  async editar(id: string, data: EditarBeneficioData): Promise<Beneficio> {
    const response = await axiosInstance.patch(`${BASE}/${id}`, data);
    invalidarCacheBeneficios();
    invalidarConfigListaVieja();
    return response.data.data;
  },

  async getCodigos(beneficioId: string, filtros: CodigosFiltros): Promise<CodigosRespuesta> {
    const params = limpiarParams({
      estado: filtros.estado,
      busqueda: filtros.busqueda?.trim(),
      pagina: filtros.pagina,
      por_pagina: filtros.por_pagina ?? 20,
    });
    const response = await axiosInstance.get(`${BASE}/${beneficioId}/codigos`, { params });
    const data = response.data.data;
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      pagina: data?.pagina ?? filtros.pagina,
      por_pagina: data?.por_pagina ?? filtros.por_pagina ?? 20,
    };
  },

  // Emisión manual desde el panel: manda el mail si el cliente tiene mail.
  // Si ya tenía un código vivo, el backend devuelve ese (`ya_existia: true`).
  async emitirCodigo(beneficioId: string, clienteId: string): Promise<CodigoEmitido> {
    const response = await axiosInstance.post(`${BASE}/${beneficioId}/codigos`, { cliente_id: clienteId });
    invalidarCacheBeneficios();
    return response.data.data;
  },

  // Solo desde 'emitido'
  async anularCodigo(codigoId: string): Promise<{ id: string; estado: 'anulado' }> {
    const response = await axiosInstance.post(`${BASE}/codigos/${codigoId}/anular`);
    invalidarCacheBeneficios();
    return response.data.data;
  },
};
