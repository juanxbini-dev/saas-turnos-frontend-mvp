import axiosInstance from '../api/axiosInstance';
import { Turno, TurnoConDetalle, CreateTurnoData } from '../types/turno.types';

export const turnoService = {
  async getTurnos(): Promise<TurnoConDetalle[]> {
    const response = await axiosInstance.get('/api/turnos');
    return response.data.data;
  },

  async createTurno(data: CreateTurnoData): Promise<Turno> {
    const response = await axiosInstance.post('/api/turnos', data);
    return response.data.data;
  },

  async cancelarTurno(id: string): Promise<Turno> {
    const response = await axiosInstance.put(`/api/turnos/${id}/estado`, { estado: 'cancelado' });
    return response.data.data;
  }
};
