// Métricas de negocio a nivel empresa (solo admin)

export interface MetricasResumen {
  total_venta: number;
  total_venta_servicios: number;
  total_venta_productos: number;
  total_pendiente: number;
  turnos_completados: number;
  turnos_cancelados: number;
  tasa_cancelacion: number; // % sobre (completados + cancelados)
  ticket_promedio: number;
  cantidad_productos_vendidos: number;
  clientes_activos: number;
  clientes_nuevos: number;
}

export type MetricasAgrupacion = 'dia' | 'mes';

export interface MetricasEvolucionPunto {
  fecha: string; // YYYY-MM-DD (dia) o YYYY-MM (mes)
  total: number;
  servicios: number;
  productos: number;
}

export interface MetricasEquipoItem {
  profesional_id: string;
  nombre: string;
  username: string;
  avatar_url: string | null;
  facturado: number;
  facturado_servicios: number;
  facturado_productos: number;
  neto_profesional: number;
  turnos_completados: number;
  turnos_cancelados: number;
  ticket_promedio: number;
}

export interface MetricasPeriodo {
  fecha_desde: string;
  fecha_hasta: string;
}
