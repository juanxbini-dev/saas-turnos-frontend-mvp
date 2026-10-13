import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import axiosInstance from '../../api/axiosInstance';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { useSeguimientoTurno } from '../../hooks/useSeguimientoTurno';
import { turnoWeb } from '../fixtures/seguimiento.fixtures';

// Spec seguimiento-reservas §8 caso 24

vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const get = (axiosInstance as unknown as { get: ReturnType<typeof vi.fn> }).get;

describe('useSeguimientoTurno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SEGUIMIENTO));
  });

  it('con el modal cerrado no pide nada', async () => {
    const { result } = renderHook(() => useSeguimientoTurno('tur-1', false));
    await new Promise((r) => setTimeout(r, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });
  });

  it('sin id tampoco pide nada', async () => {
    renderHook(() => useSeguimientoTurno(null, true));
    await new Promise((r) => setTimeout(r, 20));
    expect(get).not.toHaveBeenCalled();
  });

  it('abierto: pide por axiosInstance a /api/turnos/:id/seguimiento y devuelve la data', async () => {
    const data = turnoWeb();
    get.mockResolvedValueOnce({ data: { success: true, data } });

    const { result } = renderHook(() => useSeguimientoTurno('tur-1', true));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(get).toHaveBeenCalledWith('/api/turnos/tur-1/seguimiento');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('cachea con la clave "seguimiento" y TTL corto (1 minuto)', async () => {
    const set = vi.spyOn(cacheService, 'set');
    get.mockResolvedValueOnce({ data: { data: turnoWeb() } });

    const { result } = renderHook(() => useSeguimientoTurno('tur-1', true));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    const llamada = set.mock.calls.find(([key]) => key === buildKey(ENTITIES.SEGUIMIENTO, 'tur-1'));
    expect(llamada).toBeTruthy();
    expect(llamada?.[0]).toContain(':seguimiento:tur-1');
    expect(llamada?.[2]).toBe(TTL.SHORT);
    expect(TTL.SHORT).toBe(60 * 1000);
  });

  it('un 404 se traduce a un mensaje para el usuario', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } });
    const { result } = renderHook(() => useSeguimientoTurno('tur-x', true));
    await waitFor(() => expect(result.current.error).toBe('No encontramos este turno o no tenés acceso a su detalle.'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('otro error muestra un mensaje genérico', async () => {
    get.mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useSeguimientoTurno('tur-y', true));
    await waitFor(() => expect(result.current.error).toMatch(/No pudimos cargar/));
  });
});
