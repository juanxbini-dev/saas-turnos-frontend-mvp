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
