import axiosInstance from '../api/axiosInstance';
import { Cliente, CreateClienteData, UpdateClienteData, ClientePerfil } from '../types/cliente.types';

export interface ClientesPaginadosResponse {
  items: Cliente[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
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
    return response.data.data;
  },

  async deleteCliente(id: string): Promise<void> {
    await axiosInstance.delete(`/api/clientes/${id}`);
  },

  async getPerfilCliente(id: string): Promise<ClientePerfil> {
    const response = await axiosInstance.get(`/api/clientes/${id}/perfil`);
    return response.data.data;
  }
};
