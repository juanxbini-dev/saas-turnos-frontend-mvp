import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BeneficioPage } from '../../pages/public/BeneficioPage';
import AppRouter from '../../router/AppRouter';

// Plan mails-beneficios §4.1 y fase 4a: página pública /beneficio. Llega con
// `?m=` desde el mail (trae nombre y beneficio), pide los datos, y el código
// sale por mail: la pantalla de éxito muestra el mail enmascarado, nunca el código.

const get = vi.fn();
const post = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

// Para la prueba de ruta: sin sesión y sin el resto de las páginas
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: null, isAuthenticated: false, loading: false, roles: [] }, logout: vi.fn() }),
}));
vi.mock('../../pages/public/DebSalonLandingPage', () => ({ DebSalonLandingPage: () => <div>PAGINA landing</div> }));
vi.mock('../../pages/LoginPage', () => ({ default: () => <div>PAGINA login</div> }));

const M = 'Xk92mPq7Lt';
const BENEFICIO = { nombre: 'Bienvenida', porcentaje: 15, aplica_servicio: true, aplica_productos: false, vigencia_dias: 30 };

const ok = (data: unknown) => ({ data: { success: true, data } });
const falla = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(String(status)), { response: { status, data: { success: false, ...data } } });

const CONTEXTO_VALIDO = ok({ valido: true, nombre: 'Juan', beneficio: BENEFICIO });

// La página lee `?m=` de la barra de direcciones (window.location), no del router
const renderPagina = (ruta = `/beneficio?m=${M}`, { strict = false } = {}) => {
  window.history.replaceState({}, '', ruta);
  const arbol = (
    <MemoryRouter initialEntries={[ruta]}>
      <BeneficioPage />
    </MemoryRouter>
  );
  return render(strict ? <React.StrictMode>{arbol}</React.StrictMode> : arbol);
};

const llamadasContexto = () => get.mock.calls.filter(([url]) => url === '/public/beneficios/contexto');
const llamadasSolicitar = () => post.mock.calls.filter(([url]) => url === '/public/beneficios/solicitar');

function completarYEnviar(datos: { nombre?: string; telefono?: string; email?: string } = {}) {
  if (datos.nombre !== undefined) fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: datos.nombre } });
  fireEvent.change(screen.getByLabelText('Teléfono *'), { target: { value: datos.telefono ?? '291 513-4540' } });
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: datos.email ?? 'Juan@Gmail.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Quiero mi código' }));
}

describe('/beneficio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = 'DEB Salon';
    get.mockImplementation((url: string) => (
      url === '/public/beneficios/contexto' ? Promise.resolve(CONTEXTO_VALIDO) : Promise.reject(new Error(`GET sin mock: ${url}`))
    ));
    post.mockImplementation((url: string) => (
      url === '/public/beneficios/solicitar'
        ? Promise.resolve(ok({ enviado: true, email_enmascarado: 'j***@gmail.com' }))
        : Promise.reject(new Error(`POST sin mock: ${url}`))
    ));
  });

  it('está en el router como ruta pública, sin login', async () => {
    window.history.replaceState({}, '', `/beneficio?m=${M}`);
    render(
      <MemoryRouter initialEntries={[`/beneficio?m=${M}`]}>
        <AppRouter />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu beneficio' })).toBeTruthy();
    expect(screen.queryByText('PAGINA login')).toBeNull();
    expect(document.title).toBe('Tu beneficio · DEB Salón');
    cleanup();
    expect(document.title).toBe('DEB Salon');
  });

  it('con ?m= válido: pide el contexto UNA vez con m, muestra el beneficio y precarga el nombre', async () => {
    renderPagina();

    expect(await screen.findByText('15 % de descuento en servicios')).toBeTruthy();
    expect(screen.getByText(/Bienvenida · vale 30 días · un solo uso/)).toBeTruthy();
    expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Juan');
    expect((screen.getByLabelText('Quiero recibir novedades de DEB Salón.') as HTMLInputElement).checked).toBe(true);

    const enlace = screen.getByRole('link', { name: 'Ver política de privacidad' });
    expect(enlace.getAttribute('href')).toBe('/privacidad');
    expect(enlace.closest('label')).toBeNull();

    expect(llamadasContexto()).toHaveLength(1);
    expect(llamadasContexto()[0][1]).toMatchObject({ params: { m: M } });
  });

  it('con StrictMode (dev monta los efectos dos veces) igual carga: pide el contexto UNA vez y sale del spinner', async () => {
    renderPagina(`/beneficio?m=${M}`, { strict: true });

    expect(await screen.findByText('15 % de descuento en servicios')).toBeTruthy();
    expect(llamadasContexto()).toHaveLength(1);
    expect(llamadasContexto()[0][1]).toMatchObject({ params: { m: M } });
    expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Juan');
  });

  it('saca ?m= de la barra apenas lo lee, conserva el resto de la URL, y el contexto se pidió con el m original', async () => {
    renderPagina(`/beneficio?m=${M}&utm_source=mail#arriba`, { strict: true });
    await screen.findByText('15 % de descuento en servicios');

    await waitFor(() => expect(window.location.search).not.toContain('m='));
    expect(window.location.search).toBe('?utm_source=mail');
    expect(window.location.hash).toBe('#arriba');
    expect(window.location.pathname).toBe('/beneficio');
    expect(llamadasContexto()).toHaveLength(1);
    expect(llamadasContexto()[0][1]).toMatchObject({ params: { m: M } });

    // Y al pedir el código, sigue viajando el m original aunque ya no esté en la barra
    completarYEnviar();
    await waitFor(() => expect(llamadasSolicitar()).toHaveLength(1));
    expect(llamadasSolicitar()[0][1]).toMatchObject({ m: M });
  });

  it('si el backend no manda el mail enmascarado, dice "a tu mail" y nunca el mail completo', async () => {
    post.mockResolvedValueOnce(ok({ enviado: true }));
    renderPagina();
    await screen.findByText('15 % de descuento en servicios');

    completarYEnviar({ email: 'juan@gmail.com' });

    expect(await screen.findByText('Listo')).toBeTruthy();
    expect(document.body.textContent).toContain('Te mandamos el código a tu mail.');
    expect(document.body.textContent).not.toContain('juan@gmail.com');
  });

  it('sin ?m= pide el contexto sin parámetro (beneficio de la landing); un m sin forma de código tampoco se manda', async () => {
    renderPagina('/beneficio');
    await screen.findByText('15 % de descuento en servicios');
    expect(llamadasContexto()[0][1]).toMatchObject({ params: undefined });

    cleanup();
    vi.clearAllMocks();
    renderPagina('/beneficio?m=<script>');
    await screen.findByText('15 % de descuento en servicios');
    expect(llamadasContexto()[0][1]).toMatchObject({ params: undefined });
  });

  it('el beneficio que aplica a servicios y productos se describe así', async () => {
    get.mockResolvedValue(ok({ valido: true, beneficio: { ...BENEFICIO, aplica_productos: true, vigencia_dias: 1 } }));
    renderPagina();
    expect(await screen.findByText('15 % de descuento en servicios y productos')).toBeTruthy();
    expect(screen.getByText(/vale 1 día · un solo uso/)).toBeTruthy();
  });

  it.each([
    ['baja', /Pediste no recibir más mails de DEB Salón/],
    ['sin_beneficio', /Por ahora no hay ningún beneficio disponible/],
    ['vencido', 'Este enlace ya venció.'],
    ['inexistente', 'Este enlace no es válido.'],
  ])('valido:false con motivo %s: mensaje y sin formulario', async (motivo, mensaje) => {
    get.mockResolvedValue(ok({ valido: false, motivo }));
    renderPagina();

    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quiero mi código' })).toBeNull();
    expect(screen.queryByLabelText('Email *')).toBeNull();
    expect(screen.getByRole('link', { name: 'Reservar turno' }).getAttribute('href')).toBe('/');
  });

  it('si el contexto no carga: mensaje y botón de reintentar', async () => {
    get.mockRejectedValueOnce(new Error('Network Error'));
    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el beneficio. Probá de nuevo más tarde.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('15 % de descuento en servicios')).toBeTruthy();
    expect(llamadasContexto()).toHaveLength(2);
  });

  it('éxito: manda los datos (mail en minúsculas, m, acepta_novedades) y muestra el mail enmascarado, nunca el código', async () => {
    renderPagina();
    await screen.findByText('15 % de descuento en servicios');

    completarYEnviar();

    await waitFor(() => expect(llamadasSolicitar()).toHaveLength(1));
    expect(llamadasSolicitar()[0][1]).toEqual({
      nombre: 'Juan',
      telefono: '291 513-4540',
      email: 'juan@gmail.com',
      acepta_novedades: true,
      m: M,
    });

    expect(await screen.findByText('Listo')).toBeTruthy();
    expect(document.body.textContent).toContain('Te mandamos el código a j***@gmail.com. Revisá también el correo no deseado.');
    expect(document.body.textContent).not.toMatch(/DEB-[A-Z0-9]{5}/);
    expect(screen.queryByRole('button', { name: 'Quiero mi código' })).toBeNull();
  });

  it('destildar novedades manda acepta_novedades:false y sin m cuando no vino', async () => {
    renderPagina('/beneficio');
    await screen.findByText('15 % de descuento en servicios');

    fireEvent.click(screen.getByLabelText('Quiero recibir novedades de DEB Salón.'));
    completarYEnviar({ nombre: 'Ana López' });

    await waitFor(() => expect(llamadasSolicitar()).toHaveLength(1));
    expect(llamadasSolicitar()[0][1]).toMatchObject({ nombre: 'Ana López', acepta_novedades: false });
    expect(llamadasSolicitar()[0][1]).not.toHaveProperty('m');
  });

  it('valida en el cliente antes de llamar: nombre, teléfono y mail', async () => {
    get.mockResolvedValue(ok({ valido: true, beneficio: BENEFICIO }));
    renderPagina();
    await screen.findByText('15 % de descuento en servicios');

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'no-es-mail' } });
    fireEvent.change(screen.getByLabelText('Teléfono *'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quiero mi código' }));

    expect(await screen.findByText('Ingresá tu nombre')).toBeTruthy();
    expect(screen.getByText('Ingresá un email válido')).toBeTruthy();
    expect(screen.getByText('Ingresá tu teléfono')).toBeTruthy();
    expect(llamadasSolicitar()).toHaveLength(0);
  });

  it.each([
    [429, {}, 'Demasiados intentos, probá más tarde.'],
    [404, { code: 'BENEFICIO_NO_DISPONIBLE' }, 'Este beneficio ya no está disponible.'],
    [400, { code: 'VALIDACION', message: 'El teléfono no es válido' }, 'El teléfono no es válido'],
    [500, {}, 'No pudimos enviar tu pedido. Probá de nuevo en un rato.'],
  ])('error %s al solicitar: muestra "%s" y deja el formulario para reintentar', async (status, data, mensaje) => {
    post.mockRejectedValueOnce(falla(status, data));
    renderPagina();
    await screen.findByText('15 % de descuento en servicios');

    completarYEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByRole('button', { name: 'Quiero mi código' })).toBeTruthy();
    expect(screen.queryByText('Listo')).toBeNull();
  });

  it('429 al pedir el contexto: mensaje de demasiados intentos', async () => {
    get.mockRejectedValueOnce(falla(429));
    renderPagina();
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos, probá más tarde.');
  });
});
