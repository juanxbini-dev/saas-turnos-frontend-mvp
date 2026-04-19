export type TurnoEstado = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';
export type MetodoPago = 'efectivo' | 'transferencia' | 'pendiente';

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
  // Nuevos campos financieros
  metodo_pago?: MetodoPago;
  precio_original?: number;
  descuento_porcentaje?: number;
  descuento_monto?: number;
  total_final?: number;
  finalizado_at?: string;
  finalizado_por_id?: string;
  // Campo calculado: suma de productos vendidos en el turno (viene del calendario)
  total_productos?: number;
  // Origen del turno
  origen?: 'web' | 'interno';
  // Notificaciones
  confirmacion_whatsapp_enviada?: boolean;
  recordatorio_enviado?: boolean;
}

export interface TurnoConDetalle extends Turno {
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono?: string;
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
  created_at: string;
  updated_at: string;
}

export interface ExcepcionDia {
  id: string;
  profesional_id: string;
  fecha: string;
  disponible: boolean;
  tipo: 'reemplazo' | 'adicional';
  hora_inicio: string | null;
  hora_fin: string | null;
  intervalo_minutos: number | null;
  notas: string | null;
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
  servicio_id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
  precio_personalizado?: number;
  duracion_personalizada?: number;
}

export interface DescuentoAplicarA {
  servicio: boolean;
  productos: boolean;
}

export interface FinalizarTurnoData {
  metodoPago: MetodoPago;
  precioModificado?: number;
  descuentoPorcentaje?: number;
  descuentoAplicarA?: DescuentoAplicarA;
  productos?: VentaProductoData[];
}

export interface EditarPagoData {
  metodoPago: MetodoPago;
  precioModificado?: number;
  descuentoPorcentaje?: number;
  descuentoAplicarA?: DescuentoAplicarA;
  productos?: VentaProductoData[];
}

export interface VentaProductoData {
  id: string;
  producto_id?: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  metodo_pago?: 'efectivo' | 'transferencia';
  // Precios por método guardados al agregar — permiten recalcular sin depender del catálogo
  _precio_efectivo?: number;
  _precio_transferencia?: number;
}

export interface CalculoCompletoTurno {
  precioOriginalServicio: number;
  precioOriginalProductos: number;
  subtotalOriginal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  totalConDescuento: number;
  comisionServicio: {
    base: number;
    porcentajeEmpresa: number;
    montoEmpresa: number;
    netoProfesional: number;
  };
  comisionProductos: {
    base: number;
    porcentajeEmpresa: number;
    montoEmpresa: number;
    netoProfesional: number;
  };
  totales: {
    totalRecaudado: number;
    totalEmpresa: number;
    totalProfesional: number;
  };
}
