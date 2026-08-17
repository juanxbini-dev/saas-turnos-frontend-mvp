import axiosInstance from '../api/axiosInstance';
import type { GastosAccesoFallo } from '../types/gastos.types';

// El token de la sección vive en sessionStorage, no en localStorage: muere al
// cerrar la pestaña y no queda en disco. Nunca se manda a otros endpoints: solo
// se inyecta como X-Gastos-Token en los requests de /api/gastos.
const STORAGE_KEY = 'gastosToken';

export function getGastosToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearGastosToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

function headers() {
  const token = getGastosToken();
  return token ? { 'X-Gastos-Token': token } : {};
}

// Traduce el error de axios al fallo tipado que consume el gate
function traducirFallo(error: any): GastosAccesoFallo {
  const status = error?.response?.status;

  if (status === 429) {
    return {
      tipo: 'demasiados_intentos',
      mensaje: error.response?.data?.message || 'Demasiados intentos. Probá de nuevo más tarde.',
      segundosRestantes: error.response?.data?.retry_after,
    };
  }
  if (status === 503) {
    return { tipo: 'no_configurado', mensaje: 'La sección no está configurada. Avisale a soporte.' };
  }
  if (status === 401) {
    return { tipo: 'password_incorrecta', mensaje: 'Contraseña incorrecta' };
  }
  return { tipo: 'error', mensaje: 'No se pudo validar el acceso. Intentá de nuevo.' };
}

export const gastosService = {
  // Valida la contraseña de la sección y guarda el token devuelto
  async validarAcceso(password: string): Promise<void> {
    try {
      const response = await axiosInstance.post('/api/gastos/acceso', { password });
      const token = response.data?.data?.token;
      if (!token) throw new Error('El backend no devolvió el token de gastos');
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch (error) {
      clearGastosToken();
      throw traducirFallo(error);
    }
  },

  // ¿El token guardado sigue siendo válido? Se llama al montar la página.
  async verificarAcceso(): Promise<boolean> {
    if (!getGastosToken()) return false;
    try {
      await axiosInstance.get('/api/gastos/ping', { headers: headers() });
      return true;
    } catch {
      clearGastosToken();
      return false;
    }
  },
};
