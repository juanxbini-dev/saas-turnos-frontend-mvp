export interface Producto {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  activo: boolean;
  marca_id: string | null;
  marca_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductoData {
  nombre: string;
  descripcion?: string;
  precio: number;
  stock: number;
  marca_id?: string | null;
}

export interface UpdateProductoData {
  nombre?: string;
  descripcion?: string;
  precio?: number;
  activo?: boolean;
  marca_id?: string | null;
}

export interface TopProducto {
  producto_id: string;
  nombre: string;
  total_vendido: number;
  total_ingresos: number;
}

export interface TopVendedor {
  vendedor_id: string;
  nombre: string;
  total_vendido: number;
  total_ingresos: number;
}

export interface ProductosStats {
  top_productos: TopProducto[];
  top_vendedores: TopVendedor[];
  bajo_stock_count: number;
}

// Para el modal de finalizar turno y vender directo
export interface VentaItemInput {
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface CreateVentaData {
  cliente_id?: string | null;
  vendedor_id: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'pendiente';
  notas?: string;
  items: {
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}
