/**
 * Tests para ExcepcionModal.
 *
 * Cubre principalmente el fix 5.4 — bug de timezone al calcular el mes/año
 * usado en la key de invalidación de caché de DISPONIBILIDAD. Antes el modal
 * hacía `new Date('2026-05-01').getMonth() + 1` lo que en GMT-3 resolvía al
 * mes anterior (abril) porque `new Date(YYYY-MM-DD)` interpreta el string
 * como UTC midnight y la conversión a hora local lo retrocede un día.
 *
 * También verifica:
 *   - Uso de `profesionalId` prop vs `authUser.id` para el ownerId de la key
 *   - Payload condicional según `disponible`
 *   - Validaciones de form (sin fecha, hora_fin <= hora_inicio)
 *   - Las únicas opciones de intervalo son 60 y 120
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    createExcepcion: vi.fn(),
    updateExcepcion: vi.fn(),
  },
}));

vi.mock('../../cache/cache.service', () => ({
  cacheService: {
    invalidate: vi.fn(),
    invalidateByPrefix: vi.fn(),
  },
}));

vi.mock('../../cache/key.builder', () => ({
  buildKey: vi.fn((entity: string, ...parts: string[]) =>
    ['tenant', entity, ...parts].join(':')
  ),
  ENTITIES: {
    DISPONIBILIDAD: 'disponibilidad',
    SLOTS: 'slots',
    CONFIGURACION: 'configuracion',
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { ExcepcionModal } from '../../components/turnos/ExcepcionModal';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { cacheService } from '../../cache/cache.service';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeAuthUser = {
  id: 'auth-user-123',
  email: 'profesional@test.com',
  nombre: 'Profesional Test',
  roles: ['profesional'],
  tenant: 'empresa-1',
};

function setupAuth(authUser: typeof fakeAuthUser | null = fakeAuthUser) {
  (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    state: {
      authUser,
      status: authUser ? 'authenticated' : 'unauthenticated',
      roles: authUser?.roles || [],
    },
  });
}

const defaultProps = {
  excepcion: null,
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

// Llena el form con fecha y submitea. Asume excepcion=null (modo crear).
async function llenarYSubmit(fecha: string, opts?: { horaInicio?: string; horaFin?: string }) {
  // Inputs type="date" / type="time" no tienen label asociado vía htmlFor
  // — los buscamos por tipo.
  const inputs = document.querySelectorAll('input');
  const inputFecha = Array.from(inputs).find((i) => i.type === 'date') as HTMLInputElement;
  fireEvent.change(inputFecha, { target: { value: fecha } });

  // Por default `disponible=true` y se muestran los time inputs
  if (opts?.horaInicio || opts?.horaFin) {
    const timeInputs = Array.from(document.querySelectorAll('input')).filter(
      (i) => i.type === 'time'
    ) as HTMLInputElement[];
    if (opts.horaInicio && timeInputs[0]) {
      fireEvent.change(timeInputs[0], { target: { value: opts.horaInicio } });
    }
    if (opts.horaFin && timeInputs[1]) {
      fireEvent.change(timeInputs[1], { target: { value: opts.horaFin } });
    }
  }

  await act(async () => {
    fireEvent.click(screen.getByText('Crear'));
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  // El componente seta `min={new Date().toISOString().split('T')[0]}` en el
  // input[type=date]. JSDOM 26+ implementa constraint validation completa: al
  // submit del form, `reportValidity()` detecta `rangeUnderflow` cuando la
  // fecha es < min y CANCELA el submit (handleSubmit nunca corre). Fijamos
  // "hoy" en 2025-01-01 para que las fechas de los tests (2026-01-01,
  // 2026-05-01, 2026-05-15, 2026-12-01) queden todas >= min.
  // Solo fakeamos `Date` para no congelar setTimeout (waitFor lo necesita).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExcepcionModal — cache invalidation (fix 5.4 timezone)', () => {
  it('crear excepción con fecha 2026-05-01 invalida disponibilidad con key que termina en 5-2026 (no 4-2026)', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-1' });

    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-05-01', { horaInicio: '09:00', horaFin: '17:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    // Buscar entre todas las llamadas a invalidate la que sea de DISPONIBILIDAD
    const invalidateCalls = (cacheService.invalidate as ReturnType<typeof vi.fn>).mock.calls;
    const dispoCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':disponibilidad:')
    );

    expect(dispoCall).toBeDefined();
    // La key debe terminar con "5-2026" (mes 5 = mayo, año 2026)
    expect(dispoCall![0]).toMatch(/5-2026$/);
    expect(dispoCall![0]).not.toMatch(/4-2026$/);
  });

  it('crear excepción con fecha 2026-12-01 invalida con 12-2026 (no 11-2026)', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-2' });

    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-12-01', { horaInicio: '09:00', horaFin: '17:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const invalidateCalls = (cacheService.invalidate as ReturnType<typeof vi.fn>).mock.calls;
    const dispoCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':disponibilidad:')
    );

    expect(dispoCall).toBeDefined();
    expect(dispoCall![0]).toMatch(/12-2026$/);
    expect(dispoCall![0]).not.toMatch(/11-2026$/);
  });

  it('crear excepción con fecha 2026-01-01 invalida con 1-2026 (no 12-2025)', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-3' });

    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-01-01', { horaInicio: '09:00', horaFin: '17:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const invalidateCalls = (cacheService.invalidate as ReturnType<typeof vi.fn>).mock.calls;
    const dispoCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':disponibilidad:')
    );

    expect(dispoCall).toBeDefined();
    expect(dispoCall![0]).toMatch(/1-2026$/);
    expect(dispoCall![0]).not.toMatch(/12-2025$/);
  });

  it('usa profesionalId (prop) cuando viene seteado — caso super_admin actuando', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-4' });

    render(
      <ExcepcionModal
        {...defaultProps}
        profesionalId="prof-suplantado-999"
      />
    );

    await llenarYSubmit('2026-05-15', { horaInicio: '09:00', horaFin: '17:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const invalidateCalls = (cacheService.invalidate as ReturnType<typeof vi.fn>).mock.calls;
    const slotsCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':slots:')
    );
    const dispoCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':disponibilidad:')
    );

    expect(slotsCall![0]).toContain('prof-suplantado-999');
    expect(dispoCall![0]).toContain('prof-suplantado-999');
    // NO debe usar el id del usuario autenticado
    expect(slotsCall![0]).not.toContain('auth-user-123');
    expect(dispoCall![0]).not.toContain('auth-user-123');
  });

  it('usa authUser.id cuando profesionalId NO viene seteado', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-5' });

    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-05-15', { horaInicio: '09:00', horaFin: '17:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const invalidateCalls = (cacheService.invalidate as ReturnType<typeof vi.fn>).mock.calls;
    const slotsCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':slots:')
    );
    const dispoCall = invalidateCalls.find(
      ([k]) => typeof k === 'string' && k.includes(':disponibilidad:')
    );

    expect(slotsCall![0]).toContain('auth-user-123');
    expect(dispoCall![0]).toContain('auth-user-123');
  });
});

describe('ExcepcionModal — payload condicional', () => {
  it('submit con disponible=false NO envía hora_inicio/hora_fin/intervalo_minutos al servicio', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-6' });

    render(<ExcepcionModal {...defaultProps} />);

    // Llenar fecha
    const inputFecha = Array.from(document.querySelectorAll('input')).find(
      (i) => i.type === 'date'
    ) as HTMLInputElement;
    fireEvent.change(inputFecha, { target: { value: '2026-05-15' } });

    // Cambiar el select de disponibilidad a "false"
    const selectDisp = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(selectDisp, { target: { value: 'false' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const [payload] = (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [Record<string, unknown>];

    expect(payload.fecha).toBe('2026-05-15');
    expect(payload.disponible).toBe(false);
    expect(payload).not.toHaveProperty('hora_inicio');
    expect(payload).not.toHaveProperty('hora_fin');
    expect(payload).not.toHaveProperty('intervalo_minutos');
  });

  it('submit con disponible=true SÍ envía hora_inicio/hora_fin/intervalo_minutos', async () => {
    (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'exc-7' });

    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-05-15', { horaInicio: '10:00', horaFin: '18:00' });

    await waitFor(() => {
      expect(disponibilidadService.createExcepcion).toHaveBeenCalled();
    });

    const [payload] = (disponibilidadService.createExcepcion as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [Record<string, unknown>];

    expect(payload.disponible).toBe(true);
    expect(payload.hora_inicio).toBe('10:00');
    expect(payload.hora_fin).toBe('18:00');
    // El default del intervalo es '60' → parseInt → 60
    expect(payload.intervalo_minutos).toBe(60);
  });
});

describe('ExcepcionModal — validaciones', () => {
  it('sin fecha NO llama al servicio', async () => {
    render(<ExcepcionModal {...defaultProps} />);

    // Llenar horas pero NO fecha
    const timeInputs = Array.from(document.querySelectorAll('input')).filter(
      (i) => i.type === 'time'
    ) as HTMLInputElement[];
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '17:00' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    expect(disponibilidadService.createExcepcion).not.toHaveBeenCalled();
    // Y debe mostrar el mensaje de error
    expect(screen.getByText('La fecha es requerida')).toBeInTheDocument();
  });

  it('con disponible=true pero hora_fin <= hora_inicio NO llama al servicio', async () => {
    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-05-15', { horaInicio: '14:00', horaFin: '10:00' });

    expect(disponibilidadService.createExcepcion).not.toHaveBeenCalled();
    expect(
      screen.getByText('La hora de fin debe ser mayor a la hora de inicio')
    ).toBeInTheDocument();
  });

  it('con hora_fin igual a hora_inicio tampoco llama al servicio', async () => {
    render(<ExcepcionModal {...defaultProps} />);

    await llenarYSubmit('2026-05-15', { horaInicio: '10:00', horaFin: '10:00' });

    expect(disponibilidadService.createExcepcion).not.toHaveBeenCalled();
  });
});

describe('ExcepcionModal — opciones de intervalo', () => {
  it('el select de intervalo solo muestra opciones 60 y 120 (no 15 ni 30)', () => {
    render(<ExcepcionModal {...defaultProps} />);

    // El form muestra el select de intervalo solo cuando disponible=true (default).
    // Hay 2 selects: el de disponibilidad y el de intervalo. Tomamos los <option>
    // del select de intervalo (que es el segundo) por su `value` numérico.
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBe(2);

    const intervaloSelect = selects[1] as HTMLSelectElement;
    const opciones = Array.from(intervaloSelect.querySelectorAll('option')).map(
      (o) => o.value
    );

    expect(opciones).toEqual(['60', '120']);
    expect(opciones).not.toContain('15');
    expect(opciones).not.toContain('30');
  });
});
