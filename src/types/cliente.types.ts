export interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string | null
  empresa_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CreateClienteData {
  nombre: string
  email: string
  telefono?: string
}

export interface UpdateClienteData {
  nombre?: string
  email?: string
  telefono?: string | null
}

export type TurnoEstadoPerfil = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';

export interface TurnoResumen {
  id: string
  fecha: string
  hora: string
  servicio: string
  profesional_nombre: string | null
  estado: TurnoEstadoPerfil
  total_final: number | null
  metodo_pago: string | null
  notas: string | null
}

export interface ClientePerfilStats {
  total_turnos: number
  total_gastado: number
  proximo_turno: TurnoResumen | null
  ultimo_turno: TurnoResumen | null
}

export interface ProductoComprado {
  id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  metodo_pago: string | null
  vendedor_nombre: string | null
  fecha: string
}

export interface ClientePerfil {
  cliente: Cliente
  stats: ClientePerfilStats
  turnos_recientes: TurnoResumen[]
  productos_comprados: ProductoComprado[]
}
