import axiosInstance from '../api/axiosInstance';
import { 
  DisponibilidadSemanal, 
  DiasVacacion, 
  ExcepcionDia, 
  Profesional, 
  ServicioProfesional 
} from '../types/turno.types';

export const disponibilidadService = {
  async getDisponibilidadMes(profesionalId: string, mes: number, año: number): Promise<string[]> {
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Llamando a API:', { profesionalId, mes, año });
    const response = await axiosInstance.get(`/api/turnos/disponibilidad/${profesionalId}/mes`, {
      params: { mes, año }
    });
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Respuesta completa:', response.data);
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Datos:', response.data.data);
    return response.data.data;
  },

  async getSlotsDisponibles(profesionalId: string, fecha: string): Promise<string[]> {
    const response = await axiosInstance.get(`/api/turnos/disponibilidad/${profesionalId}/slots`, {
      params: { fecha }
    });
    return response.data.data;
  },

  async getConfiguracion(): Promise<{
    disponibilidades: DisponibilidadSemanal[];
    vacaciones: DiasVacacion[];
    excepciones: ExcepcionDia[];
  }> {
    const response = await axiosInstance.get('/api/turnos/configuracion');
    return response.data.data;
  },

  async getProfesionales(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ profesionales: Profesional[]; total: number }> {
    const response = await axiosInstance.get('/api/usuarios/profesionales', { params });
    return response.data.data;
  },

  async getServiciosProfesional(profesionalId: string): Promise<ServicioProfesional[]> {
    const response = await axiosInstance.get(`/api/usuarios/${profesionalId}/servicios`);
    return response.data.data;
  },

  // CRUD Disponibilidad
  async createDisponibilidad(data: {
    profesional_id: string;
    dia_inicio: number;
    dia_fin: number;
    hora_inicio: string;
    hora_fin: string;
    intervalo_minutos: number;
  }): Promise<DisponibilidadSemanal> {
    const response = await axiosInstance.post('/api/turnos/disponibilidad', data);
    return response.data.data;
  },

  async updateDisponibilidad(id: string, data: Partial<DisponibilidadSemanal>): Promise<DisponibilidadSemanal> {
    const response = await axiosInstance.put(`/api/turnos/disponibilidad/${id}`, data);
    return response.data.data;
  },

  async deleteDisponibilidad(id: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/disponibilidad/${id}`);
  },

  // CRUD Vacaciones
  async createVacacion(data: {
    fecha: string;
    fecha_fin?: string;
    tipo: 'vacacion' | 'feriado' | 'personal' | 'enfermedad';
    motivo?: string;
  }): Promise<DiasVacacion> {
    const response = await axiosInstance.post('/api/turnos/vacaciones', data);
    return response.data.data;
  },

  async updateVacacion(id: string, data: Partial<DiasVacacion>): Promise<DiasVacacion> {
    const response = await axiosInstance.put(`/api/turnos/vacaciones/${id}`, data);
    return response.data.data;
  },

  async deleteVacacion(id: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/vacaciones/${id}`);
  },

  // CRUD Excepciones
  async createExcepcion(data: {
    fecha: string;
    disponible: boolean;
    hora_inicio?: string;
    hora_fin?: string;
    intervalo_minutos?: number;
    notas?: string;
  }): Promise<ExcepcionDia> {
    const response = await axiosInstance.post('/api/turnos/excepciones', data);
    return response.data.data;
  },

  async updateExcepcion(id: string, data: Partial<ExcepcionDia>): Promise<ExcepcionDia> {
    const response = await axiosInstance.put(`/api/turnos/excepciones/${id}`, data);
    return response.data.data;
  },

  async deleteExcepcion(id: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/excepciones/${id}`);
  }
};
