import { vi } from 'vitest';
import axiosInstance from '../../api/axiosInstance';
import { finanzasService } from '../../services/finanzas.service';

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const axiosMock = axiosInstance as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

const filtrosBase = {
  fecha_desde: '2026-04-01',
  fecha_hasta: '2026-04-30',
  metodo_pago: 'todos',
  estado_comision: 'todos',
  ordenar_por: 'fecha',
  orden: 'desc',
  pagina: 1,
  por_pagina: 20,
};

describe('finanzasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getMyFinanzas ──────────────────────────────────────────────────────────

  describe('getMyFinanzas', () => {
    it('llama a GET /api/finanzas/me con todos los filtros como query params', async () => {
      const responseData = { data: [], total: 0 };
      axiosMock.get.mockResolvedValueOnce({ data: responseData });

      await finanzasService.getMyFinanzas(filtrosBase);

      expect(axiosMock.get).toHaveBeenCalledTimes(1);
      const [url] = axiosMock.get.mock.calls[0] as [string];
      expect(url).toContain('/api/finanzas/me');
      expect(url).toContain('fecha_desde=2026-04-01');
      expect(url).toContain('fecha_hasta=2026-04-30');
      expect(url).toContain('metodo_pago=todos');
      expect(url).toContain('estado_comision=todos');
      expect(url).toContain('ordenar_por=fecha');
      expect(url).toContain('orden=desc');
      expect(url).toContain('pagina=1');
      expect(url).toContain('por_pagina=20');
    });

    it('retorna response.data directamente', async () => {
      const responseData = { data: [{ id: '1' }], total: 1 };
      axiosMock.get.mockResolvedValueOnce({ data: responseData });

      const result = await finanzasService.getMyFinanzas(filtrosBase);

      expect(result).toEqual(responseData);
    });

    it('propaga el error si axios lanza', async () => {
      axiosMock.get.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(finanzasService.getMyFinanzas(filtrosBase)).rejects.toThrow('Unauthorized');
    });
  });

  // ─── getFinanzasByProfesional ───────────────────────────────────────────────

  describe('getFinanzasByProfesional', () => {
    it('llama a GET /api/finanzas/profesional/{id} con los filtros como query params', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });

      await finanzasService.getFinanzasByProfesional('prof-abc', filtrosBase);

      expect(axiosMock.get).toHaveBeenCalledTimes(1);
      const [url] = axiosMock.get.mock.calls[0] as [string];
      expect(url).toContain('/api/finanzas/profesional/prof-abc');
    });

    it('la URL contiene todos los filtros como query params', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });

      await finanzasService.getFinanzasByProfesional('prof-abc', filtrosBase);

      const [url] = axiosMock.get.mock.calls[0] as [string];
      expect(url).toContain('fecha_desde=2026-04-01');
      expect(url).toContain('fecha_hasta=2026-04-30');
      expect(url).toContain('metodo_pago=todos');
      expect(url).toContain('estado_comision=todos');
      expect(url).toContain('pagina=1');
      expect(url).toContain('por_pagina=20');
    });

    it('retorna response.data directamente', async () => {
      const responseData = { data: [{ id: 'fin-1' }], total: 1 };
      axiosMock.get.mockResolvedValueOnce({ data: responseData });

      const result = await finanzasService.getFinanzasByProfesional('prof-abc', filtrosBase);

      expect(result).toEqual(responseData);
    });

    it('usa el profesionalId correcto en la URL', async () => {
      axiosMock.get.mockResolvedValueOnce({ data: {} });

      await finanzasService.getFinanzasByProfesional('otro-id-456', filtrosBase);

      const [url] = axiosMock.get.mock.calls[0] as [string];
      expect(url).toContain('profesional/otro-id-456');
    });

    it('propaga el error si axios lanza', async () => {
      axiosMock.get.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(
        finanzasService.getFinanzasByProfesional('prof-abc', filtrosBase)
      ).rejects.toThrow('Forbidden');
    });
  });

  // ─── cobrarPago ─────────────────────────────────────────────────────────────

  describe('cobrarPago', () => {
    it('llama a PATCH /api/finanzas/cobrar con los campos correctos', async () => {
      axiosMock.patch.mockResolvedValueOnce({ data: {} });

      await finanzasService.cobrarPago('turno', 'turno-1', 'efectivo');

      expect(axiosMock.patch).toHaveBeenCalledWith('/api/finanzas/cobrar', {
        tipo: 'turno',
        id: 'turno-1',
        metodo_pago: 'efectivo',
        metodo_pago_productos: undefined,
      });
    });

    it('sin metodo_pago_productos: el campo se envía como undefined', async () => {
      axiosMock.patch.mockResolvedValueOnce({ data: {} });

      await finanzasService.cobrarPago('venta', 'venta-2', 'transferencia');

      const [, body] = axiosMock.patch.mock.calls[0] as [string, Record<string, unknown>];
      expect(body.metodo_pago_productos).toBeUndefined();
    });

    it('con metodo_pago_productos: el body incluye el campo', async () => {
      axiosMock.patch.mockResolvedValueOnce({ data: {} });

      await finanzasService.cobrarPago('venta_turno', 'combo-3', 'efectivo', 'transferencia');

      const [, body] = axiosMock.patch.mock.calls[0] as [string, Record<string, unknown>];
      expect(body.metodo_pago_productos).toBe('transferencia');
    });

    it('metodo_pago_productos puede ser efectivo también', async () => {
      axiosMock.patch.mockResolvedValueOnce({ data: {} });

      await finanzasService.cobrarPago('turno_solo_servicio', 'srv-4', 'transferencia', 'efectivo');

      const [, body] = axiosMock.patch.mock.calls[0] as [string, Record<string, unknown>];
      expect(body.metodo_pago_productos).toBe('efectivo');
    });

    it('propaga el error si axios lanza', async () => {
      axiosMock.patch.mockRejectedValueOnce(new Error('Payment Error'));

      await expect(
        finanzasService.cobrarPago('turno', 'turno-1', 'efectivo')
      ).rejects.toThrow('Payment Error');
    });
  });
});
