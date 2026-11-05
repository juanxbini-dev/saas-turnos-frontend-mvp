import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '../api/axiosInstance';
import { Cliente, CreateClienteData, UpdateClienteData, ClientePerfil, ClienteMarketing, ClienteBeneficioCodigo, DecisionEdicion, EdicionPendiente, ResultadoEdicion } from '../types/cliente.types';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { invalidarCacheCampanias } from './campanias.service';

export interface ClientesPaginadosResponse {
  items: Cliente[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
}

export type MotivoDuplicado = 'email' | 'telefono_mismo_nombre' | 'telefono_otro_nombre' | 'nombre';

export interface ClienteDuplicado {
  cliente: Cliente;
  mensaje: string;
  motivo?: MotivoDuplicado;
  /** Se puede crear la ficha igual. El mail repetido no lo permite. */
  permiteCrearIgual: boolean;
}

/**
 * Si el error proviene de intentar crear un cliente con un email/teléfono que ya
 * existe, el backend devuelve el cliente existente en `data.cliente`. Devuelve esa
 * info para poder mostrar un aviso y ofrecer usar el cliente existente, o null si
 * no es un caso de duplicado.
 */
export function getClienteDuplicado(error: any): ClienteDuplicado | null {
  const data = error?.response?.data;
  if (data?.cliente) {
    return {
      cliente: data.cliente as Cliente,
      mensaje: data.message || 'Ya existe un cliente con esos datos',
      motivo: data.motivo,
      permiteCrearIgual: data.permite_crear_igual === true
    };
  }
  return null;
}

export const clienteService = {
  async getClientes(pagina = 1, porPagina = 20, busqueda?: string): Promise<ClientesPaginadosResponse> {
    const params: Record<string, any> = { pagina, por_pagina: porPagina };
    if (busqueda) params.busqueda = busqueda;
    const response = await axiosInstance.get('/api/clientes', { params });
    return {
      items: response.data.data,
      ...response.data.meta
    };
  },

  async getMisClientes(usuarioId?: string): Promise<Cliente[]> {
    const params = usuarioId ? { usuarioId } : undefined;
    const response = await axiosInstance.get('/api/clientes/mis-clientes', { params });
    return response.data.data;
  },

  async createCliente(data: CreateClienteData): Promise<Cliente> {
    const response = await axiosInstance.post('/api/clientes', data);
    // Si la búsqueda cacheada no la encuentra, la vuelven a cargar y nace un duplicado
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    return response.data.data;
  },

  async updateCliente(id: string, data: UpdateClienteData): Promise<Cliente> {
    const response = await axiosInstance.put(`/api/clientes/${id}`, data);
    // Un cambio de teléfono o de nombre cambia a quién le llega la campaña
    invalidarCacheCampanias();
    return response.data.data;
  },

  async deleteCliente(id: string): Promise<void> {
    await axiosInstance.delete(`/api/clientes/${id}`);
    invalidarCacheCampanias();
  },

  // Alta y baja manual de las novedades por WhatsApp. recibe:false lo puede
  // hacer cualquiera del equipo; recibe:true solo admin o super_admin (403).
  async actualizarMarketing(id: string, recibe: boolean): Promise<ClienteMarketing> {
    const response = await axiosInstance.patch(`/api/clientes/${id}/marketing`, { recibe });
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    invalidarCacheCampanias();
    return response.data.data;
  },

  async getPerfilCliente(id: string): Promise<ClientePerfil> {
    const response = await axiosInstance.get(`/api/clientes/${id}/perfil`);
    return response.data.data;
  },

  // Códigos de beneficio vigentes (emitidos) del cliente. Sin cache: la lista
  // cambia con cada reserva o cobro y se consulta solo al elegir el cliente.
  async getBeneficios(id: string): Promise<ClienteBeneficioCodigo[]> {
    const response = await axiosInstance.get(`/api/clientes/${encodeURIComponent(id)}/beneficios`);
    return response.data.data?.items ?? [];
  },

  // Lo pedido con "Editar datos" en la reserva web. Solo admin o super_admin.
  async getEdicionesPendientes(): Promise<EdicionPendiente[]> {
    // Si falla, no se le abre a cada admin el modal de reportar a soporte: el aviso no se muestra y listo
    const response = await axiosInstance.get('/api/clientes/ediciones-pendientes', { _sinReporteGlobal: true } as AxiosRequestConfig);
    return response.data.data;
  },

  // ids: los pedidos que se tenían a la vista. Uno que llegó después no se resuelve sin verlo.
  async resolverEdicion(id: string, decision: DecisionEdicion, ids: string[]): Promise<ResultadoEdicion> {
    const response = await axiosInstance.post(`/api/clientes/${encodeURIComponent(id)}/ediciones-pendientes`, { decision, ids });
    // Un cambio de teléfono o de nombre cambia a quién le llega la campaña
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    invalidarCacheCampanias();
    return response.data.data;
  }
};
