import axiosInstance from '../api/axiosInstance';
import { Turno, TurnoConDetalle, CreateTurnoData, FinalizarTurnoData } from '../types/turno.types';

export const turnoService = {
  async getTurnos(): Promise<TurnoConDetalle[]> {
    const response = await axiosInstance.get('/api/turnos');
    return response.data.data;
  },

  async getCalendario(
    profesionalId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<TurnoConDetalle[]> {
    try {
      console.log('🔍 [turnoService] Haciendo petición a:', `/api/turnos/calendario?profesionalId=${profesionalId}&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
      
      const res = await axiosInstance.get(
        `/api/turnos/calendario?profesionalId=${profesionalId}&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}` 
      );
      
      console.log('✅ [turnoService] Respuesta completa:', {
        status: res.status,
        data: res.data,
        turnos: res.data.data,
        cantidad: res.data.data?.length || 0
      });
      
      return res.data.data;
    } catch (error: any) {
      console.error('❌ [turnoService] Error en petición:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Si el endpoint calendario no existe (404), usar getTurnos como fallback
      if (error.response?.status === 404) {
        console.warn('🔄 [turnoService] Endpoint /calendario no encontrado, usando getTurnos como fallback');
        const allTurnos = await this.getTurnos();
        
        // Filtrar por profesional y rango de fechas
        return allTurnos.filter(turno => {
          const turnoFecha = new Date(turno.fecha);
          const inicio = new Date(fechaInicio);
          const fin = new Date(fechaFin);
          
          return turno.usuario_id === profesionalId &&
                 turnoFecha >= inicio &&
                 turnoFecha <= fin &&
                 ['pendiente', 'confirmado', 'completado'].includes(turno.estado);
        });
      }
      
      throw error;
    }
  },

  async createTurno(data: CreateTurnoData): Promise<Turno> {
    const response = await axiosInstance.post('/api/turnos', data);
    return response.data.data;
  },

  async confirmarTurno(id: string): Promise<Turno> {
    const response = await axiosInstance.put(`/api/turnos/${id}/estado`, { estado: 'confirmado' });
    return response.data.data;
  },

  async cancelarTurno(id: string): Promise<Turno> {
    const response = await axiosInstance.put(`/api/turnos/${id}/estado`, { estado: 'cancelado' });
    return response.data.data;
  },

  async finalizarTurno(id: string, data: FinalizarTurnoData): Promise<Turno> {
    const response = await axiosInstance.put(`/api/turnos/${id}/finalizar`, data);
    return response.data.data;
  }
};
