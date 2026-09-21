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

function renderModal(extra: Partial<React.ComponentProps<typeof CreateTurnoPublicModal>> = {}) {
  return render(
    <CreateTurnoPublicModal
      {...extra}
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

  it('el tilde está FIJO junto al botón de confirmar, fuera de la zona que se desplaza', async () => {
    // Viene tildado: si quedara al final del contenido desplazable, en una pantalla
    // chica se podría confirmar sin haberlo visto nunca (le pasó a Juan probando).
    renderModal();
    await irAlPaso3();

    expect(tilde().closest('.overflow-y-auto')).toBeNull();
    const enlace = screen.getByRole('link', { name: 'Ver política de privacidad' });
    expect(enlace.closest('.overflow-y-auto')).toBeNull();
    // El resumen sí sigue dentro de la zona desplazable
    expect(screen.getByText('Resumen del turno').closest('.overflow-y-auto')).not.toBeNull();
  });

  it('el tilde no aparece en los pasos 1 y 2', async () => {
    renderModal();
    await waitFor(() => expect(screen.queryByText(/Quiero recibir novedades/)).toBeNull());
  });

  it('con el tilde marcado manda marketing_consentimiento: true', async () => {
    renderModal();
    await irAlPaso3();
    completarDatos();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ marketing_consentimiento: true });
    // Reserva común, sin mensaje de por medio: el campo de campaña NO viaja
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('campania_codigo');
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

  // ---- Política de privacidad junto al tilde (spec §16 y §17) ----

  it('"Ver política de privacidad" abre /privacidad en pestaña nueva y está FUERA del label del tilde', async () => {
    renderModal();
    await irAlPaso3();

    const enlace = screen.getByRole('link', { name: 'Ver política de privacidad' });
    expect(enlace.getAttribute('href')).toBe('/privacidad');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(enlace.closest('label')).toBeNull();
    // Y antes del botón de confirmar, al lado del tilde
    const confirmar = screen.getByRole('button', { name: 'Confirmar turno' });
    expect(tilde().compareDocumentPosition(enlace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(enlace.compareDocumentPosition(confirmar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tocar el enlace NO cambia el tilde ni pierde lo cargado (destildarlo registraría una baja)', async () => {
    renderModal();
    await irAlPaso3();
    completarDatos();
    expect(tilde().checked).toBe(true);

    fireEvent.click(screen.getByRole('link', { name: 'Ver política de privacidad' }));

    expect(tilde().checked).toBe(true);
    expect((screen.getByPlaceholderText('Tu nombre') as HTMLInputElement).value).toBe('Juan');
    expect(screen.getByText('Resumen del turno')).toBeTruthy();

    // Y al revés: con el tilde sacado a propósito, el enlace tampoco lo vuelve a marcar
    fireEvent.click(tilde());
    fireEvent.click(screen.getByRole('link', { name: 'Ver política de privacidad' }));
    expect(tilde().checked).toBe(false);
  });

  // ---- Llegada desde el botón del mensaje (spec §15.5) ----

  it('con servicioInicialId válido arranca en el paso de horario con "Servicio con Profesional · duración · precio"', async () => {
    renderModal({ servicioInicialId: 'srv-1' });

    expect(await screen.findByText('Fecha y hora')).toBeTruthy();
    expect(screen.getByText('Corte con Dani')).toBeTruthy();
    expect(screen.getByText('30 min · $10000')).toBeTruthy();

    // "Anterior" vuelve al paso de servicios y no salta de nuevo
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.getByText('Corte')).toBeTruthy();
  });

  it.each([[null], [undefined], ['srv-que-no-existe']])('con servicioInicialId = %s queda en el paso 1 normal', async (servicioInicialId) => {
    renderModal({ servicioInicialId });

    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.getByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.queryByText('Fecha y hora')).toBeNull();
  });

  it('si la lista de servicios no carga, no se queda esperando: paso 1 normal', async () => {
    getServiciosProfesional.mockRejectedValue(new Error('Network Error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderModal({ servicioInicialId: 'srv-1' });

    expect(await screen.findByText('Sin servicios configurados por el momento.')).toBeTruthy();
    expect(screen.getByText('Elegí tu servicio')).toBeTruthy();
  });

  it('con campaniaCodigo la reserva lleva campania_codigo; el tilde de novedades sigue viajando', async () => {
    renderModal({ servicioInicialId: 'srv-1', campaniaCodigo: 'Xk92mPq7Lt' });
    await screen.findByText('Fecha y hora');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Resumen del turno');
    completarDatos();
    fireEvent.click(tilde());

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({
      servicio_id: 'srv-1',
      campania_codigo: 'Xk92mPq7Lt',
      marketing_consentimiento: false,
    });
  });

  it.each([[null], [''], [undefined]])('con campaniaCodigo = %s el campo no se manda', async (campaniaCodigo) => {
    renderModal({ campaniaCodigo });
    await irAlPaso3();
    completarDatos();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('campania_codigo');
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
