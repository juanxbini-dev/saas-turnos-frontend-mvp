import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import type {
  ContactoVigente,
  DecisionPar,
  FiltroDecision,
  ListaDuplicados,
  OrdenDuplicados,
  UnificacionActiva,
} from '../types/clienteDuplicados.types';

// Unificar y deshacer cambian fichas: la lista de clientes queda vieja
const invalidarClientes = () => cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));

export const clienteDuplicadosService = {
  async listar(filtro: FiltroDecision, orden: OrdenDuplicados): Promise<ListaDuplicados> {
    // Si falla, no se abre el modal de reportar a soporte: la sección muestra su propio aviso
    const response = await axiosInstance.get('/api/clientes/duplicados', {
      params: { decision: filtro, orden },
      _sinReporteGlobal: true,
    } as AxiosRequestConfig);
    return response.data.data;
  },

  async listarUnificaciones(): Promise<UnificacionActiva[]> {
    const response = await axiosInstance.get('/api/clientes/duplicados/unificaciones', {
      _sinReporteGlobal: true,
    } as AxiosRequestConfig);
    return response.data.data;
  },

  async revisar(clienteAId: string, clienteBId: string, decision: DecisionPar): Promise<void> {
    await axiosInstance.post('/api/clientes/duplicados/revision', {
      cliente_a_id: clienteAId,
      cliente_b_id: clienteBId,
      decision,
    });
  },

  async unificar(principalId: string, unificadaId: string, contactoVigente: ContactoVigente): Promise<string> {
    const response = await axiosInstance.post('/api/clientes/duplicados/unificar', {
      principal_id: principalId,
      unificada_id: unificadaId,
      contacto_vigente: contactoVigente,
    });
    invalidarClientes();
    return response.data.data.unificacion_id;
  },

  async deshacer(unificacionId: string): Promise<void> {
    await axiosInstance.post(`/api/clientes/duplicados/unificaciones/${encodeURIComponent(unificacionId)}/deshacer`);
    invalidarClientes();
  },
};
