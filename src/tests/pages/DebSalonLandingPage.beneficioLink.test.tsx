import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DebSalonLandingPage } from '../../pages/public/DebSalonLandingPage';
import { EMPRESA_ID } from '../../config/debsalon';

// beneficio-con-turno §3 y §5.1: el botón del mail trae a la landing con
// `?m=<codigo_link>`. Se saca de la barra, se pide el contexto UNA vez (cuenta
// el clic, aun con StrictMode) y queda para toda la visita. El estado decide el
// cartel fijo; con 'disponible' la reserva lleva `beneficio_m`.

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

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

const M = 'Xk92mPq7Lt';
const CLAVE_STORAGE = 'debsalon:beneficio:link';
const BENEFICIO = { nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false, vigencia_dias: 18 };
const PRECARGA = { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: '2915123456' };

const PROFESIONALES = [{ id: 'prof-1', nombre: 'Dani', username: 'dani', email: '', roles: [], activo: true }];
const SERVICIOS = [{ id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 30 }];

const ok = (data: unknown) => ({ data: { success: true, data } });
const contexto = (extra: Record<string, unknown> = {}) => ok({
  valido: true, estado: 'disponible', nombre: 'Ana', beneficio: BENEFICIO, vence_el: '2026-11-12', precarga: PRECARGA, turno: null, ...extra,
});

const llamadasContexto = () => get.mock.calls.filter(([url]) => url === '/public/beneficios/contexto');
const llamadasAReservar = () => post.mock.calls.filter(([url]) => url === '/public/turnos');

function prepararBackend(respuestaContexto: unknown | Error, respuestaReserva: unknown | Error = ok({ id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...BENEFICIO } })) {
  get.mockImplementation((url: string) => {
    if (url === '/public/beneficios/contexto') {
      return respuestaContexto instanceof Error ? Promise.reject(respuestaContexto) : Promise.resolve(respuestaContexto);
    }
    if (url.includes('/profesionales') && url.includes('/public/empresas/')) return Promise.resolve({ data: { data: PROFESIONALES } });
    if (url === '/public/profesionales/prof-1/servicios') return Promise.resolve({ data: { data: SERVICIOS } });
    return Promise.reject(new Error(`GET sin mock: ${url}`));
  });
  post.mockImplementation((url: string) => {
    if (url === '/public/clientes/validate') return Promise.resolve({ data: { data: { exists: false } } });
    if (url === '/public/turnos') {
      return respuestaReserva instanceof Error ? Promise.reject(respuestaReserva) : Promise.resolve(respuestaReserva);
    }
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
// El cartel de la landing es el primero; el del asistente, el último
const carteles = () => screen.queryAllByTestId('cartel-beneficio-link');
const guardado = () => {
  const crudo = window.sessionStorage.getItem(CLAVE_STORAGE);
  return crudo ? JSON.parse(crudo) : null;
};
const botonDelAsistente = (nombre: string) => {
  const botones = screen.getAllByRole('button', { name: nombre });
  return botones[botones.length - 1];
};

async function abrirAsistente() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]);
  const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
  fireEvent.click(reservar[reservar.length - 1]);
  await screen.findByText('Elegí tu servicio');
}

async function llegarAlPaso3YConfirmar({ completar = false } = {}) {
  const cortes = await screen.findAllByText('Corte');
  fireEvent.click(cortes[cortes.length - 1]);
  fireEvent.click(botonDelAsistente('Siguiente'));
  fireEvent.click(botonDelAsistente('Siguiente'));
  await screen.findByText('Resumen del turno');
  if (completar) {
    // Sin precarga: la persona escribe sus datos
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
}

describe('DebSalonLandingPage — ?m= beneficio del mail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.history.replaceState({}, '', `/?m=${M}&utm_source=mail#equipo`);
  });

  it('disponible: limpia ?m=, pide el contexto una vez, guarda la visita y muestra el cartel fijo', async () => {
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();

    await waitFor(() => expect(window.location.search).toBe('?utm_source=mail'));
    expect(window.location.hash).toBe('#equipo');
    await waitFor(() => expect(carteles()).toHaveLength(1));
    expect(carteles()[0]).toHaveTextContent('Tu 20 % ya está aplicado · reservá hasta el 12/11');
    expect(llamadasContexto()).toHaveLength(1);
    expect(llamadasContexto()[0][1]).toMatchObject({ params: { m: M, empresa_id: EMPRESA_ID } });
    expect(guardado()).toMatchObject({ m: M, estado: 'disponible', precarga: PRECARGA });
    // No abre nada solo
    expect(screen.queryByText('Elegí tu servicio')).toBeNull();
  });

  it('disponible: "Servicios" muestra el precio tachado, el asistente lleva el cartel y la reserva manda beneficio_m', async () => {
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));

    fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]);
    expect(await screen.findByTestId('precio-tachado')).toHaveTextContent('$12.000');
    expect(screen.getByTestId('precio-con-descuento')).toHaveTextContent('$9.600');
    const reservar = screen.getAllByRole('button', { name: 'Reservar turno' });
    fireEvent.click(reservar[reservar.length - 1]);
    await screen.findByText('Elegí tu servicio');
    expect(carteles().length).toBe(2);

    await llegarAlPaso3YConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    const body = llamadasAReservar()[0][1];
    expect(body).toMatchObject({ beneficio_m: M, cliente_data: { nombre: 'Ana Pérez', email: 'ana@gmail.com', telefono: '2915123456' } });
    expect(body).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByTestId('confirmacion-beneficio')).toHaveTextContent('Tu turno del 05/11 tiene 20 % de descuento');

    // Ya quedó reservado: el cartel de la landing lo dice y la visita lo recuerda
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(carteles()[0]).toHaveTextContent('Ya hay un turno reservado con este beneficio: 05/11 a las 15:00'));
    expect(guardado()).toMatchObject({ estado: 'reservado', turno: { fecha: '2026-11-05', hora: '15:00' } });
    expect(llamadasContexto()).toHaveLength(1);
  });

  it('al volver a la landing (p. ej. desde /privacidad) levanta el beneficio guardado SIN volver a pedir el contexto', async () => {
    prepararBackend(contexto());
    const primera = renderLanding();
    await landingCargada();
    await waitFor(() => expect(guardado()?.m).toBe(M));

    primera.unmount();
    renderLanding();
    await landingCargada();
    expect(carteles()[0]).toHaveTextContent('Tu 20 % ya está aplicado');
    expect(llamadasContexto()).toHaveLength(1);
  });

  it.each([
    ['reservado', { estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } }, 'Ya hay un turno reservado con este beneficio: 30/10 a las 15:00'],
    ['usado', { estado: 'usado' }, 'Este beneficio ya se usó'],
    ['vencido', { estado: 'vencido' }, 'Esta oferta venció el 12/11'],
  ])('%s: aviso neutro (sin nombres), se puede cerrar y la reserva va sin beneficio', async (_estado, extra, texto) => {
    prepararBackend(contexto(extra));
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));
    expect(carteles()[0]).toHaveTextContent(texto);
    expect(carteles()[0].textContent).not.toMatch(/Ana/);

    await abrirAsistente();
    await llegarAlPaso3YConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).not.toHaveProperty('beneficio_m');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    await waitFor(() => expect(carteles()).toHaveLength(0));
  });

  it.each([
    ['valido:false (baja)', ok({ valido: false, motivo: 'baja' })],
    ['valido:false (anulado, D17)', ok({ valido: false, motivo: 'anulado' })],
    ['valido:false (inexistente)', ok({ valido: false, motivo: 'inexistente' })],
    ['error de red', new Error('Network Error')],
  ])('%s: landing normal, sin cartel ni guardado, y la URL igual queda limpia', async (_caso, respuesta) => {
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(window.location.search).toBe('?utm_source=mail'));
    await waitFor(() => expect(llamadasContexto()).toHaveLength(1));
    expect(carteles()).toHaveLength(0);
    expect(guardado()).toBeNull();

    await abrirAsistente();
    await llegarAlPaso3YConfirmar({ completar: true });
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).not.toHaveProperty('beneficio_m');
  });

  it.each([['abc'], ['Xk92mPq7L'], ['<script>alert(1)</script>']])('?m=%s no tiene forma de link: no consulta y se saca de la barra', async (m) => {
    window.history.replaceState({}, '', `/?m=${encodeURIComponent(m)}`);
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    expect(llamadasContexto()).toHaveLength(0);
    expect(window.location.search).toBe('');
    expect(carteles()).toHaveLength(0);
  });

  it('la reserva rechazada con "usado" (D19: lo usó con otra ficha) cambia el cartel y deja reservar sin beneficio', async () => {
    prepararBackend(
      contexto(),
      Object.assign(new Error('400'), { response: { status: 400, data: { success: false, code: 'BENEFICIO_INVALIDO', motivo: 'usado', message: 'x' } } })
    );
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));

    await abrirAsistente();
    await llegarAlPaso3YConfirmar();
    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Este beneficio ya se usó.')).toBeTruthy();
    await waitFor(() => expect(guardado()?.estado).toBe('usado'));
    expect(carteles()[0]).toHaveTextContent('Este beneficio ya se usó');

    post.mockImplementation((url: string) => {
      if (url === '/public/clientes/validate') return Promise.resolve({ data: { data: { exists: false } } });
      if (url === '/public/turnos') return Promise.resolve(ok({ id: 'tur-2', beneficio: null }));
      return Promise.reject(new Error(`POST sin mock: ${url}`));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar sin beneficio' }));
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(llamadasAReservar()[1][1]).not.toHaveProperty('beneficio_m');
  });
});

describe('DebSalonLandingPage — guard de StrictMode del ?m=', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.history.replaceState({}, '', `/?m=${M}`);
  });

  it('aunque el ?m= siga en la barra, el doble montaje de StrictMode consulta UNA sola vez (lo frena el ref)', async () => {
    // Sin replaceState el ?m= no sale de la barra: el segundo efecto de
    // StrictMode lo volvería a leer si no fuera por el ref
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));
    expect(new URLSearchParams(window.location.search).get('m')).toBe(M);
    expect(llamadasContexto()).toHaveLength(1);
    replace.mockRestore();
  });
});

describe('DebSalonLandingPage — link recordado en el navegador (D25)', () => {
  const CLAVE_RECORDADO = 'debsalon:beneficio:link-recordado';
  const recordado = () => {
    const crudo = window.localStorage.getItem(CLAVE_RECORDADO);
    return crudo ? JSON.parse(crudo) : null;
  };
  const recordar = (vence_el = '2099-12-31') =>
    window.localStorage.setItem(CLAVE_RECORDADO, JSON.stringify({ m: M, vence_el }));

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['disponible', {}],
    ['reservado', { estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } }],
  ])('con ?m= y estado %s, el navegador recuerda solo el m y vence_el', async (_estado, extra) => {
    window.history.replaceState({}, '', `/?m=${M}`);
    prepararBackend(contexto(extra));
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(recordado()).toEqual({ m: M, vence_el: '2026-11-12' }));
  });

  it.each([
    ['usado', contexto({ estado: 'usado' })],
    ['vencido', contexto({ estado: 'vencido' })],
    ['baja', ok({ valido: false, motivo: 'baja' })],
  ])('con ?m= y %s no se recuerda (y se borra uno anterior)', async (_caso, respuesta) => {
    recordar();
    window.history.replaceState({}, '', `/?m=${M}`);
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(llamadasContexto()).toHaveLength(1));
    await waitFor(() => expect(recordado()).toBeNull());
  });

  it('vuelve sin ?m= y sin beneficio en la pestaña: consulta con vuelta=1 y muestra el cartel (disponible)', async () => {
    recordar();
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));
    expect(carteles()[0]).toHaveTextContent('Tu 20 % ya está aplicado');
    expect(llamadasContexto()).toHaveLength(1);
    expect(llamadasContexto()[0][1]).toMatchObject({ params: { m: M, empresa_id: EMPRESA_ID, vuelta: 1 } });
    expect(guardado()).toMatchObject({ m: M, estado: 'disponible' });

    // Y la reserva lleva el beneficio
    await abrirAsistente();
    await llegarAlPaso3YConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({ beneficio_m: M });
  });

  it('vuelve y el turno ya está reservado: muestra el aviso', async () => {
    recordar();
    prepararBackend(contexto({ estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } }));
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(carteles()).toHaveLength(1));
    expect(carteles()[0]).toHaveTextContent('Ya hay un turno reservado con este beneficio: 30/10 a las 15:00');
    expect(recordado()).not.toBeNull();
  });

  it.each([
    ['usado', contexto({ estado: 'usado' })],
    ['vencido', contexto({ estado: 'vencido' })],
    ['anulado', ok({ valido: false, motivo: 'anulado' })],
    ['error de red', new Error('Network Error')],
  ])('vuelve y da %s: sin cartel y el link se olvida', async (_caso, respuesta) => {
    recordar();
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(llamadasContexto()).toHaveLength(1));
    await waitFor(() => expect(recordado()).toBeNull());
    expect(carteles()).toHaveLength(0);
    expect(guardado()).toBeNull();
  });

  it('con el link recordado ya vencido (día AR pasado) ni consulta y lo borra', async () => {
    recordar('2020-01-01');
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    expect(llamadasContexto()).toHaveLength(0);
    expect(recordado()).toBeNull();
  });

  it('si la pestaña ya tiene el beneficio, no vuelve a consultar', async () => {
    recordar();
    window.sessionStorage.setItem('debsalon:beneficio:link', JSON.stringify({
      m: M, estado: 'disponible', nombre: null, beneficio: BENEFICIO, vence_el: '2026-11-12', precarga: null, turno: null,
      guardado_at: Date.now(),
    }));
    prepararBackend(contexto());
    renderLanding();
    await landingCargada();
    expect(carteles()).toHaveLength(1);
    expect(llamadasContexto()).toHaveLength(0);
  });

  it.each([['usado'], ['anulado'], ['baja'], ['vencido']])('la reserva rechazada por %s olvida el link recordado', async (motivo) => {
    window.history.replaceState({}, '', `/?m=${M}`);
    prepararBackend(
      contexto(),
      Object.assign(new Error('400'), { response: { status: 400, data: { success: false, code: 'BENEFICIO_INVALIDO', motivo, message: 'x' } } })
    );
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(recordado()).not.toBeNull());

    await abrirAsistente();
    await llegarAlPaso3YConfirmar();
    await screen.findByRole('alert');
    await waitFor(() => expect(recordado()).toBeNull());
  });

  it('la reserva rechazada por reservado conserva el link recordado', async () => {
    window.history.replaceState({}, '', `/?m=${M}`);
    prepararBackend(
      contexto(),
      Object.assign(new Error('400'), { response: { status: 400, data: { success: false, code: 'BENEFICIO_INVALIDO', motivo: 'reservado', message: 'x' } } })
    );
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(recordado()).not.toBeNull());
    await abrirAsistente();
    await llegarAlPaso3YConfirmar();
    await screen.findByRole('alert');
    expect(recordado()).not.toBeNull();
  });
});
