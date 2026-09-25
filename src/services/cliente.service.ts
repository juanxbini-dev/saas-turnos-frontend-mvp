import axiosInstance from '../api/axiosInstance';
import { Cliente, CreateClienteData, UpdateClienteData, ClientePerfil, ClienteMarketing } from '../types/cliente.types';
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

export interface ClienteDuplicado {
  cliente: Cliente;
  mensaje: string;
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
      mensaje: data.message || 'Ya existe un cliente con esos datos'
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
  }
};
