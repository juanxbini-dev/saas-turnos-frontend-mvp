import axiosInstance from '../api/axiosInstance';
import { Producto, CreateProductoData, UpdateProductoData, ProductosStats } from '../types/producto.types';

export const productosService = {
  async getProductos(): Promise<Producto[]> {
    const res = await axiosInstance.get('/api/productos');
    return res.data.data;
  },

  async getStats(): Promise<ProductosStats> {
    const res = await axiosInstance.get('/api/productos/stats');
    return res.data.data;
  },

  async createProducto(data: CreateProductoData): Promise<Producto> {
    const res = await axiosInstance.post('/api/productos', data);
    return res.data.data;
  },

  async updateProducto(id: string, data: UpdateProductoData): Promise<Producto> {
    const res = await axiosInstance.patch(`/api/productos/${id}`, data);
    return res.data.data;
  },

  async addStock(id: string, cantidad: number): Promise<Producto> {
    const res = await axiosInstance.post(`/api/productos/${id}/stock`, { cantidad });
    return res.data.data;
  },
};
