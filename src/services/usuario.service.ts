import axiosInstance from '../api/axiosInstance';
import { Usuario, CreateUsuarioData, UpdateDatosData, UsuarioRol } from '../types/usuario.types';

export const usuarioService = {
  async getUsuarios(): Promise<Usuario[]> {
    const response = await axiosInstance.get('/api/usuarios');
    return response.data.data;
  },

  async createUsuario(data: CreateUsuarioData): Promise<Usuario> {
    const response = await axiosInstance.post('/api/usuarios', data);
    return response.data.data;
  },

  async updateDatos(id: string, data: UpdateDatosData): Promise<Usuario> {
    const response = await axiosInstance.put(`/api/usuarios/${id}/datos`, data);
    return response.data.data;
  },

  async updatePassword(id: string, data: { passwordActual: string, passwordNueva: string }): Promise<void> {
    await axiosInstance.put(`/api/usuarios/${id}/password`, data);
  },

  async updateRol(id: string, rol: UsuarioRol): Promise<Usuario> {
    const response = await axiosInstance.put(`/api/usuarios/${id}/rol`, { rol });
    return response.data.data;
  },

  async toggleActivo(id: string, activo: boolean): Promise<Usuario> {
    const response = await axiosInstance.put(`/api/usuarios/${id}/activo`, { activo });
    return response.data.data;
  }
};
