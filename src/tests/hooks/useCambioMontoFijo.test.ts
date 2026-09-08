import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  alcanceMontoFijoPorDefecto,
  aplicarCambioMontoFijo,
  useCambioMontoFijo,
} from '../../hooks/useCambioMontoFijo';

// Caso B28 de docs/gastos-v3-casos-qa.md (backend/docs): la regla de alcance se
// extrajo de EditarGastoModal a este hook y la usan el modal y la tabla. Si el
// hook cruza los caminos, se rompe en los dos lugares a la vez. Hoy = 15/09/2026.

const actualizarRecurrente = vi.fn();
const reemplazarRecurrente = vi.fn();
const guardarOverride = vi.fn();

vi.mock('../../services/gastos.service', () => ({
  gastosService: {
    actualizarRecurrente: (...args: unknown[]) => actualizarRecurrente(...args),
    reemplazarRecurrente: (...args: unknown[]) => reemplazarRecurrente(...args),
    guardarOverride: (...args: unknown[]) => guardarOverride(...args),
  },
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  vi.clearAllMocks();
  actualizarRecurrente.mockResolvedValue({ id: 'rec-alq' });
  reemplazarRecurrente.mockResolvedValue({ id: 'rec-alq-nuevo' });
  guardarOverride.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('alcanceMontoFijoPorDefecto', () => {
  it('mes pasado → solo este mes; mes actual o futuro → desde este mes', () => {
    expect(alcanceMontoFijoPorDefecto('2026-08')).toBe('solo_este_mes');
    expect(alcanceMontoFijoPorDefecto('2026-09')).toBe('desde_este_mes');
    expect(alcanceMontoFijoPorDefecto('2026-10')).toBe('desde_este_mes');
    expect(alcanceMontoFijoPorDefecto('2025-12')).toBe('solo_este_mes');   // cambio de año
  });
});

describe('aplicarCambioMontoFijo', () => {
  it('solo este mes → override del mes, nada más', async () => {
    const id = await aplicarCambioMontoFijo('rec-alq', '2026-09', 750000, 'solo_este_mes');

    expect(guardarOverride).toHaveBeenCalledWith('rec-alq', '2026-09', { monto: 750000 });
    expect(reemplazarRecurrente).not.toHaveBeenCalled();
    expect(actualizarRecurrente).not.toHaveBeenCalled();
    expect(id).toBe('rec-alq');
  });

  it('desde este mes → reemplaza la plantilla y devuelve el id de la nueva', async () => {
    const id = await aplicarCambioMontoFijo('rec-alq', '2026-09', 750000, 'desde_este_mes');

    expect(reemplazarRecurrente).toHaveBeenCalledWith('rec-alq', '2026-09', 750000);
    expect(guardarOverride).not.toHaveBeenCalled();
    expect(actualizarRecurrente).not.toHaveBeenCalled();
    expect(id).toBe('rec-alq-nuevo');
  });

  it('siempre → corrige el monto base de la plantilla, nada más', async () => {
    const id = await aplicarCambioMontoFijo('rec-alq', '2026-09', 750000, 'siempre');

    expect(actualizarRecurrente).toHaveBeenCalledWith('rec-alq', { monto_default: 750000 });
    expect(guardarOverride).not.toHaveBeenCalled();
    expect(reemplazarRecurrente).not.toHaveBeenCalled();
    expect(id).toBe('rec-alq');
  });

  it('desde el modal (con estado/notas del mes): con "desde este mes" el override va a la plantilla NUEVA, no a la cerrada', async () => {
    await aplicarCambioMontoFijo('rec-alq', '2026-09', 750000, 'desde_este_mes', { estado: 'pagado', notas: 'ok' });

    expect(reemplazarRecurrente).toHaveBeenCalledWith('rec-alq', '2026-09', 750000);
    expect(guardarOverride).toHaveBeenCalledWith('rec-alq-nuevo', '2026-09', { estado: 'pagado', notas: 'ok' });
  });

  it('desde el modal con "solo este mes": monto y el resto van en un solo override', async () => {
    await aplicarCambioMontoFijo('rec-alq', '2026-09', 750000, 'solo_este_mes', { estado: 'pagado' });

    expect(guardarOverride).toHaveBeenCalledTimes(1);
    expect(guardarOverride).toHaveBeenCalledWith('rec-alq', '2026-09', { monto: 750000, estado: 'pagado' });
  });
});

describe('useCambioMontoFijo', () => {
  it('arranca con el default del mes y aplica el alcance elegido', async () => {
    const { result } = renderHook(() => useCambioMontoFijo('2026-08'));
    expect(result.current.alcance).toBe('solo_este_mes');
    expect(result.current.esMesPasado).toBe(true);

    act(() => result.current.setAlcance('siempre'));
    await act(async () => { await result.current.aplicar('rec-alq', 750000); });

    expect(actualizarRecurrente).toHaveBeenCalledWith('rec-alq', { monto_default: 750000 });
    expect(guardarOverride).not.toHaveBeenCalled();
  });

  it('reset vuelve al default del mes', () => {
    const { result } = renderHook(() => useCambioMontoFijo('2026-09'));
    act(() => result.current.setAlcance('siempre'));
    act(() => result.current.reset());

    expect(result.current.alcance).toBe('desde_este_mes');
  });
});
