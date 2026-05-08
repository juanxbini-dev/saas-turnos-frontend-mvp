import axiosInstance from '../api/axiosInstance';
import { Producto, CreateProductoData, UpdateProductoData, ProductosStats, ProductoVentaFinanzas } from '../types/producto.types';

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

  async deleteProducto(id: string): Promise<void> {
    await axiosInstance.delete(`/api/productos/${id}`);
  },

  async getVentasFinanzas(fechaDesde?: string, fechaHasta?: string): Promise<ProductoVentaFinanzas[]> {
    const params: Record<string, string> = {};
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const res = await axiosInstance.get('/api/productos/ventas-finanzas', { params });
    return res.data.data;
  },
};

export async function getRegistroVentas(params: {
  fechaDesde: string;
  fechaHasta: string;
  vendedor_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: any[]; total: number }> {
  const searchParams = new URLSearchParams({
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  if (params.vendedor_id) searchParams.set('vendedor_id', params.vendedor_id);
  const res = await axiosInstance.get(`/api/ventas?${searchParams}`);
  return { rows: res.data.data, total: res.data.total };
}

export async function updateVentaProducto(
  id: string,
  data: {
    nombre_producto?: string;
    cantidad?: number;
    precio_unitario?: number;
    precio_total?: number;
    metodo_pago?: string;
    fecha_venta?: string;
  }
): Promise<any> {
  const res = await axiosInstance.patch(`/api/ventas/${id}`, data);
  return res.data.data;
}

export async function deleteVentaProducto(id: string): Promise<void> {
  await axiosInstance.delete(`/api/ventas/${id}`);
}
