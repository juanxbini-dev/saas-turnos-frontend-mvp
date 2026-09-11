import { vi, describe, it, expect, beforeEach } from 'vitest';
import axiosInstance from '../../api/axiosInstance';
import { campaniasService } from '../../services/campanias.service';

// Casos VP2, VP3 y CS13 de backend/docs/campanias-frontend-v1-casos-qa.md (contrato con el backend).

vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

const axiosMock = axiosInstance as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe('campaniasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.get.mockResolvedValue({ data: { success: true, data: { recencia: [] } } });
    axiosMock.put.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it('VP2: el dry-run de "Todas las prendidas" no manda tipo (ni vacío ni "undefined")', async () => {
    await campaniasService.dryRun();
    await campaniasService.dryRun(undefined);
    await campaniasService.dryRun('' as never);

    for (const [url] of axiosMock.get.mock.calls) {
      expect(url).toBe('/api/campanias/dry-run');
    }
    expect(axiosMock.get).toHaveBeenCalledTimes(3);
  });

  it('VP3: el dry-run de una campaña puntual manda su código como tipo y devuelve data desenvuelto', async () => {
    const data = await campaniasService.dryRun('recencia');

    expect(axiosMock.get).toHaveBeenCalledWith('/api/campanias/dry-run?tipo=recencia');
    expect(data).toEqual({ recencia: [] });
  });

  it('CS13: guardar manda solo { habilitada, parametros } al PUT de esa campaña', async () => {
    await campaniasService.updateCampania('recencia', false, { ventana_dias: 40, cooldown_dias: 15 });

    expect(axiosMock.put).toHaveBeenCalledTimes(1);
    const [url, body] = axiosMock.put.mock.calls[0];
    expect(url).toBe('/api/campanias/recencia');
    expect(body).toEqual({ habilitada: false, parametros: { ventana_dias: 40, cooldown_dias: 15 } });
    expect(Object.keys(body).sort()).toEqual(['habilitada', 'parametros']);
  });
});
