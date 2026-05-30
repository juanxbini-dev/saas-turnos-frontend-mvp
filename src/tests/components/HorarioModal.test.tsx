/**
 * Tests para HorarioModal con selector de días (chips).
 *
 * Cubre el caso del cliente: cargar horarios día por día. El modal permite
 * marcar varios días; al crear genera una fila de disponibilidad por cada día
 * seleccionado (dia_inicio === dia_fin). Si algún día se solapa con un horario
 * existente, el backend devuelve 409 y se avisa sin frenar el resto.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    createDisponibilidad: vi.fn(),
    updateDisponibilidad: vi.fn(),
  },
}));

vi.mock('../../cache/cache.service', () => ({
  cacheService: { invalidate: vi.fn(), invalidateByPrefix: vi.fn() },
}));

vi.mock('../../cache/key.builder', () => ({
  buildKey: vi.fn((entity: string, ...parts: string[]) => ['tenant', entity, ...parts].join(':')),
  ENTITIES: { DISPONIBILIDAD: 'disponibilidad', SLOTS: 'slots', CONFIGURACION: 'configuracion' },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import { HorarioModal } from '../../components/turnos/HorarioModal';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { useAuth } from '../../context/AuthContext';

const fakeAuthUser = { id: 'auth-user-123', roles: ['profesional'] };

function setupAuth() {
  (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    state: { authUser: fakeAuthUser, status: 'authenticated', roles: ['profesional'] },
  });
}

const defaultProps = {
  horario: null,
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const clickChip = (corto: string) => fireEvent.click(screen.getByText(corto));

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
});

describe('HorarioModal — crear día por día', () => {
  it('crea una fila por cada día seleccionado (dia_inicio === dia_fin)', async () => {
    (disponibilidadService.createDisponibilidad as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });

    render(<HorarioModal {...defaultProps} />);

    // Marcar Lunes, Martes y Jueves
    clickChip('Lun');
    clickChip('Mar');
    clickChip('Jue');

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    await waitFor(() => {
      expect(disponibilidadService.createDisponibilidad).toHaveBeenCalledTimes(3);
    });

    const calls = (disponibilidadService.createDisponibilidad as ReturnType<typeof vi.fn>).mock.calls;
    const diasCreados = calls.map(([payload]) => payload.dia_inicio).sort();
    expect(diasCreados).toEqual([1, 2, 4]); // Lun=1, Mar=2, Jue=4
    // Cada fila es un único día
    calls.forEach(([payload]) => expect(payload.dia_inicio).toBe(payload.dia_fin));
  });

  it('no llama al servicio si no hay días seleccionados y muestra error', async () => {
    render(<HorarioModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    expect(disponibilidadService.createDisponibilidad).not.toHaveBeenCalled();
    expect(screen.getByText('Seleccioná al menos un día')).toBeInTheDocument();
  });

  it('no llama al servicio si hora_fin <= hora_inicio', async () => {
    render(<HorarioModal {...defaultProps} />);
    clickChip('Lun');

    const timeInputs = Array.from(document.querySelectorAll('input')).filter(i => i.type === 'time');
    fireEvent.change(timeInputs[0], { target: { value: '14:00' } }); // inicio
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } }); // fin

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    expect(disponibilidadService.createDisponibilidad).not.toHaveBeenCalled();
    expect(screen.getByText('La hora de fin debe ser mayor a la hora de inicio')).toBeInTheDocument();
  });

  it('avisa los días que se solapan (409) sin frenar el resto', async () => {
    const svc = disponibilidadService.createDisponibilidad as ReturnType<typeof vi.fn>;
    // Lunes (1) OK, Martes (2) devuelve 409
    svc.mockImplementation(({ dia_inicio }: any) => {
      if (dia_inicio === 2) return Promise.reject({ response: { status: 409 } });
      return Promise.resolve({ id: 'x' });
    });

    render(<HorarioModal {...defaultProps} />);
    clickChip('Lun');
    clickChip('Mar');

    await act(async () => {
      fireEvent.click(screen.getByText('Crear'));
    });

    await waitFor(() => {
      expect(svc).toHaveBeenCalledTimes(2);
    });

    // Se muestra el aviso con el día que falló y no cierra
    expect(screen.getByText(/no se agregaron/i)).toBeInTheDocument();
    expect(defaultProps.onSuccess).toHaveBeenCalled(); // al menos uno se creó → refresca
  });

  it('solo ofrece intervalos de 1 y 2 horas', () => {
    render(<HorarioModal {...defaultProps} />);
    const selects = document.querySelectorAll('select');
    const intervaloSelect = selects[selects.length - 1] as HTMLSelectElement;
    const opciones = Array.from(intervaloSelect.querySelectorAll('option')).map(o => o.value);
    expect(opciones).toEqual(['60', '120']);
  });
});

describe('HorarioModal — editar', () => {
  it('precarga los días del horario existente y actualiza la fila', async () => {
    (disponibilidadService.updateDisponibilidad as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'h1' });

    const horario = {
      id: 'h1',
      profesional_id: 'auth-user-123',
      dia_inicio: 3, // Miércoles
      dia_fin: 3,
      hora_inicio: '10:00:00',
      hora_fin: '14:00:00',
      intervalo_minutos: 60,
      activo: true,
      created_at: '', updated_at: '',
    };

    render(<HorarioModal {...defaultProps} horario={horario as any} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Actualizar'));
    });

    await waitFor(() => {
      expect(disponibilidadService.updateDisponibilidad).toHaveBeenCalledTimes(1);
    });
    const [id, payload] = (disponibilidadService.updateDisponibilidad as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('h1');
    expect(payload.dia_inicio).toBe(3);
    expect(payload.dia_fin).toBe(3);
    expect(payload.hora_inicio).toBe('10:00'); // normalizado a HH:MM
  });
});
