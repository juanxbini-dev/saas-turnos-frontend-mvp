// Item individual dentro de una venta agrupada
export interface VentaItemFinanzas {
  id: string;
  nombre_producto: string;
  cantidad: number;
  precio_total: number;
  comision_porcentaje: number;
  comision_monto: number;
  neto_vendedor: number;
}

// Venta de producto agrupada por transacción
export interface VentaGrupadaFinanzas {
  tipo: 'venta_producto';
  id: string;
  venta_grupo_id: string;
  turno_id: string | null;
  fecha: string;
  metodo_pago: string;
  total: number;
  comision_monto: number;
  neto_vendedor: number;
  cliente_nombre: string | null;
  vendedor_nombre: string;
  empresa_id: string;
  items: VentaItemFinanzas[];
}

// Representa un registro de comisión por turno finalizado (solo servicio)
export interface ComisionProfesional {
  id: string;
  turno_id: string;
  profesional_id: string;
  empresa_id: string;
  // Servicio
  servicio_monto: number;
  servicio_comision_porcentaje: number;
  servicio_comision_monto: number;
  servicio_neto_profesional: number;
  // Estado
  estado: 'pendiente' | 'pagada' | 'cancelada';
  fecha_pago: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Datos del turno (JOIN para display)
  tipo: 'turno';
  turno_fecha: string;
  turno_hora: string;
  turno_estado: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'pendiente';
  precio_original: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  total_final: number;
  // Datos relacionados (JOIN)
  cliente_nombre: string;
  servicio_nombre: string;
  profesional_nombre?: string;
}

export type EntradaFinanzas = ComisionProfesional | VentaGrupadaFinanzas;

export interface FinanzasSummary {
  total_venta: number;
  total_venta_servicios: number;
  total_venta_productos: number;
  total_comision_empresa: number;
  total_comision_empresa_servicios: number;
  total_comision_empresa_productos: number;
  total_neto_profesional: number;
  total_neto_profesional_servicios: number;
  total_neto_profesional_productos: number;
  total_descuentos: number;
  cantidad_turnos: number;
  cantidad_productos_vendidos: number;
  promedio_por_turno: number;
  total_pendiente: number;
}

export interface FinanzasFilters {
  periodo: 'dia' | 'semana' | 'mes' | 'anio' | 'custom';
  fecha_desde: string;
  fecha_hasta: string;
  metodo_pago: 'todos' | 'efectivo' | 'transferencia' | 'pendiente';
  estado_comision: 'todos' | 'pendiente' | 'pagada' | 'cancelada';
  ordenar_por: 'fecha' | 'total_venta' | 'total_neto_profesional';
  orden: 'asc' | 'desc';
  pagina: number;
  por_pagina: number;
}

export interface FinanzasResponse {
  items: EntradaFinanzas[];
  summary: FinanzasSummary;
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
}
