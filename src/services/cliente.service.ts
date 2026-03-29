import axiosInstance from '../api/axiosInstance';
import { Cliente, CreateClienteData, UpdateClienteData } from '../types/cliente.types';

export const clienteService = {
  async getClientes(): Promise<Cliente[]> {
    const response = await axiosInstance.get('/api/clientes');
    return response.data.data;
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

  async toggleActivo(id: string, activo: boolean): Promise<Cliente> {
    const response = await axiosInstance.put(`/api/clientes/${id}/activo`, { activo });
    return response.data.data;
  }
};
