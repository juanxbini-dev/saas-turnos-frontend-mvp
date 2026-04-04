import axiosInstance from '../api/axiosInstance';

export interface BloqueoSlot {
  id: string;
  empresa_id: string;
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string | null;
  created_at: string;
}

export const bloqueoSlotService = {
  async getByRango(fechaInicio: string, fechaFin: string, profesionalId?: string): Promise<BloqueoSlot[]> {
    const response = await axiosInstance.get('/api/bloqueo-slots', {
      params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, ...(profesionalId && { profesional_id: profesionalId }) }
    });
    return response.data.data;
  },

  async create(data: {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    motivo?: string;
    profesional_id?: string;
  }): Promise<BloqueoSlot> {
    const response = await axiosInstance.post('/api/bloqueo-slots', data);
    return response.data.data;
  },

  async remove(id: string): Promise<void> {
    await axiosInstance.delete(`/api/bloqueo-slots/${id}`);
  }
};
