import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import type { BeneficioDeLink } from '../../types/beneficios.public.types';

vi.setConfig({ testTimeout: 20000 });

// beneficio-con-turno §3 y §5.2: el beneficio del mail (`?m=`) llega al
// asistente ya resuelto por la landing.
//   - disponible: cartel en los tres pasos, precio tachado, "Tus datos"
//     precargados, sin "¿Tenés un código?", textos de confianza, y la reserva
//     lleva `beneficio_m` (nunca `beneficio_codigo`).
//   - 400 BENEFICIO_INVALIDO: el turno no se creó, se dice por qué y se puede
//     reservar sin beneficio.
//   - reservado / usado / vencido: aviso y reserva normal.

const createTurno = vi.fn();
const validateCliente = vi.fn();
const getServiciosProfesional = vi.fn();
const validarCodigo = vi.fn();

vi.mock('../../services/public', () => ({
  turnoPublicService: {
    createTurno: (...args: unknown[]) => createTurno(...args),
    validateCliente: (...args: unknown[]) => validateCliente(...args),
  },
  servicioPublicService: {
    getServiciosProfesional: (...args: unknown[]) => getServiciosProfesional(...args),
  },
}));

vi.mock('../../services/public/beneficioPublic.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/public/beneficioPublic.service')>()),
  beneficioPublicService: {
    validarCodigo: (...args: unknown[]) => validarCodigo(...args),
  },
}));

vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 10,
    año: 2026,
    selectedDate: '2026-10-30',
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
const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 30 };
const DESCUENTO = { nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false };
const REGALO = { nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null, aplica_servicio: true, aplica_productos: false };
const PRECARGA = { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: '2915123456' };

const link = (extra: Partial<BeneficioDeLink> = {}): BeneficioDeLink => ({
  m: M,
  estado: 'disponible',
  nombre: 'Ana',
  beneficio: DESCUENTO,
  vence_el: '2026-11-12',
  precarga: PRECARGA,
  turno: null,
  ...extra,
});

const falla400 = (code: string, motivo?: string) =>
  Object.assign(new Error('400'), { response: { status: 400, data: { success: false, code, message: 'no', ...(motivo ? { motivo } : {}) } } });

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

const cartel = () => screen.queryByTestId('cartel-beneficio-link');
const valor = (placeholder: string) => (screen.getByPlaceholderText(placeholder) as HTMLInputElement).value;

async function irAlPaso3() {
  fireEvent.click(await screen.findByText('Corte'));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Resumen del turno');
}

describe('CreateTurnoPublicModal — beneficio del mail (?m=)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...DESCUENTO } } } });
  });

  it('disponible: cartel en los tres pasos y precio tachado con el precio con descuento', async () => {
    renderModal({ beneficioLink: link() });

    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(cartel()).toHaveTextContent('Tu 20 % ya está aplicado · reservá hasta el 12/11');
    expect(screen.getByTestId('precio-tachado')).toHaveTextContent('$12.000');
    expect(screen.getByTestId('precio-con-descuento')).toHaveTextContent('$9.600');

    fireEvent.click(screen.getByText('Corte'));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Fecha y hora')).toBeTruthy();
    expect(cartel()).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Resumen del turno');
    expect(cartel()).toBeTruthy();
    // El resumen también muestra el precio con descuento
    expect(screen.getAllByTestId('precio-con-descuento').length).toBeGreaterThan(0);
  });

  it('disponible: precarga "Tus datos", pregunta por el número, oculta el código y avisa la cancelación', async () => {
    renderModal({ beneficioLink: link() });
    await irAlPaso3();

    expect(valor('Tu nombre')).toBe('Ana');
    expect(valor('Tu apellido')).toBe('Pérez');
    expect(valor('tucorreo@ejemplo.com')).toBe('ana@gmail.com');
    expect(valor('+54 9 11 1234-5678')).toBe('2915123456');
    expect(screen.getByText('¿Sigue siendo tu número?')).toBeTruthy();
    expect(screen.getByText('Te mandamos la confirmación y el recordatorio de tu turno por WhatsApp')).toBeTruthy();
    expect(screen.queryByLabelText('¿Tenés un código?')).toBeNull();
    expect(screen.getByTestId('beneficio-cancelacion')).toHaveTextContent(
      'Si no podés venir, cancelás hasta 24 h antes y tu beneficio te sigue esperando.'
    );

    // Todo editable: si cambia el teléfono, ya no se pregunta
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '2915999999' } });
    expect(screen.queryByText('¿Sigue siendo tu número?')).toBeNull();
  });

  it('sin teléfono precargado no pregunta por el número', async () => {
    renderModal({ beneficioLink: link({ precarga: { ...PRECARGA, telefono: null } }) });
    await irAlPaso3();
    expect(valor('+54 9 11 1234-5678')).toBe('');
    expect(screen.queryByText('¿Sigue siendo tu número?')).toBeNull();
  });

  it('disponible: la reserva lleva beneficio_m (y no beneficio_codigo) y la confirmación dice el descuento', async () => {
    const onBeneficioLinkReservado = vi.fn();
    const onBeneficioUsado = vi.fn();
    renderModal({
      beneficioLink: link(),
      onBeneficioLinkReservado,
      onBeneficioUsado,
      // Aunque haya un código de `?b=` en la visita, con el link no viaja
      beneficioInicial: { codigo: 'DEB-AAAAA', beneficio: DESCUENTO, vence_el: null },
    });
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const body = createTurno.mock.calls[0][0];
    expect(body).toMatchObject({
      beneficio_m: M,
      cliente_data: { nombre: 'Ana Pérez', email: 'ana@gmail.com', telefono: '2915123456' },
    });
    expect(body).not.toHaveProperty('beneficio_codigo');

    expect(await screen.findByTestId('confirmacion-beneficio')).toHaveTextContent('Tu turno del 30/10 tiene 20 % de descuento');
    expect(onBeneficioLinkReservado).toHaveBeenCalledWith({ fecha: '2026-10-30', hora: '15:00' });
    expect(onBeneficioUsado).not.toHaveBeenCalled();
  });

  it('beneficio "otro": el cartel y la confirmación nombran el regalo, sin precios tachados', async () => {
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...REGALO } } } });
    renderModal({ beneficioLink: link({ beneficio: REGALO }) });
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(cartel()).toHaveTextContent('Tu beneficio ya está aplicado: Ampolla de tratamiento de regalo · reservá hasta el 12/11');
    expect(screen.queryByTestId('precio-tachado')).toBeNull();

    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    expect(await screen.findByTestId('confirmacion-beneficio')).toHaveTextContent(
      'Tu turno del 30/10 viene con tu beneficio: Ampolla de tratamiento de regalo'
    );
  });

  it.each([
    ['usado', 'Este beneficio ya se usó.'],
    ['reservado', 'Ya hay un turno reservado con este beneficio.'],
    ['vencido', 'Esta oferta venció el 12/11.'],
    ['anulado', 'Este beneficio ya no está disponible.'],
    ['baja', 'Este beneficio ya no está disponible.'],
  ])('400 BENEFICIO_INVALIDO (%s): no hay turno, se dice por qué y se puede reservar sin beneficio', async (motivo, mensaje) => {
    const onBeneficioLinkRechazado = vi.fn();
    createTurno
      .mockRejectedValueOnce(falla400('BENEFICIO_INVALIDO', motivo))
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'tur-2', beneficio: null } } });
    renderModal({ beneficioLink: link(), onBeneficioLinkRechazado });
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(mensaje);
    expect(alerta).toHaveTextContent('Tu turno todavía no está reservado. Podés reservar igual, sin el beneficio.');
    expect(screen.queryByRole('button', { name: 'Corregir mis datos' })).toBeNull();
    expect(screen.queryByText('Turno confirmado')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
    expect(onBeneficioLinkRechazado).toHaveBeenCalledWith(motivo);
    // Los datos siguen cargados
    expect(valor('Tu nombre')).toBe('Ana');

    fireEvent.click(screen.getByRole('button', { name: 'Reservar sin beneficio' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(2));
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_m');
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByTestId('confirmacion-beneficio')).toBeNull();
  });

  it.each([
    ['reservado', link({ estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } }), 'Ya hay un turno reservado con este beneficio: 30/10 a las 15:00'],
    ['usado', link({ estado: 'usado' }), 'Este beneficio ya se usó'],
    ['vencido', link({ estado: 'vencido' }), 'Esta oferta venció el 12/11'],
  ])('%s: avisa, no tacha precios, deja el código y reserva sin beneficio_m', async (_estado, beneficioLink, texto) => {
    renderModal({ beneficioLink });
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(cartel()).toHaveTextContent(texto);
    expect(cartel()?.textContent).not.toMatch(/Ana/);
    expect(screen.queryByTestId('precio-tachado')).toBeNull();

    await irAlPaso3();
    expect(screen.getByLabelText('¿Tenés un código?')).toBeTruthy();
    expect(screen.queryByTestId('beneficio-cancelacion')).toBeNull();
    // La precarga vale igual: es la misma persona
    expect(valor('Tu nombre')).toBe('Ana');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_m');
  });

  it('sin link: ni cartel ni textos de beneficio, y el asistente arranca vacío', async () => {
    renderModal();
    await irAlPaso3();
    expect(cartel()).toBeNull();
    expect(valor('Tu nombre')).toBe('');
    expect(screen.queryByText('¿Sigue siendo tu número?')).toBeNull();
    expect(screen.queryByTestId('beneficio-cancelacion')).toBeNull();
    // La línea de WhatsApp va siempre
    expect(screen.getByText('Te mandamos la confirmación y el recordatorio de tu turno por WhatsApp')).toBeTruthy();
  });
});

describe('CreateTurnoPublicModal — beneficio pedido que no se aplicó', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
  });

  it('turno creado con beneficio: null → avisa y NO lo da por reservado', async () => {
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: null } } });
    const onBeneficioLinkReservado = vi.fn();
    renderModal({ beneficioLink: link(), onBeneficioLinkReservado });
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.getByTestId('beneficio-no-aplicado')).toHaveTextContent(
      'Tu turno quedó confirmado, pero no pudimos aplicar el beneficio: avisá en el salón y te lo aplicamos.'
    );
    expect(screen.queryByTestId('confirmacion-beneficio')).toBeNull();
    expect(onBeneficioLinkReservado).not.toHaveBeenCalled();
  });
});

describe('CreateTurnoPublicModal — cupón del mail (D26)', () => {
  const CUPON = 'DEB-7K3P9';
  const cupon = (extra: Record<string, unknown> = {}) => ({
    valido: true, origen: 'cupon', estado: 'disponible', beneficio: DESCUENTO, vence_el: '2026-11-12', turno: null, ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: CUPON, ...DESCUENTO } } } });
  });

  function completarDatos() {
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'juan@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
  }

  function escribirCupon(texto = CUPON) {
    const campo = screen.getByLabelText('¿Tenés un código?');
    fireEvent.change(campo, { target: { value: texto } });
    fireEvent.blur(campo);
  }

  it('disponible: mismo cartel y precios tachados que el link, sin precargar datos; viaja como beneficio_codigo', async () => {
    validarCodigo.mockResolvedValue(cupon());
    renderModal();
    await irAlPaso3();
    expect(cartel()).toBeNull();
    escribirCupon('deb-7k3p9');

    expect(await screen.findByTestId('cartel-beneficio-link')).toHaveTextContent('Tu 20 % ya está aplicado · reservá hasta el 12/11');
    expect(screen.queryByTestId('chip-beneficio')).toBeNull();
    expect(screen.getByTestId('precio-con-descuento')).toHaveTextContent('$9.600');
    expect(screen.getByTestId('beneficio-cancelacion')).toBeTruthy();
    // Sin nombre ni precarga (un código corto se puede adivinar)
    expect(valor('Tu nombre')).toBe('');
    expect(cartel()?.textContent).not.toMatch(/Ana/);

    // Para el resto de la reserva: volviendo al paso de servicios también
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByTestId('precio-tachado')).toHaveTextContent('$12.000');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Resumen del turno');

    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ beneficio_codigo: CUPON });
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_m');
    expect(await screen.findByTestId('confirmacion-beneficio')).toHaveTextContent('Tu turno del 30/10 tiene 20 % de descuento');
  });

  it.each([
    ['reservado', { estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } }, 'Ya hay un turno reservado con este beneficio: 30/10 a las 15:00'],
    ['usado', { estado: 'usado' }, 'Este beneficio ya se usó'],
    ['vencido', { estado: 'vencido' }, 'Esta oferta venció el 12/11'],
  ])('%s: mensaje neutro en el campo, sin cartel ni precios tachados', async (_estado, extra, texto) => {
    validarCodigo.mockResolvedValue(cupon(extra));
    renderModal();
    await irAlPaso3();
    escribirCupon();
    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    expect(cartel()).toBeNull();
    expect(screen.queryByTestId('precio-con-descuento')).toBeNull();
    expect(screen.queryByTestId('chip-beneficio')).toBeNull();
  });

  it('cambiar el texto del campo saca el cartel del cupón', async () => {
    validarCodigo.mockResolvedValue(cupon());
    renderModal();
    await irAlPaso3();
    escribirCupon();
    await screen.findByTestId('cartel-beneficio-link');
    fireEvent.change(screen.getByLabelText('¿Tenés un código?'), { target: { value: 'DEB-7K3P' } });
    expect(cartel()).toBeNull();
  });

  it('la reserva rechazada por usado (otra ficha) lo dice con el texto neutro y se puede borrar el código y seguir', async () => {
    validarCodigo.mockResolvedValue(cupon());
    createTurno
      .mockRejectedValueOnce(falla400('BENEFICIO_INVALIDO', 'usado'))
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'tur-2', beneficio: null } } });
    renderModal();
    await irAlPaso3();
    completarDatos();
    escribirCupon();
    await screen.findByTestId('cartel-beneficio-link');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este beneficio ya se usó.');
    expect(cartel()).toBeNull();
    fireEvent.change(screen.getByLabelText('¿Tenés un código?'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(2));
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByTestId('beneficio-no-aplicado')).toBeNull();
  });

  it('D29: cupón de otra persona (BENEFICIO_NO_CORRESPONDE) → lo dice y deja reservar sin beneficio', async () => {
    validarCodigo.mockResolvedValue(cupon());
    createTurno
      .mockRejectedValueOnce(falla400('BENEFICIO_NO_CORRESPONDE'))
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'tur-2', beneficio: null } } });
    renderModal();
    await irAlPaso3();
    completarDatos();
    escribirCupon();
    await screen.findByTestId('cartel-beneficio-link');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se aplicó tu beneficio');
    expect(alerta).toHaveTextContent('No pudimos aplicar el código con estos datos. Usá el mismo mail o teléfono con el que recibiste el mail de DEB Salón.');
    expect(alerta).toHaveTextContent('Tu turno todavía no está reservado. Corregí tus datos o reservá igual, sin el beneficio.');
    expect(screen.queryByText('Turno confirmado')).toBeNull();
    // El recuadro queda enfocado (se ve aunque el botón de confirmar esté fijo abajo)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('error-beneficio')));
    // "Corregir mis datos" lleva al mail
    fireEvent.click(screen.getByRole('button', { name: 'Corregir mis datos' }));
    expect(document.activeElement).toBe(screen.getByPlaceholderText('tucorreo@ejemplo.com'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar sin beneficio' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(2));
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_codigo');
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_m');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByTestId('beneficio-no-aplicado')).toBeNull();
  });

  it('con beneficio por link disponible, el campo sigue oculto', async () => {
    renderModal({ beneficioLink: link() });
    await irAlPaso3();
    expect(screen.queryByLabelText('¿Tenés un código?')).toBeNull();
  });
});
