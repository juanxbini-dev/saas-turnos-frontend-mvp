import axiosInstance from '../api/axiosInstance';
import { sumarMontos } from '../components/gastos/gastos.utils';
import { cacheService } from '../cache/cache.service';
import { buildKey, ENTITIES } from '../cache/key.builder';
import type {
  GastosAccesoFallo,
  GastosMes,
  GastosMesApi,
  GastosResumen,
  GastosDetalleMes,
  GastosDetalleMesApi,
  GastosProfesionalMes,
  GastosProfesionalesTotales,
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
  GastoEstado,
  MarcarPagadoItem,
  MarcarPagadosInput,
  MarcarPagadosResult,
  GastosUsuarioCuenta,
  GastosUsuariosCuentaResponse,
  AlcanceCuentaGastos,
} from '../types/gastos.types';
import { armarPedidoCuenta } from '../components/gastos/cuentaGastos.utils';

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

// ¿Este error es el backend rechazando el token de la sección (vencido, ajeno a
// la sesión o ausente)? El middleware responde 401/403 con code GASTOS_TOKEN_*.
// Ojo: el interceptor de axiosInstance trata todo 401 como JWT vencido, intenta
// un refresh y reintenta una vez; si el token de gastos sigue vencido el reintento
// vuelve a fallar y el error llega acá. Nadie lo maneja globalmente: el que lo
// reciba tiene que delegar en GastosGate (useGastosGate().bloquear).
export function esFalloTokenGastos(error: unknown): boolean {
  const response = (error as any)?.response;
  const status = response?.status;
  const code = response?.data?.code;
  return (status === 401 || status === 403) && typeof code === 'string' && code.startsWith('GASTOS_TOKEN');
}

// Cualquier mutación deja obsoleto todo lo cacheado de gastos: el mes editado,
// los del alrededor (evolución, comparativa) y las listas. Es más simple y más
// seguro tirar todo el prefijo que perseguir cada clave.
export function invalidarCacheGastos(): void {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.GASTOS));
}

// Completa los campos de ingresos del mes si el backend todavía no los manda
// (anterior a la 027): sin ingresos cargados, todo en cero.
export function normalizarMes(api: GastosMesApi): GastosMes {
  const ingresos_fijos = api.ingresos_fijos ?? [];
  const ingresos_unicos = api.ingresos_unicos ?? [];
  const t = api.totales;
  const contables = [...ingresos_fijos, ...ingresos_unicos].filter((i) => !i.omitido);
  const fijos = t.ingresos_fijos ?? sumarMontos(ingresos_fijos.filter((i) => !i.omitido).map((i) => i.monto));
  const unicos = t.ingresos_unicos ?? sumarMontos(ingresos_unicos.filter((i) => !i.omitido).map((i) => i.monto));
  return {
    ...api,
    ingresos_fijos,
    ingresos_unicos,
    totales: {
      ...t,
      ingresos_fijos: fijos,
      ingresos_unicos: unicos,
      ingresos: t.ingresos ?? sumarMontos([fijos, unicos]),
      cobrado: t.cobrado ?? sumarMontos(contables.filter((i) => i.estado === 'pagado').map((i) => i.monto)),
      por_cobrar: t.por_cobrar ?? sumarMontos(contables.filter((i) => i.estado !== 'pagado').map((i) => i.monto)),
    },
  };
}

// ¿Esta fila cuenta en Gastos? Sin el campo (backend viejo), cuenta.
export const cuentaEnGastos = (p: GastosProfesionalMes): boolean => p.cuenta_en_gastos !== false;

// Dueño primero, después por facturado de mayor a menor (gastos-ganancias-spec
// §4.4). El backend ya los manda así; se reordena por si acaso, sin mutar.
export function ordenarProfesionales(filas: GastosProfesionalMes[]): GastosProfesionalMes[] {
  return [...filas].sort((a, b) => {
    if (a.es_duenio !== b.es_duenio) return a.es_duenio ? -1 : 1;
    return b.facturado - a.facturado;
  });
}

// Totales de la tabla por profesional calculados acá, solo si el backend no los
// manda. Suma en centavos; al dueño nunca se le "paga". Los que no cuentan en
// Gastos quedan afuera de todo salvo de facturado_excluido.
export function totalesDeProfesionales(todas: GastosProfesionalMes[]): GastosProfesionalesTotales {
  const filas = todas.filter(cuentaEnGastos);
  return {
    facturado: sumarMontos(filas.map((f) => f.facturado)),
    a_pagar: sumarMontos(filas.map((f) => (f.es_duenio ? 0 : f.a_pagar))),
    ganancia_salon: sumarMontos(filas.map((f) => f.ganancia_salon)),
    facturado_duenio: sumarMontos(filas.filter((f) => f.es_duenio).map((f) => f.facturado)),
    facturado_excluido: sumarMontos(todas.filter((f) => !cuentaEnGastos(f)).map((f) => f.facturado)),
  };
}

// Lleva la respuesta de /detalle a la forma que usan los componentes, tolerando
// el contrato viejo (comisiones_total, mercaderia_costo/unidades) durante la
// transición: si falta un campo nuevo, se usa su alias.
export function normalizarDetalle(api: GastosDetalleMesApi): GastosDetalleMes {
  const profesionales = ordenarProfesionales(
    (api.profesionales ?? []).map((p) => ({ ...p, cuenta_en_gastos: cuentaEnGastos(p) }))
  );
  // Los totales del backend se respetan tal cual (facturado_excluido puede faltar
  // en uno anterior a la 027: los componentes lo leen con ?? 0)
  const totales = api.totales ?? totalesDeProfesionales(profesionales);
  return {
    periodo: api.periodo,
    ingresos: { ...api.ingresos, cargados: api.ingresos?.cargados ?? 0 },
    profesionales,
    totales,
    productos: api.productos ?? {
      costo_vendido: api.mercaderia_costo ?? 0,
      costo_canjes: 0,
      unidades: api.mercaderia_unidades ?? api.ingresos?.productos_vendidos ?? 0,
    },
    a_pagar_total: api.a_pagar_total ?? api.comisiones_total ?? 0,
  };
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
    return normalizarMes(response.data.data as GastosMesApi);
  },

  async getResumen(periodo: string): Promise<GastosResumen> {
    const response = await axiosInstance.get(`${BASE}/resumen?periodo=${periodo}`, conToken());
    return response.data.data;
  },

  async getDetalle(periodo: string): Promise<GastosDetalleMes> {
    const response = await axiosInstance.get(`${BASE}/detalle?periodo=${periodo}`, conToken());
    return normalizarDetalle(response.data.data as GastosDetalleMesApi);
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
  // crearCategoria acepta `tipo` ('gasto' | 'ingreso'); actualizarCategoria no
  // lo cambia (el backend lo ignora).

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

  // Tilde por fila o por rubro: pagado/pendiente en lote, en una transacción.
  // Los ítems se arman con itemPagado() de gastos.utils.
  async marcarPagados(periodo: string, estado: GastoEstado, items: MarcarPagadoItem[]): Promise<MarcarPagadosResult> {
    const body: MarcarPagadosInput = { periodo, estado, items };
    const response = await axiosInstance.patch(`${BASE}/pagado`, body, conToken());
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

  // ------------------------------------------- Usuarios que cuentan en Gastos
  // Solo super admin, SIN el token de la sección: se usan desde la pantalla de
  // Usuarios, donde nunca se pidió la contraseña de Gastos. Por eso no llevan
  // conToken(): el X-Gastos-Token no se manda aunque haya uno guardado.

  async getUsuariosCuenta(): Promise<GastosUsuariosCuentaResponse> {
    const response = await axiosInstance.get(`${BASE}/usuarios-cuenta`);
    return response.data.data;
  },

  // Cambia desde qué mes (o en qué mes) cuenta un usuario. Cambia los números
  // de Gastos de esos meses: se tira todo el cache de la sección.
  async cambiarCuentaUsuario(
    usuarioId: string,
    cuenta: boolean,
    alcance: AlcanceCuentaGastos,
    periodo?: string | null
  ): Promise<GastosUsuarioCuenta> {
    const body = armarPedidoCuenta(cuenta, alcance, periodo);
    const response = await axiosInstance.post(`${BASE}/usuarios-cuenta/${usuarioId}`, body);
    invalidarCacheGastos();
    return response.data.data;
  },
};
