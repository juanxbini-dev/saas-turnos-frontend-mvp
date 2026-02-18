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
    return response.data;
  },

  async refresh(): Promise<LoginResponse> {
    const response = await axiosInstance.post('/auth/refresh');
    return response.data;
  },

  async logout(): Promise<void> {
    await axiosInstance.post('/auth/logout');
  },
};
