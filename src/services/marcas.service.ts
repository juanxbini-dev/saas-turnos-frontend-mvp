import axiosInstance from '../api/axiosInstance';
import { Marca, MarcaConProductos, CreateMarcaData, UpdateMarcaData } from '../types/marca.types';

export const marcasService = {
  async getMarcas(): Promise<MarcaConProductos[]> {
    const res = await axiosInstance.get('/api/marcas');
    return res.data.data;
  },

  async createMarca(data: CreateMarcaData): Promise<Marca> {
    const res = await axiosInstance.post('/api/marcas', data);
    return res.data.data;
  },

  async updateMarca(id: string, data: UpdateMarcaData): Promise<Marca> {
    const res = await axiosInstance.patch(`/api/marcas/${id}`, data);
    return res.data.data;
  },

  async deleteMarca(id: string): Promise<{ productosAfectados: number }> {
    const res = await axiosInstance.delete(`/api/marcas/${id}`);
    return res.data.data;
  },
};
