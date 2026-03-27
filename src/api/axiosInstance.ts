import axios from 'axios';
import { createLogger } from '../utils/createLogger';

const authLogger = createLogger('AuthService');

const axiosInstance = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000',
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: any[] = [];

// Process queue
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Log solo en desarrollo para no saturar producción
      if ((import.meta as any).env?.DEV) {
      authLogger.debug('Enviando request con access token');
      }
    } else {
      if ((import.meta as any).env?.DEV) {
      authLogger.debug('Enviando request sin access token');
      }
    }
    return config;
  },
  (error) => {
    authLogger.error('Error en request interceptor', error as Error);
    return Promise.reject(error);
  }
);

// Response interceptor con refresh token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si ya está refrescando, agregar a la cola
        authLogger.debug('Refresh en progreso, encolando petición');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      authLogger.info('Access token expirado, iniciando refresh automático');

      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/auth/refresh', { refreshToken: storedRefreshToken }, {
          baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000',
          withCredentials: true // Importante para cookies
        });

        if (response.data.success) {
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          
          localStorage.setItem('accessToken', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          authLogger.info('Access token refrescado exitosamente');
          authLogger.debug('Nuevo access token válido por 15 minutos');
          
          // Calcular tiempo de expiración
          const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
          authLogger.debug('Próximo refresh automático', { 
            proximoRefresh: expirationTime.toLocaleTimeString() 
          });

          processQueue(null, accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        authLogger.error('Error en refresh automático', refreshError as Error);
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
