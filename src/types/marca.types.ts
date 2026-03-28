export interface Marca {
  id: string;
  empresa_id: string;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface MarcaConProductos extends Marca {
  total_productos: number;
}

export interface CreateMarcaData {
  nombre: string;
}

export interface UpdateMarcaData {
  nombre: string;
}
