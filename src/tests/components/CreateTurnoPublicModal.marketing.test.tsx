import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';

// Spec campanias-n8n §4.6 / §3.8: el tilde de novedades viene MARCADO, está
// justo antes de confirmar, es opcional y viaja SIEMPRE como true|false.

const createTurno = vi.fn();
const validateCliente = vi.fn();
const getServiciosProfesional = vi.fn();
const resetDisponibilidad = vi.fn();

vi.mock('../../services/public', () => ({
  turnoPublicService: {
    createTurno: (...args: unknown[]) => createTurno(...args),
    validateCliente: (...args: unknown[]) => validateCliente(...args),
  },
  servicioPublicService: {
    getServiciosProfesional: (...args: unknown[]) => getServiciosProfesional(...args),
  },
}));

// Fecha y horario ya elegidos: lo que se prueba acá es el paso 3
vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 9,
    año: 2026,
    selectedDate: '2026-09-25',
    selectedSlot: '15:00',
    availableDates: [],
    slots: [],
    loadingDates: false,
    loadingSlots: false,
    handleMonthChange: vi.fn(),
    handleDateSelect: vi.fn(),
    handleSlotSelect: vi.fn(),
    reset: resetDisponibilidad,
    forceRefresh: vi.fn(),
  }),
}));

const TEXTO_TILDE = 'Quiero recibir novedades de DEB Salón por WhatsApp. Puedo darme de baja cuando quiera.';

const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 10000, duracion_minutos: 30 };

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

const tilde = () => screen.getByLabelText(TEXTO_TILDE) as HTMLInputElement;

async function irAlPaso3() {
  fireEvent.click(await screen.findByText('Corte'));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Resumen del turno');
}

function completarDatos() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
}

describe('CreateTurnoPublicModal — novedades por WhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El Calendar del kit loguea cada día del mes: se calla para no tapar la salida
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // jsdom no implementa scrollIntoView y el modal lo usa al elegir fecha
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: {} });
  });

  it('muestra el tilde marcado por defecto, con el texto literal, después del resumen', async () => {
    renderModal();
    await irAlPaso3();

    expect(tilde().checked).toBe(true);

    // Ubicación: después del resumen y antes del botón de confirmar
    const resumen = screen.getByText('Resumen del turno');
    const confirmar = screen.getByRole('button', { name: 'Confirmar turno' });
    expect(resumen.compareDocumentPosition(tilde()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tilde().compareDocumentPosition(confirmar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con el tilde marcado manda marketing_consentimiento: true', async () => {
    renderModal();
    await irAlPaso3();
    completarDatos();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ marketing_consentimiento: true });
  });

  it('si lo destilda manda marketing_consentimiento: false (no lo omite) y reserva igual', async () => {
    renderModal();
    await irAlPaso3();
    completarDatos();

    fireEvent.click(tilde());
    expect(tilde().checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).toHaveProperty('marketing_consentimiento', false);
  });

  it('al cerrar y volver a abrir, el tilde vuelve a estar marcado', async () => {
    renderModal();
    await irAlPaso3();

    fireEvent.click(tilde());
    expect(tilde().checked).toBe(false);

    // Cerrar dispara resetModal(); el componente sigue montado
    fireEvent.click(document.querySelector('.absolute.inset-0') as HTMLElement);
    expect(resetDisponibilidad).toHaveBeenCalled();

    await irAlPaso3();
    expect(tilde().checked).toBe(true);
  });
});
