export type TurnoEstado = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';

export interface Turno {
  id: string;
  cliente_id: string;
  usuario_id: string;
  servicio_id: string;
  fecha: string;
  hora: string;
  estado: TurnoEstado;
  notas: string | null;
  servicio: string;
  precio: number;
  duracion_minutos: number;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

export interface TurnoConDetalle extends Turno {
  cliente_nombre: string;
  cliente_email: string;
  usuario_nombre: string;
  usuario_username: string;
}

export interface CreateTurnoData {
  cliente_id: string;
  usuario_id: string;
  servicio_id: string;
  fecha: string;
  hora: string;
  notas?: string;
}

export interface DisponibilidadSemanal {
  id: string;
  profesional_id: string;
  dia_inicio: number;
  dia_fin: number;
  hora_inicio: string;
  hora_fin: string;
  intervalo_minutos: number;
  activo: boolean;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

export interface DiasVacacion {
  id: string;
  profesional_id: string;
  fecha: string;
  fecha_fin: string | null;
  tipo: 'vacacion' | 'feriado' | 'personal' | 'enfermedad';
  motivo: string | null;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

export interface ExcepcionDia {
  id: string;
  profesional_id: string;
  fecha: string;
  disponible: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  intervalo_minutos: number | null;
  notas: string | null;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profesional {
  id: string;
  nombre: string;
  username: string;
  email: string;
  roles: string[];
  activo: boolean;
}

export interface ServicioProfesional {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
  precio_personalizado?: number;
  duracion_personalizada?: number;
}
