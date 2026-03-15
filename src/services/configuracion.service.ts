import axiosInstance from '../api/axiosInstance';
import { LandingConfig, LandingProfesional, LandingPublicaData, Horario } from '../types/landing.types';

export const configuracionService = {
  async getConfig(): Promise<LandingConfig> {
    const res = await axiosInstance.get('/api/configuracion');
    return res.data.data;
  },

  async updateConfig(data: { titulo?: string; descripcion?: string; direccion?: string; horarios?: Horario[] }): Promise<LandingConfig> {
    const res = await axiosInstance.patch('/api/configuracion', data);
    return res.data.data;
  },

  async uploadLogo(file: File): Promise<LandingConfig> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axiosInstance.post('/api/configuracion/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data;
  },

  async uploadFondo(file: File): Promise<LandingConfig> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axiosInstance.post('/api/configuracion/fondo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data;
  },

  async getProfesionales(): Promise<LandingProfesional[]> {
    const res = await axiosInstance.get('/api/configuracion/profesionales');
    return res.data.data;
  },

  async updateProfesional(usuarioId: string, data: { descripcion?: string; visible?: boolean }): Promise<LandingProfesional> {
    const res = await axiosInstance.patch(`/api/configuracion/profesionales/${usuarioId}`, data);
    return res.data.data;
  },

  async updateOrden(orden: { usuarioId: string; orden: number }[]): Promise<void> {
    await axiosInstance.patch('/api/configuracion/profesionales-orden', { orden });
  },

  async getLandingPublica(empresaSlug: string): Promise<LandingPublicaData> {
    const res = await axiosInstance.get(`/public/landing/${empresaSlug}`);
    return res.data.data;
  }
};
