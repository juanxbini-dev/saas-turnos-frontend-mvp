import axiosInstance from '../api/axiosInstance';
import { CreateVentaData } from '../types/producto.types';

export const ventasService = {
  async createVenta(data: CreateVentaData) {
    const res = await axiosInstance.post('/api/ventas', data);
    return res.data.data;
  },
};
