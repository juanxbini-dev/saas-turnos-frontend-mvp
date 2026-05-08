import { vi } from 'vitest';
import axiosInstance from '../../api/axiosInstance';
import { turnoService } from '../../services/turno.service';

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

describe('turnoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── finalizarTurno ─────────────────────────────────────────────────────────

  describe('finalizarTurno', () => {
    const payload = {
      metodoPago: 'efectivo' as const,
      precioModificado: undefined,
      descuentoPorcentaje: undefined,
      descuentoAplicarA: { servicio: true, productos: true },
      productos: undefined,
    };

    it('llama a axiosInstance.put con la URL correcta y el payload', async () => {
      const turnoFake = { id: 'turno-1', estado: 'completado' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      await turnoService.finalizarTurno('id-123', payload);

      expect(axiosMock.put).toHaveBeenCalledWith('/api/turnos/id-123/finalizar', payload);
    });

    it('retorna response.data.data', async () => {
      const turnoFake = { id: 'id-123', estado: 'completado' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      const result = await turnoService.finalizarTurno('id-123', payload);

      expect(result).toEqual(turnoFake);
    });

    it('llama a put exactamente una vez', async () => {
      axiosMock.put.mockResolvedValueOnce({ data: { data: {} } });

      await turnoService.finalizarTurno('id-123', payload);

      expect(axiosMock.put).toHaveBeenCalledTimes(1);
    });

    it('propaga el error si axios lanza', async () => {
      const error = new Error('Network Error');
      axiosMock.put.mockRejectedValueOnce(error);

      await expect(turnoService.finalizarTurno('id-123', payload)).rejects.toThrow('Network Error');
    });
  });

  // ─── editarPago ─────────────────────────────────────────────────────────────

  describe('editarPago', () => {
    const payload = {
      metodoPago: 'transferencia' as const,
      precioModificado: 2000,
      descuentoPorcentaje: 10,
      descuentoAplicarA: { servicio: true, productos: false },
      productos: [],
    };

    it('llama a axiosInstance.put con la URL /editar-pago y el payload', async () => {
      const turnoFake = { id: 'id-123', metodo_pago: 'transferencia' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      await turnoService.editarPago('id-123', payload);

      expect(axiosMock.put).toHaveBeenCalledWith('/api/turnos/id-123/editar-pago', payload);
    });

    it('retorna response.data.data', async () => {
      const turnoFake = { id: 'id-123', metodo_pago: 'transferencia' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      const result = await turnoService.editarPago('id-123', payload);

      expect(result).toEqual(turnoFake);
    });

    it('propaga el error si axios lanza', async () => {
      const error = new Error('500 Server Error');
      axiosMock.put.mockRejectedValueOnce(error);

      await expect(turnoService.editarPago('id-123', payload)).rejects.toThrow('500 Server Error');
    });
  });

  // ─── confirmarTurno ─────────────────────────────────────────────────────────

  describe('confirmarTurno', () => {
    it('llama a put con { estado: "confirmado" }', async () => {
      axiosMock.put.mockResolvedValueOnce({ data: { data: { id: 'id-456', estado: 'confirmado' } } });

      await turnoService.confirmarTurno('id-456');

      expect(axiosMock.put).toHaveBeenCalledWith('/api/turnos/id-456/estado', { estado: 'confirmado' });
    });

    it('retorna response.data.data', async () => {
      const turnoFake = { id: 'id-456', estado: 'confirmado' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      const result = await turnoService.confirmarTurno('id-456');

      expect(result).toEqual(turnoFake);
    });

    it('propaga el error si axios lanza', async () => {
      axiosMock.put.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(turnoService.confirmarTurno('id-456')).rejects.toThrow('Unauthorized');
    });
  });

  // ─── cancelarTurno ──────────────────────────────────────────────────────────

  describe('cancelarTurno', () => {
    it('llama a put con { estado: "cancelado" }', async () => {
      axiosMock.put.mockResolvedValueOnce({ data: { data: { id: 'id-789', estado: 'cancelado' } } });

      await turnoService.cancelarTurno('id-789');

      expect(axiosMock.put).toHaveBeenCalledWith('/api/turnos/id-789/estado', { estado: 'cancelado' });
    });

    it('retorna response.data.data', async () => {
      const turnoFake = { id: 'id-789', estado: 'cancelado' };
      axiosMock.put.mockResolvedValueOnce({ data: { data: turnoFake } });

      const result = await turnoService.cancelarTurno('id-789');

      expect(result).toEqual(turnoFake);
    });

    it('propaga el error si axios lanza', async () => {
      axiosMock.put.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(turnoService.cancelarTurno('id-789')).rejects.toThrow('Forbidden');
    });

    it('llama a put exactamente una vez', async () => {
      axiosMock.put.mockResolvedValueOnce({ data: { data: {} } });

      await turnoService.cancelarTurno('id-789');

      expect(axiosMock.put).toHaveBeenCalledTimes(1);
    });
  });
});
