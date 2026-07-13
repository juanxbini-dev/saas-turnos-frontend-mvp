export interface Producto {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  // El backend devuelve el precio efectivo (derivado de la config o override manual).
  // Los flags *_manual indican si el precio es un override cargado a mano.
  precio_efectivo: number | null;
  precio_transferencia: number | null;
  precio_tarjeta: number | null;
  precio_efectivo_manual?: boolean;
  precio_transferencia_manual?: boolean;
  precio_tarjeta_manual?: boolean;
  costo: number | null;
  stock: number;
  activo: boolean;
  marca_id: string | null;
  marca_nombre: string | null;
  created_at: string;
  updated_at: string;
}

// Precio null = usar el derivado de la configuración general
export interface CreateProductoData {
  nombre: string;
  descripcion?: string;
  precio_efectivo?: number | null;
  precio_transferencia?: number | null;
  precio_tarjeta?: number | null;
  costo: number;
  stock: number;
  marca_id?: string | null;
}

export interface UpdateProductoData {
  nombre?: string;
  descripcion?: string;
  precio_efectivo?: number | null;
  precio_transferencia?: number | null;
  precio_tarjeta?: number | null;
  costo?: number;
  stock?: number;
  activo?: boolean;
  marca_id?: string | null;
}

// Porcentajes de ganancia sobre el costo por método de pago (config por empresa)
export interface ConfiguracionProductos {
  empresa_id: string;
  pct_efectivo: number;
  pct_transferencia: number;
  pct_tarjeta: number;
  updated_at?: string;
}

export interface UpdateConfiguracionProductosData {
  pct_efectivo: number;
  pct_transferencia: number;
  pct_tarjeta: number;
}

export interface ProductoVentaFinanzas {
  producto_id: string;
  nombre: string;
  precio_efectivo: number | null;
  precio_transferencia: number | null;
  costo: number | null;
  total_unidades: number;
  unidades_efectivo: number;
  unidades_transferencia: number;
  unidades_pendiente: number;
  total_efectivo: number;
  total_transferencia: number;
  total_pendiente: number;
  total_comision: number;
  total_neto_vendedor: number;
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
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'pendiente';
  notas?: string;
  fecha_venta?: string;
  items: {
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    es_venta_costo?: boolean;
    precio_costo?: number;
  }[];
}
