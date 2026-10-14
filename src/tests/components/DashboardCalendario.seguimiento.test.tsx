import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { turnoWeb } from '../fixtures/seguimiento.fixtures';

// Spec seguimiento-reservas §8 caso 23: el ícono está en el menú del turno del
// Dashboard (celular y escritorio); al tocarlo cierra el menú y abre el modal.
// NO está dentro del bloque del evento del calendario.

// El calendario real no hace a esta prueba: cada evento es un botón que llama a
// onSelectEvent como lo haría react-big-calendar.
vi.mock('react-big-calendar', () => ({
  Calendar: ({ events, onSelectEvent }: { events: Array<{ id: string; title: string }>; onSelectEvent: (e: unknown, ev: unknown) => void }) => (
    <div data-testid="calendario">
      {events.map((ev) => (
        <button key={ev.id} data-testid={`evento-${ev.id}`} onClick={(e) => onSelectEvent(ev, e)}>{ev.title}</button>
      ))}
    </div>
  ),
  dateFnsLocalizer: () => ({}),
  Navigate: { PREVIOUS: 'PREV', NEXT: 'NEXT', TODAY: 'TODAY', DATE: 'DATE' },
}));
vi.mock('react-big-calendar/lib/Week', () => ({ default: { range: () => [], navigate: () => new Date() } }));
vi.mock('react-big-calendar/lib/TimeGrid', () => ({ default: Object.assign(() => null, { defaultProps: {} }) }));
vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));

const getCalendario = vi.fn();
const getSeguimiento = vi.fn();
vi.mock('../../services/turno.service', () => ({
  turnoService: {
    getCalendario: (...a: unknown[]) => getCalendario(...a),
    getSeguimiento: (...a: unknown[]) => getSeguimiento(...a),
    cancelarTurno: vi.fn(),
  },
}));
vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    getConfiguracion: vi.fn().mockResolvedValue(null),
    getSlotsRango: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/bloqueoSlot.service', () => ({
  bloqueoSlotService: { getByRango: vi.fn().mockResolvedValue([]) },
}));

import { DashboardCalendario } from '../../components/dashboard/DashboardCalendario';

const TURNO = {
  id: 'tur-1',
  cliente_id: 'cli-1',
  usuario_id: 'prof-1',
  servicio_id: 'srv-1',
  fecha: '2026-10-20',
  hora: '10:00',
  estado: 'confirmado',
  origen: 'web',
  servicio: 'Corte',
  duracion_minutos: 30,
  cliente_nombre: 'Ana Pérez',
  cliente_email: 'ana@x.com',
  cliente_telefono: '2915134540',
  usuario_nombre: 'Dani',
  usuario_username: 'dani',
  confirmacion_whatsapp_enviada: true,
  recordatorio_enviado: false,
};

const anchoOriginal = window.innerWidth;
function setAncho(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
}

function renderDashboard() {
  return render(
    <DashboardCalendario
      profesionalId="prof-1"
      color="#3B82F6"
      profesionalNombre="Dani"
      onSlotSelect={vi.fn()}
      onTurnoAction={vi.fn()}
    />
  );
}

describe('DashboardCalendario — ícono de seguimiento en el menú del turno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CALENDARIO));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SEGUIMIENTO));
    getCalendario.mockResolvedValue([TURNO]);
    getSeguimiento.mockResolvedValue(turnoWeb());
  });

  afterEach(() => setAncho(anchoOriginal));

  it.each([
    ['escritorio', 1280],
    ['celular', 375],
  ])('en %s: el ícono está en el menú, no en el evento; al tocarlo cierra el menú y abre el modal', async (_modo, ancho) => {
    setAncho(ancho);
    renderDashboard();

    const evento = await screen.findByTestId('evento-tur-1');
    // Nada de íconos dentro del bloque del evento del calendario
    expect(screen.queryByRole('button', { name: 'Cómo se sacó el turno' })).toBeNull();

    fireEvent.click(evento);

    const boton = await screen.findByRole('button', { name: 'Cómo se sacó el turno' });
    // Está en la cabecera del menú, al lado del estado del turno
    expect(boton.parentElement?.textContent).toContain('Confirmado');
    expect(screen.getByText('Finalizar turno')).toBeTruthy();

    fireEvent.click(boton);

    // Se cerró el menú…
    await waitFor(() => expect(screen.queryByText('Finalizar turno')).toBeNull());
    // …y se abrió el modal con el seguimiento de ese turno
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Cómo se sacó el turno')).toBeTruthy();
    expect(getSeguimiento).toHaveBeenCalledWith('tur-1');
    expect(await screen.findByText('Por la web')).toBeTruthy();
  });
});
