import axiosInstance from '../api/axiosInstance';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import type {
  GastosAccesoFallo,
  GastosMes,
  GastosResumen,
  GastosDetalleMes,
  GastosEvolucionPunto,
  GastosPorCategoriaItem,
  GastoCategoria,
  GastoRecurrente,
  GastoMesItem,
  CrearGastoInput,
  ActualizarGastoInput,
  CrearRecurrenteInput,
  ActualizarRecurrenteInput,
  OverrideRecurrenteInput,
  CrearCategoriaInput,
} from '../types/gastos.types';

// El token de la sección vive en sessionStorage, no en localStorage: muere al
// cerrar la pestaña y no queda en disco. Nunca se manda a otros endpoints: solo
// se inyecta como X-Gastos-Token en los requests de /api/gastos.
const STORAGE_KEY = 'gastosToken';
const BASE = '/api/gastos';

export function getGastosToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearGastosToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

const conToken = () => {
  const token = getGastosToken();
  return { headers: token ? { 'X-Gastos-Token': token } : {} };
};

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

// Cualquier mutación deja obsoleto todo lo cacheado de gastos: el mes editado,
// los del alrededor (evolución, comparativa) y las listas. Es más simple y más
// seguro tirar todo el prefijo que perseguir cada clave.
export function invalidarCacheGastos(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.GASTOS));
}

export const gastosService = {
  // ------------------------------------------------------------------ Acceso

  async validarAcceso(password: string): Promise<void> {
    try {
      const response = await axiosInstance.post(`${BASE}/acceso`, { password });
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
      await axiosInstance.get(`${BASE}/ping`, conToken());
      return true;
    } catch {
      clearGastosToken();
      return false;
    }
  },

  // -------------------------------------------------------- Mes y métricas

  async getMes(periodo: string): Promise<GastosMes> {
    const response = await axiosInstance.get(`${BASE}?periodo=${periodo}`, conToken());
    return response.data.data;
  },

  async getResumen(periodo: string): Promise<GastosResumen> {
    const response = await axiosInstance.get(`${BASE}/resumen?periodo=${periodo}`, conToken());
    return response.data.data;
  },

  async getDetalle(periodo: string): Promise<GastosDetalleMes> {
    const response = await axiosInstance.get(`${BASE}/detalle?periodo=${periodo}`, conToken());
    return response.data.data;
  },

  async getEvolucion(desde: string, hasta: string): Promise<GastosEvolucionPunto[]> {
    const response = await axiosInstance.get(
      `${BASE}/evolucion?desde=${desde}&hasta=${hasta}`,
      conToken()
    );
    return response.data.data;
  },

  async getPorCategoria(periodo: string): Promise<GastosPorCategoriaItem[]> {
    const response = await axiosInstance.get(`${BASE}/por-categoria?periodo=${periodo}`, conToken());
    return response.data.data;
  },

  // -------------------------------------------------------------- Categorías

  async getCategorias(): Promise<GastoCategoria[]> {
    const response = await axiosInstance.get(`${BASE}/categorias`, conToken());
    return response.data.data;
  },

  async crearCategoria(input: CrearCategoriaInput): Promise<GastoCategoria> {
    const response = await axiosInstance.post(`${BASE}/categorias`, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  async actualizarCategoria(id: string, input: Partial<GastoCategoria>): Promise<GastoCategoria> {
    const response = await axiosInstance.patch(`${BASE}/categorias/${id}`, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  async eliminarCategoria(id: string): Promise<{ desactivada: boolean }> {
    const response = await axiosInstance.delete(`${BASE}/categorias/${id}`, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  // ------------------------------------------------------------------ Gastos

  async crearGasto(input: CrearGastoInput): Promise<GastoMesItem> {
    const response = await axiosInstance.post(BASE, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  async actualizarGasto(id: string, input: ActualizarGastoInput): Promise<GastoMesItem> {
    const response = await axiosInstance.patch(`${BASE}/${id}`, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  // Borra un gasto único, o revierte un override a la plantilla
  async eliminarGasto(id: string): Promise<{ revirtio_override: boolean }> {
    const response = await axiosInstance.delete(`${BASE}/${id}`, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  // ------------------------------------------------------------- Recurrentes

  async getRecurrentes(soloActivos = false): Promise<GastoRecurrente[]> {
    const response = await axiosInstance.get(
      `${BASE}/recurrentes${soloActivos ? '?solo_activos=true' : ''}`,
      conToken()
    );
    return response.data.data;
  },

  async crearRecurrente(input: CrearRecurrenteInput): Promise<GastoRecurrente> {
    const response = await axiosInstance.post(`${BASE}/recurrentes`, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  // Cambia la plantilla para todos los meses sin override (incluidos los pasados)
  async actualizarRecurrente(id: string, input: ActualizarRecurrenteInput): Promise<GastoRecurrente> {
    const response = await axiosInstance.patch(`${BASE}/recurrentes/${id}`, input, conToken());
    invalidarCacheGastos();
    return response.data.data;
  },

  // Aumento desde un mes: cierra la plantilla vieja y abre una nueva
  async reemplazarRecurrente(id: string, periodoDesde: string, montoDefault: number): Promise<GastoRecurrente> {
    const response = await axiosInstance.post(
      `${BASE}/recurrentes/${id}/reemplazar`,
      { periodo_desde: periodoDesde, monto_default: montoDefault },
      conToken()
    );
    invalidarCacheGastos();
    return response.data.data;
  },

  // desde = primer mes en que el recurrente ya NO aplica; el anterior es el ultimo
  async darDeBajaRecurrente(id: string, desde: string): Promise<{ eliminado: boolean }> {
    const response = await axiosInstance.delete(`${BASE}/recurrentes/${id}`, {
      ...conToken(),
      data: { desde },
    });
    invalidarCacheGastos();
    return response.data.data;
  },

  // Edita un recurrente en un mes puntual sin tocar la plantilla
  async guardarOverride(recurrenteId: string, periodo: string, input: OverrideRecurrenteInput): Promise<GastoMesItem> {
    const response = await axiosInstance.patch(
      `${BASE}/recurrentes/${recurrenteId}/periodo/${periodo}`,
      input,
      conToken()
    );
    invalidarCacheGastos();
    return response.data.data;
  },
};
