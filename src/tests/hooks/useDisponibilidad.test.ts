/**
 * Tests para el hook useDisponibilidad.
 *
 * El foco principal es el filtro de slots pasados que se aplica cuando
 * `selectedDate === hoy` (fix 5.6). El backend devuelve TODOS los slots del día
 * porque corre en UTC y no conoce la timezone del cliente; el hook debe filtrar
 * los que ya pasaron comparando con la hora local del browser.
 *
 * Estrategia:
 * - Mockear `useFetch` para inyectar los slots / availableDates a placer.
 * - Mockear el resto de dependencias (cacheService, disponibilidadService,
 *   key.builder) para evitar imports reales.
 * - Usar `vi.useFakeTimers()` + `vi.setSystemTime()` para que la fecha/hora
 *   "actual" sea determinista en cada caso.
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(),
}));

vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    getDisponibilidadMes: vi.fn(() => Promise.resolve([])),
    getSlotsDisponibles: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../cache/cache.service', () => ({
  cacheService: {
    invalidate: vi.fn(),
    invalidateByPrefix: vi.fn(),
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

vi.mock('../../cache/key.builder', () => ({
  buildKey: vi.fn((entity: string, ...parts: string[]) =>
    ['tenant', entity, ...parts].join(':')
  ),
  ENTITIES: {
    DISPONIBILIDAD: 'disponibilidad',
    SLOTS: 'slots',
  },
}));

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';

// Helper para configurar el mock de useFetch.
// `useFetch` se llama 2 veces por render (availableDates + slots). Distinguimos
// por el prefijo de la cache key, que en nuestro mock incluye la entidad.
function mockUseFetch(opts: {
  availableDates?: string[];
  slots?: string[] | null;
}) {
  const { availableDates = [], slots = [] } = opts;

  (useFetch as unknown as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockImplementation((key: string | null) => {
      // El builder mockeado construye keys como 'tenant:<entidad>:...'
      if (key && key.includes(':disponibilidad:')) {
        return {
          data: availableDates,
          loading: false,
          error: null,
          revalidate: vi.fn(),
        };
      }
      if (key && key.includes(':slots:')) {
        return {
          data: slots,
          loading: false,
          error: null,
          revalidate: vi.fn(),
        };
      }
      // key === null → no fetcha
      return {
        data: null,
        loading: false,
        error: null,
        revalidate: vi.fn(),
      };
    });
}

// ─── Setup global ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Default: 23 de mayo 2026 a las 14:30 (hora local)
  vi.setSystemTime(new Date(2026, 4, 23, 14, 30, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDisponibilidad — filtro de slots pasados', () => {
  it('si selectedDate === hoy y hora actual 14:30, filtra slots <= 14:30', () => {
    // hora actual: 14:30 → slots <= 14:30 deben quedar fuera
    mockUseFetch({
      slots: ['08:00', '12:00', '14:00', '15:00', '16:00'],
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).toEqual(['15:00', '16:00']);
  });

  it('incluye el caso de igualdad: un slot que coincide EXACTO con la hora actual queda fuera', () => {
    // 14:30 exacto NO debe estar incluido (la comparación es estrictamente >)
    mockUseFetch({
      slots: ['14:30', '14:31', '15:00'],
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).not.toContain('14:30');
    expect(result.current.slots).toContain('14:31');
    expect(result.current.slots).toContain('15:00');
  });

  it('si la hora actual es 23:59 y todos los slots son de la mañana, devuelve []', () => {
    vi.setSystemTime(new Date(2026, 4, 23, 23, 59, 0));

    mockUseFetch({
      slots: ['08:00', '09:00', '10:00', '12:00'],
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).toEqual([]);
  });

  it('si la hora actual es 00:00 ningún slot del día está pasado — devuelve todos', () => {
    vi.setSystemTime(new Date(2026, 4, 23, 0, 0, 0));

    const slotsCompletos = ['00:01', '08:00', '12:00', '18:00', '23:59'];
    mockUseFetch({
      slots: slotsCompletos,
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).toEqual(slotsCompletos);
  });

  it('si selectedDate es una fecha futura (mañana), NO filtra — devuelve los slots tal cual', () => {
    const slotsCompletos = ['00:00', '07:00', '08:00', '14:00', '15:00'];
    mockUseFetch({
      slots: slotsCompletos,
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      // mañana = 24 de mayo 2026
      result.current.handleDateSelect('2026-05-24');
    });

    expect(result.current.slots).toEqual(slotsCompletos);
  });

  it('si selectedDate es una fecha pasada (ayer), NO filtra — devuelve los slots tal cual', () => {
    // Comportamiento intencional: si pediste explícitamente ese día, mostrá
    // lo que vino del backend (puede ser auditoría / informativo).
    const slotsCompletos = ['08:00', '09:00', '14:30', '20:00'];
    mockUseFetch({
      slots: slotsCompletos,
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      // ayer = 22 de mayo 2026
      result.current.handleDateSelect('2026-05-22');
    });

    expect(result.current.slots).toEqual(slotsCompletos);
  });

  it('si slots es null (sin fetch aún), devuelve []', () => {
    mockUseFetch({
      slots: null,
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).toEqual([]);
  });

  it('si slots es array vacío, devuelve [] (independiente de la fecha)', () => {
    mockUseFetch({
      slots: [],
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });

    expect(result.current.slots).toEqual([]);
  });

  it('si selectedDate es null, devuelve [] (el hook no fetcha slots sin fecha)', () => {
    // Cuando selectedDate=null, slotsCacheKey=null y useFetch devuelve data=null.
    // El memo aplica `slots || []` → []
    mockUseFetch({
      slots: ['08:00', '12:00', '15:00'],
    });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    expect(result.current.selectedDate).toBeNull();
    expect(result.current.slots).toEqual([]);
  });
});

// ─── Tests de comportamiento general del hook ──────────────────────────────────

describe('useDisponibilidad — handlers de fecha/mes/slot', () => {
  it('handleDateSelect actualiza selectedDate y resetea selectedSlot', () => {
    mockUseFetch({ slots: [] });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    // Setear un slot primero para verificar que se resetea
    act(() => {
      result.current.handleSlotSelect('10:00');
    });
    expect(result.current.selectedSlot).toBe('10:00');

    act(() => {
      result.current.handleDateSelect('2026-05-30');
    });

    expect(result.current.selectedDate).toBe('2026-05-30');
    expect(result.current.selectedSlot).toBeNull();
  });

  it('handleMonthChange actualiza mes/año y resetea selectedDate y selectedSlot', () => {
    mockUseFetch({ slots: [] });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    // Setear fecha y slot primero
    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });
    act(() => {
      result.current.handleSlotSelect('15:00');
    });

    expect(result.current.selectedDate).toBe('2026-05-23');
    expect(result.current.selectedSlot).toBe('15:00');

    act(() => {
      result.current.handleMonthChange(8, 2027);
    });

    expect(result.current.mes).toBe(8);
    expect(result.current.año).toBe(2027);
    expect(result.current.selectedDate).toBeNull();
    expect(result.current.selectedSlot).toBeNull();
  });

  it('cambiar servicioId resetea selectedDate y selectedSlot (useEffect)', () => {
    mockUseFetch({ slots: [] });

    const { result, rerender } = renderHook(
      ({ servicioId }: { servicioId: string }) =>
        useDisponibilidad('prof-1', servicioId),
      {
        initialProps: { servicioId: 'serv-1' },
      }
    );

    // Setear fecha y slot
    act(() => {
      result.current.handleDateSelect('2026-05-23');
    });
    act(() => {
      result.current.handleSlotSelect('14:00');
    });

    expect(result.current.selectedDate).toBe('2026-05-23');
    expect(result.current.selectedSlot).toBe('14:00');

    // Cambiar servicioId → el useEffect debe resetear ambos
    rerender({ servicioId: 'serv-2' });

    expect(result.current.selectedDate).toBeNull();
    expect(result.current.selectedSlot).toBeNull();
  });

  it('mes y año iniciales coinciden con la fecha actual del sistema', () => {
    // setSystemTime ya configuró: 23 de mayo 2026 → mes=5, año=2026
    mockUseFetch({ slots: [] });

    const { result } = renderHook(() =>
      useDisponibilidad('prof-1', 'serv-1')
    );

    expect(result.current.mes).toBe(5);
    expect(result.current.año).toBe(2026);
  });
});
