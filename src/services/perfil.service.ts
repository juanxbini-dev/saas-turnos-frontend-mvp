import axiosInstance from '../api/axiosInstance';
import { Usuario } from '../types/usuario.types';

export const perfilService = {
  async getProfile(): Promise<Usuario> {
    const response = await axiosInstance.get('/api/perfil/me');
    return response.data.data;
  },

  async uploadAvatar(file: File): Promise<Usuario> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await axiosInstance.post('/api/perfil/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data.data;
  },

  async deleteAvatar(): Promise<Usuario> {
    const response = await axiosInstance.delete('/api/perfil/avatar');
    return response.data.data;
  }
};
