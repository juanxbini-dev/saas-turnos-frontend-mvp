import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DebSalonLandingPage } from '../../pages/public/DebSalonLandingPage';

// Spec campanias-n8n §15.5 / §15.7: la landing entiende el botón "Reservar turno"
// del mensaje de WhatsApp (`?r=<codigo>`). Con enlace válido abre el asistente en
// el paso de horario con profesional y servicio correctos y limpia la URL; con
// cualquier falla, landing normal sin mensaje de error.

configure({ asyncUtilTimeout: 5000 });

const get = vi.fn();
const post = vi.fn();

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

// La config visual de la landing no hace a esta prueba: que falle y la lista de
// profesionales salga del endpoint público
vi.mock('../../services/configuracion.service', () => ({
  configuracionService: { getLandingPublica: vi.fn().mockRejectedValue(new Error('sin config')) },
}));

// Fecha y horario ya elegidos, para poder llegar hasta la confirmación
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
    reset: vi.fn(),
    forceRefresh: vi.fn(),
  }),
}));

const CODIGO = 'Xk92mPq7Lt';

const PROFESIONALES = [
  { id: 'prof-1', nombre: 'Dani', username: 'dani', email: '', roles: [], activo: true },
  { id: 'prof-2', nombre: 'Bruno', username: 'bruno', email: '', roles: [], activo: true },
];

const SERVICIOS_BRUNO = [
  { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 30 },
  { id: 'srv-2', nombre: 'Color', descripcion: '', precio: 20000, duracion_minutos: 45 },
];

const enlace = (data: Record<string, unknown>) => ({ data: { success: true, data } });
const ENLACE_VALIDO = enlace({ valido: true, accion: 'reservar', profesional_id: 'prof-2', servicio_id: 'srv-2' });

const llamadasAlResolver = () => post.mock.calls.filter(([url]) => url === '/public/campanias/enlace');
const llamadasAReservar = () => post.mock.calls.filter(([url]) => url === '/public/turnos');

function prepararBackend(respuestaEnlace: unknown | Error) {
  get.mockImplementation((url: string) => {
    if (url.includes('/profesionales') && url.includes('/public/empresas/')) {
      return Promise.resolve({ data: { data: PROFESIONALES } });
    }
    if (url === '/public/profesionales/prof-2/servicios' || url === '/public/profesionales/prof-1/servicios') {
      return Promise.resolve({ data: { data: SERVICIOS_BRUNO } });
    }
    return Promise.reject(new Error(`GET sin mock: ${url}`));
  });

  post.mockImplementation((url: string) => {
    if (url === '/public/campanias/enlace') {
      return respuestaEnlace instanceof Error ? Promise.reject(respuestaEnlace) : Promise.resolve(respuestaEnlace);
    }
    if (url === '/public/clientes/validate') return Promise.resolve({ data: { data: { exists: false } } });
    if (url === '/public/turnos') return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`POST sin mock: ${url}`));
  });
}

// StrictMode a propósito: en desarrollo monta los efectos dos veces, y cada
// llamada al resolver cuenta un clic
const renderLanding = () => render(
  <React.StrictMode>
    <MemoryRouter>
      <DebSalonLandingPage />
    </MemoryRouter>
  </React.StrictMode>
);

// El carrusel de reseñas también tiene "Anterior" y "Siguiente": los del asistente
// son los últimos del DOM (el modal se pinta al final de la página)
const botonDelAsistente = (nombre: string) => {
  const botones = screen.getAllByRole('button', { name: nombre });
  return botones[botones.length - 1];
};

// Reserva iniciada a mano desde la tarjeta de un profesional: Servicios → Reservar turno
async function abrirAsistenteAMano(indiceProfesional: number) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[indiceProfesional]);
  // (la portada tiene su propio "Reservar turno": el del modal de servicios es el último)
  const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
  fireEvent.click(reservar[reservar.length - 1]);
  await screen.findByText('Elegí tu servicio');
}

// Desde el paso de servicios hasta confirmar, eligiendo "Corte"
async function elegirCorteYConfirmar() {
  const cortes = await screen.findAllByText('Corte');
  fireEvent.click(cortes[cortes.length - 1]);
  fireEvent.click(botonDelAsistente('Siguiente'));
  fireEvent.click(botonDelAsistente('Siguiente'));
  await screen.findByText('Resumen del turno');
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
}

const CLAVE_STORAGE = 'debsalon:campania:codigo';
const codigoGuardado = () => {
  const crudo = window.sessionStorage.getItem(CLAVE_STORAGE);
  return crudo ? (JSON.parse(crudo) as { codigo: string; guardado_at: number }) : null;
};

const landingCargada = () => screen.findByRole('link', { name: 'Política de privacidad' });
const asistenteAbierto = () => screen.queryByText('Fecha y hora') !== null || screen.queryByText('Elegí tu servicio') !== null;

describe('DebSalonLandingPage — enlace ?r= del mensaje de WhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom no trae IntersectionObserver y la landing lo usa para las animaciones
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.history.replaceState({}, '', `/?r=${CODIGO}&utm_source=whatsapp#equipo`);
  });

  it('enlace válido: abre el asistente en el paso de horario con el profesional y el servicio del mensaje', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();

    expect(await screen.findByText('Fecha y hora')).toBeTruthy();
    expect(screen.getByText('Color con Bruno')).toBeTruthy();
    expect(screen.getByText('45 min · $20000')).toBeTruthy();
    expect(screen.queryByText('Elegí tu servicio')).toBeNull();
  });

  it('llama al resolver UNA sola vez (aun con StrictMode) y con el código de la URL', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Fecha y hora');

    expect(llamadasAlResolver()).toHaveLength(1);
    expect(llamadasAlResolver()[0][1]).toEqual({ codigo: CODIGO });
  });

  it('limpia ?r= de la barra y conserva el resto de la URL', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Fecha y hora');

    await waitFor(() => expect(window.location.search).toBe('?utm_source=whatsapp'));
    expect(window.location.hash).toBe('#equipo');
    expect(window.location.pathname).toBe('/');
  });

  it('"Anterior" vuelve al paso de servicios de ese profesional, como siempre', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Fecha y hora');

    fireEvent.click(botonDelAsistente('Anterior'));

    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.getByText('Corte')).toBeTruthy();
    expect(screen.getByText('Color')).toBeTruthy();
  });

  it('la reserva hecha desde el enlace lleva campania_codigo (y el tilde de novedades sigue viajando)', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Fecha y hora');

    fireEvent.click(botonDelAsistente('Siguiente'));
    await screen.findByText('Resumen del turno');
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({
      profesional_id: 'prof-2',
      servicio_id: 'srv-2',
      campania_codigo: CODIGO,
      marketing_consentimiento: true,
    });
  });

  it('servicio_id null (el profesional ya no da ese servicio): abre el asistente en el paso de servicios', async () => {
    prepararBackend(enlace({ valido: true, accion: 'reservar', profesional_id: 'prof-2', servicio_id: null }));
    renderLanding();

    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.queryByText('Fecha y hora')).toBeNull();
  });

  it('servicio que no está entre los del profesional: paso de servicios normal', async () => {
    prepararBackend(enlace({ valido: true, accion: 'reservar', profesional_id: 'prof-2', servicio_id: 'srv-borrado' }));
    renderLanding();

    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.getByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.queryByText('Fecha y hora')).toBeNull();
  });

  it.each([
    ['valido:false (vencido o inexistente)', enlace({ valido: false })],
    ['error de red', new Error('Network Error')],
    ['backend caído (500)', Object.assign(new Error('500'), { response: { status: 500, data: {} } })],
    ['profesional que no está en la lista', enlace({ valido: true, accion: 'reservar', profesional_id: 'prof-fantasma', servicio_id: 'srv-2' })],
    ['respuesta sin profesional', enlace({ valido: true, accion: 'reservar' })],
  ])('%s → landing normal: sin asistente, sin mensaje de error, y la URL igual queda limpia', async (_caso, respuesta) => {
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();

    await waitFor(() => expect(window.location.search).toBe('?utm_source=whatsapp'));
    expect(llamadasAlResolver()).toHaveLength(1);
    expect(asistenteAbierto()).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/error|no se pudo|inválido|vencid/i);
  });

  it('sin ?r= no llama al resolver ni abre nada', async () => {
    window.history.replaceState({}, '', '/');
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await landingCargada();

    expect(llamadasAlResolver()).toHaveLength(0);
    expect(asistenteAbierto()).toBe(false);
  });

  it('un ?r= que no tiene forma de código ni se consulta, pero igual se saca de la barra', async () => {
    window.history.replaceState({}, '', '/?r=<script>alert(1)</script>');
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await landingCargada();

    expect(llamadasAlResolver()).toHaveLength(0);
    expect(window.location.search).toBe('');
    expect(asistenteAbierto()).toBe(false);
  });

  // ---- §17: carrera entre el resolver y la carga de profesionales ----

  function diferido<T>() {
    let resolver!: (valor: T) => void;
    const promesa = new Promise<T>((res) => { resolver = res; });
    return { promesa, resolver };
  }

  function prepararCarrera() {
    const profesionales = diferido<unknown>();
    const resolverEnlace = diferido<unknown>();
    prepararBackend(ENLACE_VALIDO);
    const getBase = get.getMockImplementation()!;
    const postBase = post.getMockImplementation()!;
    get.mockImplementation((url: string) => (
      url.includes('/public/empresas/') ? profesionales.promesa : getBase(url)
    ));
    post.mockImplementation((url: string) => (
      url === '/public/campanias/enlace' ? resolverEnlace.promesa : postBase(url)
    ));
    return {
      lleganProfesionales: () => profesionales.resolver({ data: { data: PROFESIONALES } }),
      respondeElResolver: () => resolverEnlace.resolver(ENLACE_VALIDO),
    };
  }

  it('carrera: el resolver responde ANTES de que cargue la lista de profesionales', async () => {
    const carrera = prepararCarrera();
    renderLanding();

    carrera.respondeElResolver();
    await waitFor(() => expect(window.location.search).toBe('?utm_source=whatsapp'));
    expect(asistenteAbierto()).toBe(false);   // todavía no hay a quién abrirle

    carrera.lleganProfesionales();
    expect(await screen.findByText('Color con Bruno')).toBeTruthy();
    expect(llamadasAlResolver()).toHaveLength(1);
  });

  it('carrera: el resolver responde DESPUÉS de que cargó la lista de profesionales', async () => {
    const carrera = prepararCarrera();
    renderLanding();

    carrera.lleganProfesionales();
    await landingCargada();
    expect(asistenteAbierto()).toBe(false);

    carrera.respondeElResolver();
    expect(await screen.findByText('Color con Bruno')).toBeTruthy();
    expect(llamadasAlResolver()).toHaveLength(1);
  });

  // ---- §17 T2-Q6: el código dura toda la visita; el servicio inicial, solo la apertura automática ----

  it('si cierra el asistente y reserva a mano con OTRO profesional, el código igual viaja y arranca en el paso de servicios', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Color con Bruno');
    await waitFor(() => expect(window.location.search).toBe('?utm_source=whatsapp'));   // la URL ya está limpia

    // Cierra el asistente que se abrió solo
    const fondos = document.querySelectorAll('.fixed.inset-0.z-50 > .absolute.inset-0');
    fireEvent.click(fondos[fondos.length - 1]);
    await waitFor(() => expect(asistenteAbierto()).toBe(false));

    // Reserva a mano con Dani (el primero de la lista): Servicios → Reservar turno
    fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]);
    // (la portada tiene su propio "Reservar turno": el del modal de servicios es el último)
    const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
    fireEvent.click(reservar[reservar.length - 1]);

    // El servicio del mensaje NO se aplica: arranca eligiendo servicio
    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.queryByText('Fecha y hora')).toBeNull();

    const cortes = await screen.findAllByText('Corte');
    fireEvent.click(cortes[cortes.length - 1]);
    fireEvent.click(botonDelAsistente('Siguiente'));
    fireEvent.click(botonDelAsistente('Siguiente'));
    await screen.findByText('Resumen del turno');
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({
      profesional_id: 'prof-1',
      servicio_id: 'srv-1',
      campania_codigo: CODIGO,
    });
    expect(llamadasAlResolver()).toHaveLength(1);
  }, 20000);   // recorre el asistente entero: con la suite en paralelo los 5 s por defecto quedan justos

  // ---- Code review de la tanda 2 ----

  it('limpia ?r= APENAS lo lee, sin esperar la respuesta del resolver', async () => {
    const carrera = prepararCarrera();
    renderLanding();

    // El resolver todavía no respondió (ni la lista de profesionales)
    await waitFor(() => expect(llamadasAlResolver()).toHaveLength(1));
    expect(window.location.search).toBe('?utm_source=whatsapp');

    carrera.lleganProfesionales();
    carrera.respondeElResolver();
    expect(await screen.findByText('Color con Bruno')).toBeTruthy();
  });

  it.each([['abc'], ['Xk92mPq7L'], ['Xk92mPq7Ltt'], ['Xk92mPq7L-']])(
    '?r=%s no tiene exactamente 10 alfanuméricos: no hace ningún POST, y la barra queda limpia',
    async (codigo) => {
      window.history.replaceState({}, '', `/?r=${codigo}`);
      prepararBackend(ENLACE_VALIDO);
      renderLanding();
      await landingCargada();

      expect(llamadasAlResolver()).toHaveLength(0);
      expect(window.location.search).toBe('');
      expect(asistenteAbierto()).toBe(false);
      expect(codigoGuardado()).toBeNull();
    }
  );

  it('si el resolver tarda y la persona ya abrió "Servicios", la apertura automática NO le pisa lo que abrió', async () => {
    const carrera = prepararCarrera();
    renderLanding();
    carrera.lleganProfesionales();
    await landingCargada();

    // Mientras el resolver sigue sin responder, abre los servicios de Dani
    fireEvent.click(screen.getAllByRole('button', { name: 'Servicios' })[0]);
    const reservar = await screen.findAllByRole('button', { name: 'Reservar turno' });
    const cantidadAntes = reservar.length;

    carrera.respondeElResolver();
    await waitFor(() => expect(codigoGuardado()?.codigo).toBe(CODIGO));

    // El modal de servicios sigue abierto y el asistente de Bruno no apareció
    expect(screen.getAllByRole('button', { name: 'Reservar turno' })).toHaveLength(cantidadAntes);
    expect(asistenteAbierto()).toBe(false);
    expect(screen.queryByText('Color con Bruno')).toBeNull();

    // …y tampoco se abre solo más tarde, cuando cierra lo suyo y sigue por su cuenta
    fireEvent.click(reservar[reservar.length - 1]);
    expect(await screen.findByText('Elegí tu servicio')).toBeTruthy();
    expect(screen.queryByText('Color con Bruno')).toBeNull();

    // El código viaja igual en la reserva que hizo a mano
    await elegirCorteYConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({ profesional_id: 'prof-1', campania_codigo: CODIGO });
  }, 20000);

  it('si el resolver tarda y la persona ya está en el asistente con otro profesional, no se lo desmonta', async () => {
    const carrera = prepararCarrera();
    renderLanding();
    carrera.lleganProfesionales();
    await landingCargada();

    await abrirAsistenteAMano(0);
    const cortes = await screen.findAllByText('Corte');
    fireEvent.click(cortes[cortes.length - 1]);
    fireEvent.click(botonDelAsistente('Siguiente'));
    expect(await screen.findByText('Corte con Dani')).toBeTruthy();

    carrera.respondeElResolver();
    await waitFor(() => expect(codigoGuardado()?.codigo).toBe(CODIGO));

    // Sigue donde estaba: mismo profesional, mismo servicio, mismo paso
    expect(screen.getByText('Corte con Dani')).toBeTruthy();
    expect(screen.queryByText('Color con Bruno')).toBeNull();
  }, 20000);

  // ---- T2-Q6 "toda la visita": el código sobrevive a que la landing se remonte ----

  it('con enlace válido guarda en sessionStorage solo el código y su fecha', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Color con Bruno');

    const guardado = codigoGuardado();
    expect(guardado && Object.keys(guardado).sort()).toEqual(['codigo', 'guardado_at']);
    expect(guardado?.codigo).toBe(CODIGO);
    expect(Math.abs(Date.now() - (guardado?.guardado_at ?? 0))).toBeLessThan(60_000);
    expect(window.sessionStorage.length).toBe(1);
  });

  it.each([
    ['valido:false', enlace({ valido: false })],
    ['error de red', new Error('Network Error')],
  ])('con %s no guarda nada', async (_caso, respuesta) => {
    prepararBackend(respuesta);
    renderLanding();
    await landingCargada();
    await waitFor(() => expect(llamadasAlResolver()).toHaveLength(1));

    expect(codigoGuardado()).toBeNull();
  });

  it('al volver a la landing (p. ej. desde /privacidad) levanta el código SIN llamar al resolver ni reabrir el asistente, y la reserva lo lleva', async () => {
    // Primera pasada: llega desde el mensaje
    prepararBackend(ENLACE_VALIDO);
    const primera = renderLanding();
    await screen.findByText('Color con Bruno');
    expect(llamadasAlResolver()).toHaveLength(1);

    // Se va a /privacidad por el pie y vuelve: la landing se desmonta y se monta de nuevo
    primera.unmount();
    expect(window.location.search).toBe('?utm_source=whatsapp');
    renderLanding();
    await landingCargada();

    expect(llamadasAlResolver()).toHaveLength(1);   // el clic ya se contó: no se vuelve a llamar
    expect(asistenteAbierto()).toBe(false);         // ni se le reabre el asistente

    await abrirAsistenteAMano(0);
    await elegirCorteYConfirmar();

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({ profesional_id: 'prof-1', campania_codigo: CODIGO });
  }, 20000);

  it('un código guardado hace más de 24 h no se usa y se borra', async () => {
    window.history.replaceState({}, '', '/');
    const hace25h = Date.now() - 25 * 60 * 60 * 1000;
    window.sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify({ codigo: CODIGO, guardado_at: hace25h }));
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await landingCargada();

    expect(codigoGuardado()).toBeNull();

    await abrirAsistenteAMano(0);
    await elegirCorteYConfirmar();
    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).not.toHaveProperty('campania_codigo');
  }, 20000);

  it.each([
    ['basura que no es JSON', '{{no-json'],
    ['un código con otra forma', JSON.stringify({ codigo: 'abc', guardado_at: Date.now() })],
    ['sin fecha', JSON.stringify({ codigo: 'Xk92mPq7Lt' })],
    ['con fecha en el futuro', JSON.stringify({ codigo: 'Xk92mPq7Lt', guardado_at: Date.now() + 60 * 60 * 1000 })],
  ])('lo guardado con %s se ignora y se borra, sin romper la landing', async (_caso, crudo) => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.setItem(CLAVE_STORAGE, crudo);
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await landingCargada();

    expect(window.sessionStorage.getItem(CLAVE_STORAGE)).toBeNull();
    expect(asistenteAbierto()).toBe(false);
  });

  it('si sessionStorage no está disponible, la landing funciona igual y el código viaja mientras no se remonte', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });
    try {
      prepararBackend(ENLACE_VALIDO);
      renderLanding();
      expect(await screen.findByText('Color con Bruno')).toBeTruthy();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    }
  });

  it('una reserva exitosa gasta el código: se borra y una segunda reserva de la misma visita ya no lo lleva', async () => {
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Color con Bruno');

    fireEvent.click(botonDelAsistente('Siguiente'));
    await screen.findByText('Resumen del turno');
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    expect(llamadasAReservar()[0][1]).toMatchObject({ campania_codigo: CODIGO });
    await waitFor(() => expect(codigoGuardado()).toBeNull());

    // Cierra el cartel de "Turno confirmado" y saca otro turno a mano
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(asistenteAbierto()).toBe(false));
    await abrirAsistenteAMano(0);
    await elegirCorteYConfirmar();

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(2));
    expect(llamadasAReservar()[1][1]).not.toHaveProperty('campania_codigo');
  }, 30000);

  it('si la reserva FALLA, el código no se gasta', async () => {
    prepararBackend(ENLACE_VALIDO);
    const postBase = post.getMockImplementation()!;
    post.mockImplementation((url: string) => (
      url === '/public/turnos'
        ? Promise.reject(Object.assign(new Error('409'), { response: { status: 409, data: { message: 'Ese horario ya no está disponible' } } }))
        : postBase(url)
    ));
    renderLanding();
    await screen.findByText('Color con Bruno');

    fireEvent.click(botonDelAsistente('Siguiente'));
    await screen.findByText('Resumen del turno');
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '11 5555-4444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(llamadasAReservar()).toHaveLength(1));
    await screen.findByText('Ese horario ya no está disponible');
    expect(codigoGuardado()?.codigo).toBe(CODIGO);
  }, 20000);

  it('un ?r= nuevo y bien formado reemplaza al código que había quedado guardado', async () => {
    window.sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify({ codigo: 'AAAAAAAAAA', guardado_at: Date.now() }));
    prepararBackend(ENLACE_VALIDO);
    renderLanding();
    await screen.findByText('Color con Bruno');

    expect(codigoGuardado()?.codigo).toBe(CODIGO);
  });

  it('el pie enlaza a la política de privacidad', async () => {
    window.history.replaceState({}, '', '/');
    prepararBackend(ENLACE_VALIDO);
    renderLanding();

    expect((await landingCargada()).getAttribute('href')).toBe('/privacidad');
  });
});
