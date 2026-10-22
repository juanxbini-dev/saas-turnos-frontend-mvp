import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TurnoPopover } from '../../components/dashboard/TurnoPopover';
import { BeneficioTurnoBadge, textoBeneficioTurno } from '../../components/turnos/BeneficioTurnoBadge';
import type { TurnoConDetalle } from '../../types/turno.types';

// Plan mails-beneficios §4.5 / fase 4a: el turno con código muestra 🎟 con el
// tooltip "Código DEB-7K3P9 · 15 % en servicios" en el evento del calendario
// (al lado de 🌐 Web) y en el popover del turno.

// El calendario real no hace a esta prueba: cada evento se pinta con el
// componente de evento del Dashboard, como lo haría react-big-calendar.
vi.mock('react-big-calendar', () => ({
  Calendar: ({ events, onSelectEvent, components }: {
    events: Array<{ id: string; title: string }>;
    onSelectEvent: (e: unknown, ev: unknown) => void;
    components?: { event?: React.FC<{ event: unknown }> };
  }) => (
    <div data-testid="calendario">
      {events.map((ev) => (
        <div key={ev.id} data-testid={`evento-${ev.id}`} onClick={(e) => onSelectEvent(ev, e)}>
          {components?.event ? <components.event event={ev} /> : ev.title}
        </div>
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
vi.mock('../../services/turno.service', () => ({
  turnoService: {
    getCalendario: (...a: unknown[]) => getCalendario(...a),
    getSeguimiento: vi.fn(),
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

const BENEFICIO = {
  codigo_id: 'bc-1', codigo: 'DEB-7K3P9', nombre: 'Bienvenida', porcentaje: 15,
  aplica_servicio: true, aplica_productos: false, estado: 'reservado' as const,
};
const TOOLTIP = 'Código DEB-7K3P9 · 15 % en servicios';

const TURNO: TurnoConDetalle = {
  id: 'tur-1',
  cliente_id: 'cli-1',
  usuario_id: 'prof-1',
  servicio_id: 'srv-1',
  fecha: '2026-11-05',
  hora: '10:00',
  estado: 'confirmado',
  origen: 'web',
  servicio: 'Corte',
  precio: 12000,
  notas: null,
  duracion_minutos: 30,
  empresa_id: 'emp-1',
  created_at: '',
  updated_at: '',
  cliente_nombre: 'Ana Pérez',
  cliente_email: 'ana@x.com',
  cliente_telefono: '2915134540',
  usuario_nombre: 'Dani',
  usuario_username: 'dani',
  beneficio: BENEFICIO,
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

describe('BeneficioTurnoBadge', () => {
  it('arma el tooltip con el código y el beneficio', () => {
    expect(textoBeneficioTurno(BENEFICIO)).toBe(TOOLTIP);
    expect(textoBeneficioTurno({ ...BENEFICIO, aplica_productos: true })).toBe('Código DEB-7K3P9 · 15 % en servicios y productos');
  });

  it('sin beneficio no pinta nada', () => {
    const { container } = render(<BeneficioTurnoBadge beneficio={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('el ícono lleva el tooltip como title y como nombre accesible', () => {
    render(<BeneficioTurnoBadge beneficio={BENEFICIO} />);
    const icono = screen.getByRole('img', { name: TOOLTIP });
    expect(icono.getAttribute('title')).toBe(TOOLTIP);
    expect(icono.textContent).toBe('🎟');
  });
});

describe('🎟 en el popover del turno', () => {
  it('con beneficio: el ícono está al lado del estado, con el tooltip', () => {
    render(<TurnoPopover turno={TURNO} isOpen onClose={vi.fn()} onCancelar={vi.fn()} position={{ x: 100, y: 100 }} />);
    const icono = screen.getByRole('img', { name: TOOLTIP });
    expect(icono.parentElement?.textContent).toContain('Web');
    expect(icono.parentElement?.textContent).toContain('Confirmado');
  });

  it('sin beneficio: no hay ícono', () => {
    render(<TurnoPopover turno={{ ...TURNO, beneficio: null }} isOpen onClose={vi.fn()} onCancelar={vi.fn()} position={{ x: 100, y: 100 }} />);
    expect(screen.queryByRole('img', { name: TOOLTIP })).toBeNull();
  });
});

describe('🎟 en el calendario del Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CALENDARIO));
    getCalendario.mockResolvedValue([TURNO]);
  });

  afterEach(() => setAncho(anchoOriginal));

  it.each([
    ['escritorio', 1280],
    ['celular', 375],
  ])('en %s: el evento muestra 🎟 al lado de 🌐 Web y el menú del turno muestra el chip', async (_modo, ancho) => {
    setAncho(ancho);
    renderDashboard();

    const evento = await screen.findByTestId('evento-tur-1');
    const icono = within(evento).getByRole('img', { name: TOOLTIP });
    expect(icono.parentElement?.textContent).toContain('🌐 Web');

    fireEvent.click(evento);
    const chips = await screen.findAllByText(TOOLTIP);
    expect(chips.length).toBeGreaterThan(0);
  });

  it('un turno sin beneficio no muestra el ícono', async () => {
    getCalendario.mockResolvedValue([{ ...TURNO, beneficio: null }]);
    renderDashboard();
    const evento = await screen.findByTestId('evento-tur-1');
    expect(within(evento).queryByRole('img', { name: TOOLTIP })).toBeNull();
    expect(within(evento).getByText('🌐 Web')).toBeTruthy();
  });
});
