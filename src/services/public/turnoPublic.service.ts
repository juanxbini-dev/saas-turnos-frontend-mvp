import type { AxiosResponse } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import type { BeneficioReserva } from '../../types/beneficios.public.types';

// Formato de todas las respuestas del backend: { success, data }
export interface RespuestaApi<T> {
  success: boolean;
  data: T;
}

export interface ValidateClienteRequest {
  email?: string;
  telefono?: string;
  nombre?: string;
  empresa_id: string;
}

export interface ValidateClienteResponse {
  exists: boolean;
  cliente?: {
    id: string;
    nombre: string;
    email?: string;
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
    email?: string;
    telefono?: string;
  };
  cliente_id?: string;
  notas?: string;
  // Tilde "Quiero recibir novedades…" de la reserva. Viaja SIEMPRE: true
  // registra la aceptación (y levanta una baja previa), false registra la baja.
  marketing_consentimiento: boolean;
  // Código del enlace `?r=` si la persona llegó desde un mensaje de WhatsApp. Sin
  // código el campo NO se manda. El backend lo usa para atribuir la reserva al
  // mensaje; un código inválido o vencido se ignora y la reserva se crea igual.
  campania_codigo?: string;
  // Qué tocó la persona en el modal "Te reconocemos". Sin modal NO se manda.
  // 'confirmar' viaja junto con `cliente_id`; 'otros_datos' viaja SIN `cliente_id`
  // (el backend crea una ficha nueva aunque el teléfono ya exista).
  modal_accion?: 'confirmar' | 'otros_datos';
  // Código de beneficio (`DEB-7K3P9`) escrito en el paso 3 o llegado por `?b=`.
  // Sin código el campo NO se manda. El backend exige que esté emitido, vigente
  // y que sea de esa persona; si no, 400 BENEFICIO_INVALIDO /
  // BENEFICIO_NO_CORRESPONDE y el turno NO se crea (plan mails-beneficios §4.1).
  beneficio_codigo?: string;
  // `codigo_link` del mail de la lista vieja (`?m=`, beneficio-con-turno §5.2).
  // Solo viaja con el beneficio en estado 'disponible'; es EXCLUYENTE con
  // `beneficio_codigo` (los dos → 400). El backend crea el código ya reservado
  // para este turno. Si no corresponde (reservado, usado, vencido, baja…):
  // 400 BENEFICIO_INVALIDO con `motivo` y el turno NO se crea.
  beneficio_m?: string;
}

export interface CreateTurnoPublicResponse {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  cliente_nombre: string;
  profesional_nombre: string;
  servicio_nombre: string;
  // Solo cuando la reserva llevó código o `beneficio_m`: lo que queda aplicado al pagar
  beneficio?: BeneficioReserva | null;
}

export const turnoPublicService = {
  validateCliente: (data: ValidateClienteRequest): Promise<{ data: ValidateClienteResponse }> => {
    return axiosInstance.post('/public/clientes/validate', data);
  },

  createTurno: (data: CreateTurnoPublicRequest): Promise<AxiosResponse<RespuestaApi<CreateTurnoPublicResponse>>> => {
    return axiosInstance.post('/public/turnos', data);
  },

  getTurnosCliente: (params: {
    profesional_id: string;
    empresa_id: string;
    email?: string;
    telefono?: string;
  }) => {
    return axiosInstance.get('/public/clientes/turnos', { params });
  },

  cancelarTurno: (turnoId: string, data: {
    empresa_id: string;
    email?: string;
    telefono?: string;
  }) => {
    return axiosInstance.post(`/public/turnos/${turnoId}/cancelar`, data);
  }
};
