import axiosInstance from '../../api/axiosInstance';
import { ServicioProfesional } from './empresaPublic.service';

export const servicioPublicService = {
  getServiciosProfesional: (profesionalId: string): Promise<{ data: ServicioProfesional[] }> => {
    return axiosInstance.get(`/public/profesionales/${profesionalId}/servicios`);
  }
};
