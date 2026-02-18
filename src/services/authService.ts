import axiosInstance from '../api/axiosInstance';

export interface LoginResponse {
  accessToken: string;
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
    // TODO: Implementar cuando el backend tenga refresh token
    throw new Error('Refresh token no implementado aún');
  },

  async logout(): Promise<void> {
    // TODO: Implementar cuando el backend tenga logout
    throw new Error('Logout no implementado aún');
  },
};
