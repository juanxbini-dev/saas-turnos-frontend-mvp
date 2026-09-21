// QA Tanda 2 (backend/docs/campanias-n8n-casos-qa.md) · lo que DebSalonLandingPage.enlace.test.tsx
// no mira:
//  - LA1: duración y precio de la profesional CORRECTA (en el test vecino las dos profesionales
//    devuelven la misma lista de servicios, así que no distingue de cuál se muestra).
//  - LA6: el resolver no contesta nunca.
//  - LA9: recargar con la URL ya limpia es una visita nueva (no se vuelve a contar ni viaja el código).
//  - PR3: el enlace de privacidad tampoco ENVÍA el formulario.
//  - LA12: el paso de horario arranca en el mes de Argentina a las 22:30 del último día del mes.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure, renderHook, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

configure({ asyncUtilTimeout: 5000 });

const get = vi.fn();
const post = vi.fn();

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

vi.mock('../../services/configuracion.service', () => ({
  configuracionService: { getLandingPublica: vi.fn().mockRejectedValue(new Error('sin config')) },
}));

// El hook real se usa en LA12; en la landing va con fecha y horario ya elegidos
const disponibilidadFalsa = {
  mes: 9, año: 2026, selectedDate: '2026-09-25', selectedSlot: '15:00', availableDates: [], slots: [],
  loadingDates: false, loadingSlots: false, handleMonthChange: vi.fn(), handleDateSelect: vi.fn(),
  handleSlotSelect: vi.fn(), reset: vi.fn(), forceRefresh: vi.fn(),
};
let usarHookReal = false;
vi.mock('../../hooks/useDisponibilidad', async () => {
  const real = await vi.importActual<typeof import('../../hooks/useDisponibilidad')>('../../hooks/useDisponibilidad');
  return {
    useDisponibilidad: (...args: Parameters<typeof real.useDisponibilidad>) =>
      usarHookReal ? real.useDisponibilidad(...args) : disponibilidadFalsa,
  };
});

import { DebSalonLandingPage } from '../../pages/public/DebSalonLandingPage';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';

const CODIGO = 'Xk92mPq7Lt';

const PROFESIONALES = [
  { id: 'prof-caro', nombre: 'Caro', username: 'caro', email: '', roles: [], activo: true },
  { id: 'prof-sofi', nombre: 'Sofi', username: 'sofi', email: '', roles: [], activo: true },
];

// El MISMO servicio con duración y precio distintos según la profesional
const SERVICIOS: Record<string, Array<Record<string, unknown>>> = {
  'prof-caro': [{ id: 'srv-corte', nombre: 'Corte', descripcion: '', precio: 10000, duracion_minutos: 30 }],
  'prof-sofi': [{ id: 'srv-corte', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 45 }],
};

const ENLACE_A_SOFI = { data: { success: true, data: { valido: true, accion: 'reservar', profesional_id: 'prof-sofi', servicio_id: 'srv-corte' } } };

const llamadasAlResolver = () => post.mock.calls.filter(([url]) => url === '/public/campanias/enlace');
const llamadasAReservar = () => post.mock.calls.filter(([url]) => url === '/public/turnos');

function prepararBackend(respuestaEnlace: unknown) {
  get.mockImplementation((url: string) => {
    if (url.includes('/profesionales') && url.includes('/public/empresas/')) return Promise.resolve({ data: { data: PROFESIONALES } });
    const m = url.match(/^\/public\/profesionales\/([^/]+)\/servicios$/);
    if (m && SERVICIOS[m[1]!]) return Promise.resolve({ data: { data: SERVICIOS[m[1]!] } });
    return Promise.reject(new Error(`GET sin mock: ${url}`));
  });
  post.mockImplementation((url: string) => {
    if (url === '/public/campanias/enlace') return respuestaEnlace as Promise<unknown>;
    if (url === '/public/clientes/validate') return Promise.resolve({ data: { data: { exists: false } } });
    if (url === '/public/turnos') return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`POST sin mock: ${url}`));
  });
}

const renderLanding = () => render(<MemoryRouter><DebSalonLandingPage /></MemoryRouter>);
const landingCargada = () => screen.findByRole('link', { name: 'Política de privacidad' });
const ultimo = (nombre: string) => {
  const botones = screen.getAllByRole('button', { name: nombre });
  return botones[botones.length - 1]!;
};

function completarDatos() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
}

describe('QA Tanda 2 · landing con el botón del mensaje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usarHookReal = false;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    sessionStorage.clear(); // el código se guarda ahí durante la visita: cada test es una visita nueva
    window.history.replaceState({}, '', `/?r=${CODIGO}`);
  });

  afterEach(() => cleanup());

  it('LA1 · muestra la duración y el precio de la profesional DEL MENSAJE, no los de la otra', async () => {
    prepararBackend(Promise.resolve(ENLACE_A_SOFI));
    renderLanding();

    expect(await screen.findByText('Corte con Sofi')).toBeTruthy();
    expect(screen.getByText('45 min · $12000')).toBeTruthy();
    expect(screen.queryByText('30 min · $10000')).toBeNull();
    // Y nunca se pidieron los servicios de la otra
    expect(get.mock.calls.map(([url]) => url)).not.toContain('/public/profesionales/prof-caro/servicios');
  });

  it('LA6 · el resolver no contesta NUNCA: la portada se ve y se puede reservar a mano', async () => {
    prepararBackend(new Promise(() => {})); // queda colgado
    renderLanding();
    await landingCargada();

    expect(screen.queryByText('Fecha y hora')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]!);
    const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
    fireEvent.click(reservar[reservar.length - 1]!);
    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();

    const cortes = await screen.findAllByText('Corte');
    fireEvent.click(cortes[cortes.length - 1]!);
    fireEvent.click(ultimo('Siguiente'));
    fireEvent.click(ultimo('Siguiente'));
    await screen.findByText('Resumen del turno');
    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    // La reserva sale. (Si el código viaja o no cuando el resolver no contestó no está en la spec:
    // el backend lo valida igual al atribuir, así que no se afirma nada sobre eso.)
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0]![1]).toMatchObject({ profesional_id: 'prof-caro', servicio_id: 'srv-corte' });
  }, 20000);

  it('LA9 · recargar con la URL ya limpia es una visita nueva: no vuelve a contar el clic ni reabre el asistente', async () => {
    prepararBackend(Promise.resolve(ENLACE_A_SOFI));
    const primera = renderLanding();
    await screen.findByText('Corte con Sofi');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(llamadasAlResolver()).toHaveLength(1);

    primera.unmount(); // F5
    renderLanding();
    await landingCargada();

    expect(llamadasAlResolver()).toHaveLength(1);
    expect(screen.queryByText('Fecha y hora')).toBeNull();
  });

  it('PR3 · tocar "Ver política de privacidad" no envía la reserva, no cierra el asistente y deja el tilde como estaba', async () => {
    prepararBackend(Promise.resolve(ENLACE_A_SOFI));
    renderLanding();
    await screen.findByText('Corte con Sofi');
    fireEvent.click(ultimo('Siguiente'));
    await screen.findByText('Resumen del turno');
    completarDatos();
    const tilde = screen.getByRole('checkbox', { name: /novedades/i }) as HTMLInputElement;
    expect(tilde.checked).toBe(true);

    fireEvent.click(screen.getByRole('link', { name: 'Ver política de privacidad' }));

    expect(llamadasAReservar()).toHaveLength(0);
    expect(tilde.checked).toBe(true);
    expect(screen.getByText('Resumen del turno')).toBeTruthy();
    expect((screen.getByPlaceholderText('+54 9 11 1234-5678') as HTMLInputElement).value).toBe('11 5555-4444');

    // Y después de mirar la política, la reserva sale completa: con el código y con el tilde
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0]![1]).toMatchObject({ campania_codigo: CODIGO, marketing_consentimiento: true, profesional_id: 'prof-sofi' });
  }, 20000);
});

describe('QA Tanda 2 · LA12 · el paso de horario arranca en el mes de Argentina', () => {
  afterEach(() => {
    vi.useRealTimers();
    usarHookReal = false;
  });

  it('testigo: a las 22:30 del 30/09 en Argentina, en UTC ya es octubre', () => {
    const instante = new Date('2026-10-01T01:30:00.000Z');
    expect(instante.getUTCMonth() + 1).toBe(10);
    expect(instante.getMonth() + 1).toBe(9); // si esto falla, el huso no quedó fijado y el caso de abajo no prueba nada
  });

  it('quien toca el botón a las 22:30 del 30/09 ve el calendario de septiembre, no el de octubre', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T01:30:00.000Z'));
    usarHookReal = true;
    get.mockResolvedValue({ data: { data: [] } }); // la disponibilidad real no hace a este caso

    const { result } = renderHook(() => useDisponibilidad('prof-sofi', 'srv-corte'));

    expect(result.current.mes).toBe(9);
    expect(result.current.año).toBe(2026);
  });
});
