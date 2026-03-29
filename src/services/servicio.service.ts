import axiosInstance from '../api/axiosInstance';
import { Servicio, UsuarioServicio, CreateServicioData, UpdateServicioData, UpdateMiServicioData } from '../types/servicio.types';

export const servicioService = {
  async getServicios(): Promise<Servicio[]> {
    const response = await axiosInstance.get('/api/servicios');
    return response.data.data;
  },

  async createServicio(data: CreateServicioData): Promise<Servicio> {
    const response = await axiosInstance.post('/api/servicios', data);
    return response.data.data;
  },

  async updateServicio(id: string, data: UpdateServicioData): Promise<Servicio> {
    const response = await axiosInstance.put(`/api/servicios/${id}`, data);
    return response.data.data;
  },

  async toggleActivo(id: string, activo: boolean): Promise<Servicio> {
    const response = await axiosInstance.put(`/api/servicios/${id}/activo`, { activo });
    return response.data.data;
  },

  async deleteServicio(id: string): Promise<void> {
    await axiosInstance.delete(`/api/servicios/${id}`);
  },

  async suscribirse(servicioId: string, usuarioId?: string): Promise<UsuarioServicio> {
    const body = usuarioId ? { usuario_id: usuarioId } : {};
    const response = await axiosInstance.post(`/api/servicios/${servicioId}/suscribirse`, body);
    return response.data.data;
  },

  async desuscribirse(servicioId: string, usuarioId?: string): Promise<void> {
    await axiosInstance.delete(`/api/servicios/${servicioId}/suscribirse`, {
      data: usuarioId ? { usuario_id: usuarioId } : undefined
    });
  },

  async getMisServicios(usuarioId?: string): Promise<UsuarioServicio[]> {
    const params = usuarioId ? { usuarioId } : undefined;
    const response = await axiosInstance.get('/api/servicios/mis-servicios', { params });
    return response.data.data;
  },

  async updateMiServicio(id: string, data: UpdateMiServicioData): Promise<UsuarioServicio> {
    const response = await axiosInstance.put(`/api/servicios/mis-servicios/${id}`, data);
    return response.data.data;
  }
};
