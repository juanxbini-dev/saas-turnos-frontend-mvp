import axiosInstance from '../api/axiosInstance';
import { 
  DisponibilidadSemanal, 
  DiasVacacion, 
  ExcepcionDia, 
  Profesional, 
  ServicioProfesional 
} from '../types/turno.types';

export const disponibilidadService = {
  async getDisponibilidadMes(profesionalId: string, mes: number, año: number, servicioId?: string): Promise<string[]> {
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Llamando a API:', { profesionalId, mes, año, servicioId });
    const response = await axiosInstance.get(`/api/turnos/disponibilidad/${profesionalId}/mes`, {
      params: { mes, año, ...(servicioId ? { servicioId } : {}) }
    });
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Respuesta completa:', response.data);
    console.log('🔍 [disponibilidadService] getDisponibilidadMes - Datos:', response.data.data);
    return response.data.data;
  },

  async getSlotsDisponibles(profesionalId: string, fecha: string, servicioId?: string): Promise<string[]> {
    const response = await axiosInstance.get(`/api/turnos/disponibilidad/${profesionalId}/slots`, {
      params: { fecha, ...(servicioId ? { servicioId } : {}) }
    });
    return response.data.data;
  },

  async getSlotsRango(profesionalId: string, fechaInicio: string, fechaFin: string, servicioId?: string): Promise<Record<string, string[]>> {
    const response = await axiosInstance.get(`/api/turnos/disponibilidad/${profesionalId}/slots-rango`, {
      params: { fechaInicio, fechaFin, ...(servicioId ? { servicioId } : {}) }
    });
    const data: { fecha: string; slots: string[] }[] = response.data.data;
    return Object.fromEntries(data.map(({ fecha, slots }) => [fecha, slots]));
  },

  async getConfiguracion(profesionalId?: string): Promise<{
    disponibilidades: DisponibilidadSemanal[];
    vacaciones: DiasVacacion[];
    excepciones: ExcepcionDia[];
  }> {
    const params = profesionalId ? { profesionalId } : undefined;
    const response = await axiosInstance.get('/api/turnos/configuracion', { params });
    return response.data.data;
  },

  async getProfesionales(params?: {
    limit?: number
    search?: string
  }): Promise<{ data: Profesional[] }> {
    const response = await axiosInstance.get('/api/usuarios/profesionales', { params });
    return response.data;
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

  async updateDisponibilidad(id: string, data: Partial<DisponibilidadSemanal> & { profesional_id?: string }): Promise<DisponibilidadSemanal> {
    const response = await axiosInstance.put(`/api/turnos/disponibilidad/${id}`, data);
    return response.data.data;
  },

  async deleteDisponibilidad(id: string, profesionalId?: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/disponibilidad/${id}`, {
      data: profesionalId ? { profesional_id: profesionalId } : undefined
    });
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

  async updateVacacion(id: string, data: Partial<DiasVacacion> & { profesional_id?: string }): Promise<DiasVacacion> {
    const response = await axiosInstance.put(`/api/turnos/vacaciones/${id}`, data);
    return response.data.data;
  },

  async deleteVacacion(id: string, profesionalId?: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/vacaciones/${id}`, {
      data: profesionalId ? { profesional_id: profesionalId } : undefined
    });
  },

  // CRUD Excepciones
  async createExcepcion(data: {
    fecha: string;
    disponible: boolean;
    tipo?: 'reemplazo' | 'adicional';
    hora_inicio?: string;
    hora_fin?: string;
    intervalo_minutos?: number;
    notas?: string;
    profesional_id?: string;
  }): Promise<ExcepcionDia> {
    const response = await axiosInstance.post('/api/turnos/excepciones', data);
    return response.data.data;
  },

  async updateExcepcion(id: string, data: Partial<ExcepcionDia> & { profesional_id?: string }): Promise<ExcepcionDia> {
    const response = await axiosInstance.put(`/api/turnos/excepciones/${id}`, data);
    return response.data.data;
  },

  async deleteExcepcion(id: string, profesionalId?: string): Promise<void> {
    await axiosInstance.delete(`/api/turnos/excepciones/${id}`, {
      data: profesionalId ? { profesional_id: profesionalId } : undefined
    });
  }
};
