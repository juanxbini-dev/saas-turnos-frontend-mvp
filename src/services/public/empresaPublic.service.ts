import axiosInstance from '../../api/axiosInstance';

export interface EmpresaPublica {
  id: string;
  nombre: string;
  dominio: string;
  activo: boolean;
}

export interface ProfesionalPublic {
  id: string;
  nombre: string;
  username: string;
  email: string;
  roles: string[];
  activo: boolean;
  avatar_url?: string | null;
  descripcion?: string | null; // descripcion de landing_profesionales
}

export interface ServicioProfesional {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
}

export const empresaPublicService = {
  getEmpresa: (dominio: string): Promise<{ data: EmpresaPublica }> => {
    return axiosInstance.get(`/public/empresas/${dominio}`);
  },

  getProfesionales: (empresaId: string): Promise<{ data: ProfesionalPublic[] }> => {
    return axiosInstance.get(`/public/empresas/${empresaId}/profesionales`);
  }
};
