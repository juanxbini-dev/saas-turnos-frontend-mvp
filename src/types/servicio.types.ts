export interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  duracion: number
  precio_base: number | null
  precio_minimo: number | null
  precio_maximo: number | null
  empresa_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioServicio {
  id: string
  usuario_id: string
  servicio_id: string
  empresa_id: string
  precio_personalizado: number | null
  duracion_personalizada: number | null
  habilitado: boolean
  nivel_habilidad: string | null
  notas: string | null
  created_at: string
  updated_at: string
  // Campos del JOIN con servicios (sin alias - igual que backend)
  nombre: string
  descripcion: string | null
  precio: number | null
  duracion_minutos: number
  // Campos de validación del servicio base
  precio_base: number | null
  precio_minimo: number | null
  precio_maximo: number | null
}

export interface CreateServicioData {
  nombre: string
  descripcion?: string
  duracion: number
  precio_base?: number
  precio_minimo?: number
  precio_maximo?: number
}

export interface UpdateServicioData extends Partial<CreateServicioData> {}

export interface UpdateMiServicioData {
  precio_personalizado?: number | null
  duracion_personalizada?: number | null
  habilitado?: boolean
  nivel_habilidad?: string | null
  notas?: string | null
}
