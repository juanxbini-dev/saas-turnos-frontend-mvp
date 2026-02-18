import axios from 'axios';
import { getAccessToken } from '../context/AuthContext';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  withCredentials: true,
});

// Request interceptor - agregar Authorization header usando getter seguro
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - manejar 401 (sin refresh token por ahora)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Forzar logout si no está autorizado
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
