export interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  empresa_id: string
  activo: boolean
  created_at: string
  updated_at: string
  // Novedades por WhatsApp. Solo vienen en el perfil (GET /clientes/:id/perfil),
  // no en los listados.
  marketing_consentimiento_at?: string | null
  marketing_consentimiento_origen?: string | null
  marketing_baja_at?: string | null
  marketing_baja_origen?: MarketingBajaOrigen | null
  recibe_campanias?: boolean
}

export type MarketingBajaOrigen = 'whatsapp' | 'panel' | 'reserva_web'

// Respuesta de PATCH /api/clientes/:id/marketing
export interface ClienteMarketing {
  marketing_consentimiento_at: string | null
  marketing_consentimiento_origen: string | null
  marketing_baja_at: string | null
  marketing_baja_origen: MarketingBajaOrigen | null
  recibe_campanias: boolean
}

export interface CreateClienteData {
  nombre: string
  email?: string
  telefono?: string
  // Solo en el alta: "Me autorizó a enviarle novedades por WhatsApp"
  marketing_consentimiento?: boolean
}

export interface UpdateClienteData {
  nombre?: string
  email?: string | null
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
