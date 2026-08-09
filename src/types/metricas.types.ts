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

// --- Clientes nuevos: quiénes son y qué profesional eligieron ---

export interface MetricasClienteNuevoItem {
  cliente_id: string;
  cliente_nombre: string;
  telefono: string | null;
  fecha_primera_visita: string; // YYYY-MM-DD
  profesional_id: string | null;
  profesional_nombre: string | null;
  servicio: string;
  origen: 'web' | 'interno' | null;
  volvio: boolean;
}

export interface MetricasClientesNuevosPorProfesional {
  profesional_id: string;
  nombre: string;
  avatar_url: string | null;
  clientes_nuevos: number;
}

export interface MetricasClientesNuevos {
  total: number;
  por_profesional: MetricasClientesNuevosPorProfesional[];
  clientes: MetricasClienteNuevoItem[];
}

// --- Comparativa detallada de profesionales ---

export interface MetricasServicioDesglose {
  servicio: string;
  cantidad: number;
  facturado: number;
}

export interface MetricasComparativaItem {
  profesional_id: string;
  nombre: string;
  username: string;
  avatar_url: string | null;
  facturado: number;
  facturado_servicios: number;
  facturado_productos: number;
  neto_profesional: number;
  comision_empresa: number;
  pendiente_cobro: number;
  turnos_completados: number;
  turnos_cancelados: number;
  tasa_cancelacion: number;
  ticket_promedio: number;
  productos_vendidos: number;
  clientes_atendidos: number;
  clientes_nuevos: number;
  clientes_recurrentes: number;
  tasa_recurrencia: number;
  horas_trabajadas: number;
  facturacion_por_hora: number;
  servicios: MetricasServicioDesglose[];
  evolucion: MetricasEvolucionPunto[];
}
