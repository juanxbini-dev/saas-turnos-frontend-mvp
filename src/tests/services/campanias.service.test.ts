import { vi, describe, it, expect, beforeEach } from 'vitest';

// Spec campanias-n8n §3 y §4.2: token de sección en X-Campanias-Token, manejo
// de 401/503 del acceso, e invalidaciones de cache.

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

import {
  campaniasService,
  clearCampaniasToken,
  esFalloTokenCampanias,
  getCampaniasToken,
} from '../../services/campanias.service';
import { servicioService } from '../../services/servicio.service';
import { clienteService } from '../../services/cliente.service';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';

const CLAVE_CONFIG = () => buildKey(ENTITIES.CAMPANIAS, 'recencia', 'config');
const CLAVE_PREVIEW = () => buildKey(ENTITIES.CAMPANIAS, 'recencia', 'preview', 'sale_hoy', 'todos', '1', '');
const CLAVE_GASTOS = () => buildKey(ENTITIES.GASTOS, 'mes', '2026-09');

function sembrarCache() {
  cacheService.set(CLAVE_CONFIG(), { activa: false }, 60_000);
  cacheService.set(CLAVE_PREVIEW(), { items: [] }, 60_000);
  cacheService.set(CLAVE_GASTOS(), { total: 1 }, 60_000);
}

const cacheCampaniasVacio = () =>
  cacheService.get(CLAVE_CONFIG()) === null && cacheService.get(CLAVE_PREVIEW()) === null;

describe('campanias.service — acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('guarda el token en sessionStorage y lo manda como X-Campanias-Token', async () => {
    post.mockResolvedValue({ data: { success: true, data: { token: 'tok-123', expires_in: 28800 } } });
    get.mockResolvedValue({ data: { success: true, data: { id: 'c1' } } });

    await campaniasService.validarAcceso('secreta');
    expect(post).toHaveBeenCalledWith('/api/campanias/acceso', { password: 'secreta' });
    expect(getCampaniasToken()).toBe('tok-123');
    expect(localStorage.getItem('campaniasToken')).toBeNull();

    await campaniasService.getCampania('recencia');
    expect(get).toHaveBeenCalledWith('/api/campanias/recencia', { headers: { 'X-Campanias-Token': 'tok-123' } });
  });

  it('503 se traduce a "sección no configurada" y 401 a contraseña incorrecta', async () => {
    post.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await expect(campaniasService.validarAcceso('x')).rejects.toMatchObject({ tipo: 'no_configurado' });

    post.mockRejectedValueOnce({ response: { status: 401, data: {} } });
    await expect(campaniasService.validarAcceso('x')).rejects.toMatchObject({ tipo: 'password_incorrecta' });

    post.mockRejectedValueOnce({ response: { status: 429, data: { retry_after: 60 } } });
    await expect(campaniasService.validarAcceso('x')).rejects.toMatchObject({ tipo: 'demasiados_intentos', segundosRestantes: 60 });

    expect(getCampaniasToken()).toBeNull();
  });

  it('verificarAcceso: sin token no pega al backend; con token vencido lo tira', async () => {
    expect(await campaniasService.verificarAcceso()).toBe(false);
    expect(get).not.toHaveBeenCalled();

    sessionStorage.setItem('campaniasToken', 'viejo');
    get.mockRejectedValueOnce({ response: { status: 401, data: { code: 'CAMPANIAS_TOKEN_INVALIDO' } } });
    expect(await campaniasService.verificarAcceso()).toBe(false);
    expect(get).toHaveBeenCalledWith('/api/campanias/ping', { headers: { 'X-Campanias-Token': 'viejo' } });
    expect(getCampaniasToken()).toBeNull();

    sessionStorage.setItem('campaniasToken', 'bueno');
    get.mockResolvedValueOnce({ data: { success: true } });
    expect(await campaniasService.verificarAcceso()).toBe(true);
    clearCampaniasToken();
  });

  it('reconoce los rechazos del token de la sección, y solo esos', () => {
    const err = (status: number, code?: string) => ({ response: { status, data: { code } } });
    expect(esFalloTokenCampanias(err(401, 'CAMPANIAS_TOKEN_INVALIDO'))).toBe(true);
    expect(esFalloTokenCampanias(err(401, 'CAMPANIAS_TOKEN_FALTANTE'))).toBe(true);
    expect(esFalloTokenCampanias(err(403, 'CAMPANIAS_TOKEN_AJENO'))).toBe(true);
    expect(esFalloTokenCampanias(err(401, 'GASTOS_TOKEN_INVALIDO'))).toBe(false);
    expect(esFalloTokenCampanias(err(401))).toBe(false);
    expect(esFalloTokenCampanias(err(500, 'CAMPANIAS_TOKEN_INVALIDO'))).toBe(false);
    expect(esFalloTokenCampanias(null)).toBe(false);
    expect(esFalloTokenCampanias(new Error('Network Error'))).toBe(false);
  });
});

describe('campanias.service — lecturas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('campaniasToken', 'tok');
  });

  it('vista previa: manda motivo solo con grupo=no_recibe y no manda filtros vacíos', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: { fecha: '2026-09-21', resumen: { sale_hoy: 0, en_espera: 0, no_recibe: 0, por_motivo: {} }, items: [] },
        meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 },
      },
    });

    await campaniasService.getVistaPrevia('recencia', { grupo: 'sale_hoy', motivo: 'baja', busqueda: '  ', pagina: 1 });
    expect(get.mock.calls[0][0]).toBe('/api/campanias/recencia/vista-previa');
    expect(get.mock.calls[0][1].params).toEqual({ grupo: 'sale_hoy', pagina: 1, por_pagina: 20 });

    await campaniasService.getVistaPrevia('recencia', { grupo: 'no_recibe', motivo: 'baja', busqueda: 'juan', pagina: 2 });
    expect(get.mock.calls[1][1].params).toEqual({ grupo: 'no_recibe', motivo: 'baja', busqueda: 'juan', pagina: 2, por_pagina: 20 });
    expect(get.mock.calls[1][1].headers).toEqual({ 'X-Campanias-Token': 'tok' });
  });

  it('historial: acepta data como array o como { items }', async () => {
    const meta = { total: 1, pagina: 1, por_pagina: 20, total_paginas: 1 };
    get.mockResolvedValueOnce({ data: { success: true, data: [{ id: 'e1' }], meta } });
    expect((await campaniasService.getEnvios('recencia', { pagina: 1 })).items).toEqual([{ id: 'e1' }]);

    get.mockResolvedValueOnce({ data: { success: true, data: { items: [{ id: 'e2' }] }, meta } });
    const respuesta = await campaniasService.getEnvios('recencia', { pagina: 1, estado: 'liberado' });
    expect(respuesta.items).toEqual([{ id: 'e2' }]);
    expect(respuesta.meta).toEqual(meta);
    expect(get.mock.calls[1][1].params).toEqual({ pagina: 1, por_pagina: 20, estado: 'liberado' });
  });

  it('métricas: manda el período como fecha_desde / fecha_hasta', async () => {
    get.mockResolvedValue({ data: { success: true, data: { serie: [] } } });
    await campaniasService.getMetricas('recencia', { fecha_desde: '2026-09-01', fecha_hasta: '2026-09-30' });
    expect(get.mock.calls[0][0]).toBe('/api/campanias/recencia/metricas');
    expect(get.mock.calls[0][1].params).toEqual({ fecha_desde: '2026-09-01', fecha_hasta: '2026-09-30' });
  });
});

describe('invalidaciones del cache de Campañas (§4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('campaniasToken', 'tok');
    sembrarCache();
    patch.mockResolvedValue({ data: { success: true, data: {} } });
    post.mockResolvedValue({ data: { success: true, data: {} } });
    put.mockResolvedValue({ data: { success: true, data: {} } });
    del.mockResolvedValue({ data: { success: true } });
  });

  it('PATCH de la campaña: manda el token, tira todo el prefijo y no toca otras entidades', async () => {
    await campaniasService.actualizarCampania('recencia', { activa: true });

    expect(patch).toHaveBeenCalledWith('/api/campanias/recencia', { activa: true }, { headers: { 'X-Campanias-Token': 'tok' } });
    expect(cacheCampaniasVacio()).toBe(true);
    expect(cacheService.get(CLAVE_GASTOS())).not.toBeNull();
  });

  it('crear un servicio invalida Campañas', async () => {
    await servicioService.createServicio({ nombre: 'Corte', duracion: 30, frecuencia_dias: 30 });
    expect(cacheCampaniasVacio()).toBe(true);
  });

  it('editar un servicio invalida Campañas', async () => {
    await servicioService.updateServicio('srv-1', { frecuencia_dias: null });
    expect(put).toHaveBeenCalledWith('/api/servicios/srv-1', { frecuencia_dias: null });
    expect(cacheCampaniasVacio()).toBe(true);
  });

  it('cambiar el marketing de un cliente invalida Clientes y Campañas', async () => {
    const claveClientes = buildKey(ENTITIES.CLIENTES, 'lista', '1');
    cacheService.set(claveClientes, [], 60_000);

    await clienteService.actualizarMarketing('cli-1', false);

    expect(patch).toHaveBeenCalledWith('/api/clientes/cli-1/marketing', { recibe: false });
    expect(cacheCampaniasVacio()).toBe(true);
    expect(cacheService.get(claveClientes)).toBeNull();
  });

  it('editar un cliente invalida Campañas', async () => {
    await clienteService.updateCliente('cli-1', { telefono: '11 5555-4444' });
    expect(cacheCampaniasVacio()).toBe(true);
  });

  it('si el PATCH falla no se invalida nada', async () => {
    patch.mockRejectedValueOnce(new Error('Network Error'));
    await expect(campaniasService.actualizarCampania('recencia', { activa: true })).rejects.toBeTruthy();
    expect(cacheService.get(CLAVE_CONFIG())).not.toBeNull();
  });
});
