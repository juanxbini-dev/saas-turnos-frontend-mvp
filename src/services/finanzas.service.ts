import axiosInstance from '../api/axiosInstance';
import { FinanzasFilters, FinanzasResponse } from '../types/finanzas.types';

export const finanzasService = {
  /**
   * Obtener finanzas del usuario autenticado (staff)
   */
  async getMyFinanzas(filters: FinanzasFilters): Promise<FinanzasResponse> {
    const params = new URLSearchParams();
    
    // Agregar filtros como query params
    params.append('fecha_desde', filters.fecha_desde);
    params.append('fecha_hasta', filters.fecha_hasta);
    params.append('tipo', filters.tipo);
    params.append('metodo_pago', filters.metodo_pago);
    params.append('estado_comision', filters.estado_comision);
    params.append('ordenar_por', filters.ordenar_por);
    params.append('orden', filters.orden);
    params.append('pagina', filters.pagina.toString());
    params.append('por_pagina', filters.por_pagina.toString());

    const response = await axiosInstance.get(`/api/finanzas/me?${params.toString()}`);
    return response.data;
  },

  /**
   * Obtener finanzas de un profesional específico (solo admin)
   */
  async getFinanzasByProfesional(
    profesionalId: string, 
    filters: FinanzasFilters
  ): Promise<FinanzasResponse> {
    const params = new URLSearchParams();
    
    // Agregar filtros como query params
    params.append('fecha_desde', filters.fecha_desde);
    params.append('fecha_hasta', filters.fecha_hasta);
    params.append('tipo', filters.tipo);
    params.append('metodo_pago', filters.metodo_pago);
    params.append('estado_comision', filters.estado_comision);
    params.append('ordenar_por', filters.ordenar_por);
    params.append('orden', filters.orden);
    params.append('pagina', filters.pagina.toString());
    params.append('por_pagina', filters.por_pagina.toString());

    const response = await axiosInstance.get(
      `/api/finanzas/profesional/${profesionalId}?${params.toString()}`
    );
    return response.data;
  },

  // 'tarjeta' solo es válido para cobros de productos (tipos venta/venta_turno o metodo_pago_productos).
  // 'canje' = gratis: el backend fuerza los montos a 0.
  async cobrarPago(
    tipo: 'turno' | 'turno_solo_servicio' | 'venta_turno' | 'venta',
    id: string,
    metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'canje',
    metodo_pago_productos?: 'efectivo' | 'transferencia' | 'tarjeta' | 'canje'
  ): Promise<void> {
    await axiosInstance.patch('/api/finanzas/cobrar', { tipo, id, metodo_pago, metodo_pago_productos });
  },
};
