import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import {
  campaniaPublicService, esCodigoDeEnlace, guardarCodigoDeVisita, leerCodigoDeVisita, olvidarCodigoDeVisita,
} from '../../services/public';

// Spec campanias-n8n §15.2 y §17 (T2-Q10): el resolver del enlace `?r=`.
// Se usa el axiosInstance REAL (con sus interceptores) y un adapter falso, para
// probar de verdad que un 5xx acá no dispara el modal global de reporte: le
// aparecería a un cliente que solo tocó el botón de un WhatsApp.

const adapterOriginal = axiosInstance.defaults.adapter;
let pedidos: InternalAxiosRequestConfig[] = [];

function responder(status: number, data: unknown): void {
  const adapter: AxiosAdapter = async (config) => {
    pedidos.push(config);
    const response: AxiosResponse = { data, status, statusText: '', headers: { 'x-request-id': 'req-1' }, config };
    // Un adapter propio tiene que rechazar él mismo los estados de error (en los
    // de fábrica lo hace `settle`); si no, un 500 llegaría como respuesta buena.
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    }
    return response;
  };
  axiosInstance.defaults.adapter = adapter;
}

function fallarLaRed(): void {
  const adapter: AxiosAdapter = async (config) => {
    pedidos.push(config);
    throw new Error('Network Error');
  };
  axiosInstance.defaults.adapter = adapter;
}

const ok = (data: Record<string, unknown>) => ({ success: true, data });

describe('campaniaPublicService.resolverEnlace', () => {
  const alReportarError = vi.fn();

  beforeEach(() => {
    pedidos = [];
    alReportarError.mockReset();
    window.addEventListener('app:error', alReportarError);
  });

  afterEach(() => {
    window.removeEventListener('app:error', alReportarError);
    axiosInstance.defaults.adapter = adapterOriginal;
  });

  it('hace POST /public/campanias/enlace con { codigo } y devuelve solo profesional y servicio', async () => {
    responder(200, ok({ valido: true, accion: 'reservar', profesional_id: 'usr_1', servicio_id: 'srv_1' }));

    const destino = await campaniaPublicService.resolverEnlace('Xk92mPq7Lt');

    expect(destino).toEqual({ codigo: 'Xk92mPq7Lt', profesionalId: 'usr_1', servicioId: 'srv_1' });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].method).toBe('post');
    expect(pedidos[0].url).toBe('/public/campanias/enlace');
    expect(JSON.parse(pedidos[0].data as string)).toEqual({ codigo: 'Xk92mPq7Lt' });
  });

  it('servicio_id null es un destino válido: abrir el asistente en el paso de servicios', async () => {
    responder(200, ok({ valido: true, accion: 'reservar', profesional_id: 'usr_1', servicio_id: null }));
    expect(await campaniaPublicService.resolverEnlace('Xk92mPq7Lt')).toEqual({
      codigo: 'Xk92mPq7Lt', profesionalId: 'usr_1', servicioId: null,
    });
  });

  it.each([
    ['valido:false', ok({ valido: false })],
    ['valido no booleano', ok({ valido: 'true', profesional_id: 'usr_1' })],
    ['sin profesional', ok({ valido: true, accion: 'reservar' })],
    ['una acción que este front no conoce', ok({ valido: true, accion: 'otra_cosa', profesional_id: 'usr_1' })],
    ['respuesta sin data', { success: true }],
  ])('%s → null', async (_caso, cuerpo) => {
    responder(200, cuerpo);
    expect(await campaniaPublicService.resolverEnlace('Xk92mPq7Lt')).toBeNull();
  });

  it('un 500 devuelve null y NO dispara el modal global de reporte de errores', async () => {
    responder(500, { success: false, message: 'Error interno', requestId: 'req-1' });

    expect(await campaniaPublicService.resolverEnlace('Xk92mPq7Lt')).toBeNull();
    expect(alReportarError).not.toHaveBeenCalled();
  });

  it('testigo: el mismo 500 en un pedido común SÍ lo dispara (el silencio es solo para este pedido)', async () => {
    responder(500, { success: false, message: 'Error interno', requestId: 'req-1' });

    await expect(axiosInstance.get('/public/empresas/x/profesionales')).rejects.toBeTruthy();
    expect(alReportarError).toHaveBeenCalledTimes(1);
  });

  it('un error de red devuelve null, sin reporte', async () => {
    fallarLaRed();
    expect(await campaniaPublicService.resolverEnlace('Xk92mPq7Lt')).toBeNull();
    expect(alReportarError).not.toHaveBeenCalled();
  });

  it('lo que no tiene forma de código ni se consulta', async () => {
    responder(200, ok({ valido: true, profesional_id: 'usr_1' }));

    // El backend exige EXACTAMENTE 10 alfanuméricos: ni 9, ni 11, ni símbolos
    for (const basura of ['', ' ', 'abc', 'Xk92mPq7L', 'Xk92mPq7Ltt', 'Xk92mPq7L-', 'Xk92 mPq7L', 'ñandúñandú', '<script>', 'a'.repeat(16), '../etc']) {
      expect(esCodigoDeEnlace(basura)).toBe(false);
      expect(await campaniaPublicService.resolverEnlace(basura)).toBeNull();
    }
    expect(esCodigoDeEnlace(null)).toBe(false);
    expect(esCodigoDeEnlace(undefined)).toBe(false);
    expect(esCodigoDeEnlace('Xk92mPq7Lt')).toBe(true);
    expect(pedidos).toHaveLength(0);
  });
});

// Spec §17 T2-Q6: el código dura toda la visita, aunque la landing se remonte.
describe('código de la visita en sessionStorage', () => {
  const CLAVE = 'debsalon:campania:codigo';

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('guarda solo el código y cuándo se guardó, y lo devuelve', () => {
    guardarCodigoDeVisita('Xk92mPq7Lt');

    const crudo = JSON.parse(window.sessionStorage.getItem(CLAVE) as string);
    expect(Object.keys(crudo).sort()).toEqual(['codigo', 'guardado_at']);
    expect(leerCodigoDeVisita()).toBe('Xk92mPq7Lt');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();   // nunca en disco
  });

  it('no guarda algo que no tiene forma de código', () => {
    guardarCodigoDeVisita('abc');
    expect(window.sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('vence a las 24 h: a las 24 h exactas todavía vale, un minuto después no (y se borra)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-21T13:00:00.000Z'));
    guardarCodigoDeVisita('Xk92mPq7Lt');

    vi.setSystemTime(new Date('2026-09-22T13:00:00.000Z'));
    expect(leerCodigoDeVisita()).toBe('Xk92mPq7Lt');

    vi.setSystemTime(new Date('2026-09-22T13:01:00.000Z'));
    expect(leerCodigoDeVisita()).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('olvidarlo lo borra', () => {
    guardarCodigoDeVisita('Xk92mPq7Lt');
    olvidarCodigoDeVisita();
    expect(leerCodigoDeVisita()).toBeNull();
  });

  it('lo guardado roto o manoseado se ignora y se borra', () => {
    for (const crudo of ['{{no-json', 'null', '"texto"', JSON.stringify({ codigo: 'abc', guardado_at: Date.now() }), JSON.stringify({ codigo: 'Xk92mPq7Lt' })]) {
      window.sessionStorage.setItem(CLAVE, crudo);
      expect(leerCodigoDeVisita()).toBeNull();
      expect(window.sessionStorage.getItem(CLAVE)).toBeNull();
    }
  });

  it('si sessionStorage tira error, nada explota', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });
    try {
      expect(() => guardarCodigoDeVisita('Xk92mPq7Lt')).not.toThrow();
      expect(leerCodigoDeVisita()).toBeNull();
      expect(() => olvidarCodigoDeVisita()).not.toThrow();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    }
  });
});
