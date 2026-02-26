import axiosInstance from '../../api/axiosInstance';

export interface ValidateClienteRequest {
  email: string;
  telefono?: string;
  empresa_id: string;
}

export interface ValidateClienteResponse {
  exists: boolean;
  cliente?: {
    id: string;
    nombre: string;
    email: string;
    telefono?: string;
  };
}

export interface CreateTurnoPublicRequest {
  profesional_id: string;
  servicio_id: string;
  fecha: string;
  hora: string;
  cliente_data: {
    nombre: string;
    email: string;
    telefono?: string;
  };
  cliente_id?: string;
  notas?: string;
}

export interface CreateTurnoPublicResponse {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  cliente_nombre: string;
  profesional_nombre: string;
  servicio_nombre: string;
}

export const turnoPublicService = {
  validateCliente: (data: ValidateClienteRequest): Promise<{ data: ValidateClienteResponse }> => {
    return axiosInstance.post('/public/clientes/validate', data);
  },

  createTurno: (data: CreateTurnoPublicRequest): Promise<{ data: CreateTurnoPublicResponse }> => {
    return axiosInstance.post('/public/turnos', data);
  }
};
