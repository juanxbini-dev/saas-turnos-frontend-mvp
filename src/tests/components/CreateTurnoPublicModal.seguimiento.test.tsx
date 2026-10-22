import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';

// Spec seguimiento-reservas §8 caso 20: `modal_accion` en la reserva web.
//  - "Confirmar"   → cliente_id + modal_accion:'confirmar'
//  - "Otros datos" → modal_accion:'otros_datos' SIN cliente_id
//  - sin modal     → no viaja modal_accion (ni cliente_id)
//  - cerrar el modal con la X / el fondo olvida la acción

const createTurno = vi.fn();
const validateCliente = vi.fn();
const getServiciosProfesional = vi.fn();

vi.mock('../../services/public', () => ({
  turnoPublicService: {
    createTurno: (...args: unknown[]) => createTurno(...args),
    validateCliente: (...args: unknown[]) => validateCliente(...args),
  },
  servicioPublicService: {
    getServiciosProfesional: (...args: unknown[]) => getServiciosProfesional(...args),
  },
}));

vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 10,
    año: 2026,
    selectedDate: '2026-10-20',
    selectedSlot: '10:00',
    availableDates: [],
    slots: [],
    loadingDates: false,
    loadingSlots: false,
    handleMonthChange: vi.fn(),
    handleDateSelect: vi.fn(),
    handleSlotSelect: vi.fn(),
    reset: vi.fn(),
    forceRefresh: vi.fn(),
  }),
}));

const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 10000, duracion_minutos: 30 };
const FICHA = { id: 'cli-mama', nombre: 'Marta Pérez', email: 'marta@x.com', telefono: '2915134540' };

const RECONOCIDO = { data: { data: { exists: true, cliente: FICHA } } };
const SIN_MATCH = { data: { data: { exists: false } } };

function renderModal() {
  return render(
    <CreateTurnoPublicModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      profesionalId="prof-1"
      profesionalNombre="Dani"
      empresaSlug="deb-salon"
      empresaId="emp-1"
    />
  );
}

async function irAlPaso3() {
  fireEvent.click(await screen.findByText('Corte'));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Resumen del turno');
}

function completarDatos() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucía' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'lucia@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
}

async function confirmarHastaElModal() {
  renderModal();
  await irAlPaso3();
  completarDatos();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
  await screen.findByText('Te reconocemos');
}

describe('CreateTurnoPublicModal — modal_accion (seguimiento de reservas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    createTurno.mockResolvedValue({ data: {} });
  });

  it('"Confirmar" manda cliente_id de la ficha mostrada + modal_accion:"confirmar"', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ cliente_id: 'cli-mama', modal_accion: 'confirmar' });
  });

  it('"Otros datos" manda modal_accion:"otros_datos" y NO manda cliente_id', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    fireEvent.click(screen.getByRole('button', { name: 'Otros datos' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).toHaveProperty('modal_accion', 'otros_datos');
    expect(payload).not.toHaveProperty('cliente_id');
    // Lo tipeado viaja igual: el backend crea la ficha nueva con esto
    expect(payload.cliente_data).toMatchObject({ nombre: 'Lucía Pérez', telefono: '291 513-4540' });
  });

  it('sin match (no hubo modal) no manda modal_accion ni cliente_id', async () => {
    validateCliente.mockResolvedValue(SIN_MATCH);
    renderModal();
    await irAlPaso3();
    completarDatos();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).not.toHaveProperty('modal_accion');
    expect(payload).not.toHaveProperty('cliente_id');
  });

  it.each([
    ['la X', () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))],
    ['el fondo', () => {
      const titulo = screen.getByText('Te reconocemos');
      const capa = titulo.closest('.fixed')?.querySelector(':scope > .absolute.inset-0') as HTMLElement;
      fireEvent.click(capa);
    }],
  ])('cerrar el modal con %s no reserva, y al reenviar sin match no viaja ninguna acción', async (_como, cerrar) => {
    validateCliente.mockResolvedValueOnce(RECONOCIDO).mockResolvedValueOnce(SIN_MATCH);
    await confirmarHastaElModal();

    cerrar();
    expect(screen.queryByText('Te reconocemos')).toBeNull();
    expect(createTurno).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).not.toHaveProperty('modal_accion');
    expect(payload).not.toHaveProperty('cliente_id');
  });

  it('cerrar con la X y volver a ver el modal: "Otros datos" sigue sin cliente_id', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await screen.findByText('Te reconocemos');
    fireEvent.click(screen.getByRole('button', { name: 'Otros datos' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toHaveProperty('modal_accion', 'otros_datos');
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('cliente_id');
  });
});
