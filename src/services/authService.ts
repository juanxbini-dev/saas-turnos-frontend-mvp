import axiosInstance from '../api/axiosInstance';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: string[];
    tenant: string;
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await axiosInstance.post('/auth/login', {
      email,
      password,
    });
    
    // Backend devuelve {success: true, data: {...}}
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Error de autenticación');
    }
  },

  async refresh(): Promise<LoginResponse> {
    const response = await axiosInstance.post('/auth/refresh');
    
    // Backend devuelve {success: true, data: {...}}
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Error al refrescar token');
    }
  },

  async logout(): Promise<void> {
    const response = await axiosInstance.post('/auth/logout');
    
    // Backend devuelve {success: true, message}
    if (!response.data.success) {
      throw new Error(response.data.message || 'Error al cerrar sesión');
    }
  },
};
