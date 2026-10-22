import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DebSalonLandingPage } from '../../pages/public/DebSalonLandingPage';

// Plan mails-beneficios §4.1 / fase 4a: el botón del mail trae a la landing con
// `?b=DEB-7K3P9`. Se saca de la barra, se valida UNA vez, y si sirve queda para
// toda la visita: el asistente muestra el chip 🎟 y prellena el código en el
// paso 3. Si no sirve, landing normal sin mensaje.

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

vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 11,
    año: 2026,
    selectedDate: '2026-11-05',
    selectedSlot: '15:00',
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

const CODIGO = 'DEB-7K3P9';
const BENEFICIO = { nombre: 'Bienvenida', porcentaje: 15, aplica_servicio: true, aplica_productos: false };
const CLAVE_STORAGE = 'debsalon:beneficio:codigo';

const PROFESIONALES = [
  { id: 'prof-1', nombre: 'Dani', username: 'dani', email: '', roles: [], activo: true },
];
const SERVICIOS = [
  { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 30 },
];

const ok = (data: unknown) => ({ data: { success: true, data } });
const VALIDACION_OK = ok({ valido: true, beneficio: BENEFICIO, vence_el: '2026-11-12' });

const llamadasAValidar = () => post.mock.calls.filter(([url]) => url === '/public/beneficios/validar');
const llamadasAReservar = () => post.mock.calls.filter(([url]) => url === '/public/turnos');

function prepararBackend(respuestaValidar: unknown | Error) {
  get.mockImplementation((url: string) => {
    if (url.includes('/profesionales') && url.includes('/public/empresas/')) {
      return Promise.resolve({ data: { data: PROFESIONALES } });
    }
    if (url === '/public/profesionales/prof-1/servicios') {
      return Promise.resolve({ data: { data: SERVICIOS } });
    }
    return Promise.reject(new Error(`GET sin mock: ${url}`));
  });
  post.mockImplementation((url: string) => {
    if (url === '/public/beneficios/validar') {
      return respuestaValidar instanceof Error ? Promise.reject(respuestaValidar) : Promise.resolve(respuestaValidar);
    }
    if (url === '/public/clientes/validate') return Promise.resolve({ data: { data: { exists: false } } });
    if (url === '/public/turnos') return Promise.resolve(ok({ id: 'tur-1', beneficio: { codigo: CODIGO, ...BENEFICIO } }));
    return Promise.reject(new Error(`POST sin mock: ${url}`));
  });
}

const renderLanding = () => render(
  <React.StrictMode>
    <MemoryRouter>
      <DebSalonLandingPage />
    </MemoryRouter>
  </React.StrictMode>
);

const landingCargada = () => screen.findByRole('link', { name: 'Política de privacidad' });
const botonDelAsistente = (nombre: string) => {
  const botones = screen.getAllByRole('button', { name: nombre });
  return botones[botones.length - 1];
};

async function abrirAsistenteAMano() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]);
  const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
  fireEvent.click(reservar[reservar.length - 1]);
  await screen.findByText('Elegí tu servicio');
}

async function elegirCorteYLlegarAlPaso3() {
  const cortes = await screen.findAllByText('Corte');
  fireEvent.click(cortes[cortes.length - 1]);
  fireEvent.click(botonDelAsistente('Siguiente'));
  fireEvent.click(botonDelAsistente('Siguiente'));
  await screen.findByText('Resumen del turno');
}

function completarDatosYConfirmar() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
}

const guardado = () => {
  const crudo = window.sessionStorage.getItem(CLAVE_STORAGE);
  return crudo ? JSON.parse(crudo) : null;
};

describe('DebSalonLandingPage — ?b= código de beneficio del mail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.history.replaceState({}, '', `/?b=deb-7k3p9&utm_source=mail#equipo`);
  });

  it('válido: limpia ?b= de la barra, valida UNA vez (aun con StrictMode) con el código normalizado y lo guarda para la visita', async () => {
    prepararBackend(VALIDACION_OK);
    renderLanding();
    await landingCargada();

    await waitFor(() => expect(window.location.search).toBe('?utm_source=mail'));
    expect(window.location.hash).toBe('#equipo');
    expect(llamadasAValidar()).toHaveLength(1);
    expect(llamadasAValidar()[0][1]).toEqual({ codigo: CODIGO });
    await waitFor(() => expect(guardado()?.codigo).toBe(CODIGO));
    expect(Object.keys(guardado()).sort()).toEqual(['beneficio', 'codigo', 'guardado_at', 'vence_el']);
    // No abre nada solo: la persona elige con quién reservar
    expect(screen.queryByText('Elegí tu servicio')).toBeNull();
  });

  it('válido: el asistente muestra el chip en los tres pasos, prellena el código y la reserva lo lleva', async () => {
    prepararBackend(VALIDACION_OK);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(guardado()?.codigo).toBe(CODIGO));

    await abrirAsistenteAMano();
    expect(screen.getByTestId('chip-beneficio')).toHaveTextContent('15 % en servicios aplicado · vence el 12/11');

    await elegirCorteYLlegarAlPaso3();
    expect(screen.getByTestId('chip-beneficio')).toBeTruthy();
    expect((screen.getByLabelText('¿Tenés un código de descuento?') as HTMLInputElement).value).toBe(CODIGO);

    completarDatosYConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({ profesional_id: 'prof-1', servicio_id: 'srv-1', beneficio_codigo: CODIGO });
    expect(llamadasAReservar()[0][1]).not.toHaveProperty('campania_codigo');

    expect(await screen.findByText(/Tu descuento del 15 % queda aplicado al pagar/)).toBeTruthy();
    // Un código, una reserva: se olvida
    await waitFor(() => expect(guardado()).toBeNull());
    expect(llamadasAValidar()).toHaveLength(1);
  }, 20000);

  it('al volver a la landing (p. ej. desde /privacidad) levanta el código guardado SIN volver a validar', async () => {
    prepararBackend(VALIDACION_OK);
    const primera = renderLanding();
    await landingCargada();
    await waitFor(() => expect(guardado()?.codigo).toBe(CODIGO));

    primera.unmount();
    renderLanding();
    await landingCargada();
    expect(llamadasAValidar()).toHaveLength(1);

    await abrirAsistenteAMano();
    expect(screen.getByTestId('chip-beneficio')).toBeTruthy();
  });

  it.each([
    ['valido:false (vencido)', ok({ valido: false, motivo: 'vencido' })],
    ['valido:false (usado)', ok({ valido: false, motivo: 'usado' })],
    ['error de red', new Error('Network Error')],
    ['backend caído (500)', Object.assign(new Error('500'), { response: { status: 500, data: {} } })],
  ])('inválido (%s): landing normal, sin chip, sin mensaje, sin guardar, y la URL igual queda limpia', async (_caso, respuesta) => {
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();

    await waitFor(() => expect(window.location.search).toBe('?utm_source=mail'));
    expect(llamadasAValidar()).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/vencid|inválido|no existe/i);

    await abrirAsistenteAMano();
    expect(screen.queryByTestId('chip-beneficio')).toBeNull();
    expect(guardado()).toBeNull();

    await elegirCorteYLlegarAlPaso3();
    expect((screen.getByLabelText('¿Tenés un código de descuento?') as HTMLInputElement).value).toBe('');
  });

  it.each([['abc'], ['DEB-7K3P'], ['<script>alert(1)</script>']])('?b=%s no tiene forma de código: no consulta y se saca de la barra', async (b) => {
    window.history.replaceState({}, '', `/?b=${encodeURIComponent(b)}`);
    prepararBackend(VALIDACION_OK);
    renderLanding();
    await landingCargada();

    expect(llamadasAValidar()).toHaveLength(0);
    expect(window.location.search).toBe('');
    expect(guardado()).toBeNull();
  });

  it('sin ?b= no consulta nada', async () => {
    window.history.replaceState({}, '', '/');
    prepararBackend(VALIDACION_OK);
    renderLanding();
    await landingCargada();
    expect(llamadasAValidar()).toHaveLength(0);
  });

  it('un ?b= nuevo reemplaza al código que había quedado guardado', async () => {
    window.sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify({ codigo: 'DEB-AAAAA', beneficio: BENEFICIO, vence_el: null, guardado_at: Date.now() }));
    prepararBackend(VALIDACION_OK);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(guardado()?.codigo).toBe(CODIGO));
  });
});
