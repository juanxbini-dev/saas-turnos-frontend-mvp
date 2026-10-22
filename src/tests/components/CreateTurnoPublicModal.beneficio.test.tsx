import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';


// Con la suite entera esta máquina tarda ~4-5 min y un test de ~5 s queda al borde del timeout
vi.setConfig({ testTimeout: 20000 });
// Plan mails-beneficios §4.1 / fase 4a: el paso 3 tiene un campo opcional
// "¿Tenés un código de descuento?" que se valida al salir del campo y muestra
// el chip 🎟 o el motivo. Al confirmar viaja `beneficio_codigo`; si el backend
// contesta BENEFICIO_INVALIDO / BENEFICIO_NO_CORRESPONDE el turno NO se creó y
// el error se ve en el paso 3, al lado del campo.

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

const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 10000, duracion_minutos: 30 };
const BENEFICIO = { nombre: 'Bienvenida', porcentaje: 15, aplica_servicio: true, aplica_productos: false };
const VALIDO = { valido: true, beneficio: BENEFICIO, vence_el: '2026-11-12' };
const LABEL_CODIGO = '¿Tenés un código de descuento?';

const falla400 = (code: string, message: string) =>
  Object.assign(new Error('400'), { response: { status: 400, data: { success: false, code, message } } });

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

const campoCodigo = () => screen.getByLabelText(LABEL_CODIGO) as HTMLInputElement;
const chip = () => screen.queryByTestId('chip-beneficio');

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
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
}

function escribirCodigoYSalir(texto: string) {
  fireEvent.change(campoCodigo(), { target: { value: texto } });
  fireEvent.blur(campoCodigo());
}

describe('CreateTurnoPublicModal — código de beneficio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...BENEFICIO } } } });
    validarCodigo.mockResolvedValue(VALIDO);
  });

  it('el campo es opcional y solo está en el paso 3; sin código la reserva no manda beneficio_codigo', async () => {
    renderModal();
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.queryByLabelText(LABEL_CODIGO)).toBeNull();
    expect(chip()).toBeNull();

    await irAlPaso3();
    expect(campoCodigo().value).toBe('');
    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_codigo');
    expect(validarCodigo).not.toHaveBeenCalled();
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByText(/queda aplicado al pagar/)).toBeNull();
  });

  it('código bueno: al salir del campo lo valida, lo normaliza y muestra el chip con el vencimiento', async () => {
    renderModal();
    await irAlPaso3();

    escribirCodigoYSalir('deb-7k3p9');

    await waitFor(() => expect(validarCodigo).toHaveBeenCalledWith('DEB-7K3P9'));
    expect(await screen.findByTestId('chip-beneficio')).toHaveTextContent('15 % en servicios aplicado · vence el 12/11');
    expect(campoCodigo().value).toBe('DEB-7K3P9');
    expect(screen.getByText('Código válido: 15 % en servicios.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    // No se vuelve a consultar si el código es el mismo
    fireEvent.blur(campoCodigo());
    expect(validarCodigo).toHaveBeenCalledTimes(1);
  });

  it('con el código validado la reserva lleva beneficio_codigo y la pantalla de éxito dice el descuento', async () => {
    const onBeneficioUsado = vi.fn();
    renderModal({ onBeneficioUsado });
    await irAlPaso3();
    completarDatos();
    escribirCodigoYSalir('DEB-7K3P9');
    await screen.findByTestId('chip-beneficio');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ beneficio_codigo: 'DEB-7K3P9', marketing_consentimiento: true });
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.getByText(/Tu descuento del 15 % queda aplicado al pagar/)).toBeTruthy();
    expect(onBeneficioUsado).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['vencido', 'Ese código ya venció'],
    ['usado', 'Ese código ya se usó'],
    ['reservado', 'Ese código ya está reservado en otro turno'],
    ['anulado', 'Ese código fue anulado'],
    ['inexistente', 'Ese código no existe'],
  ])('código malo (%s): muestra el motivo y no hay chip', async (motivo, mensaje) => {
    validarCodigo.mockResolvedValue({ valido: false, motivo });
    renderModal();
    await irAlPaso3();

    escribirCodigoYSalir('DEB-7K3P9');

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(chip()).toBeNull();
  });

  it('un texto sin forma de código no se consulta: avisa la forma y no deja confirmar hasta borrarlo', async () => {
    renderModal();
    await irAlPaso3();
    completarDatos();

    escribirCodigoYSalir('abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('El código tiene la forma DEB-XXXXX');
    expect(validarCodigo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('El código tiene la forma DEB-XXXXX'));
    expect(createTurno).not.toHaveBeenCalled();

    // Lo borra y sigue sin código
    fireEvent.change(campoCodigo(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_codigo');
  });

  it('si no se pudo validar (red), avisa y no bloquea', async () => {
    validarCodigo.mockResolvedValue(null);
    renderModal();
    await irAlPaso3();
    escribirCodigoYSalir('DEB-7K3P9');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos validar el código. Probá de nuevo en un momento.');
    expect(chip()).toBeNull();
  });

  it('cambiar el texto después de validar saca el chip hasta volver a validar', async () => {
    renderModal();
    await irAlPaso3();
    escribirCodigoYSalir('DEB-7K3P9');
    await screen.findByTestId('chip-beneficio');

    fireEvent.change(campoCodigo(), { target: { value: 'DEB-7K3P' } });
    expect(chip()).toBeNull();
  });

  it('BENEFICIO_NO_CORRESPONDE: el turno no se crea, el error se ve en el paso 3 y se puede borrar el código y seguir', async () => {
    createTurno
      .mockRejectedValueOnce(falla400('BENEFICIO_NO_CORRESPONDE', 'El código no corresponde a esa persona'))
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'tur-2', beneficio: null } } });
    renderModal();
    await irAlPaso3();
    completarDatos();
    escribirCodigoYSalir('DEB-7K3P9');
    await screen.findByTestId('chip-beneficio');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese código no es tuyo: el teléfono o el mail no coinciden con los del pedido');
    // Sigue en el paso 3, sin modal de error genérico ni de éxito, y sin chip
    expect(screen.getByText('Resumen del turno')).toBeTruthy();
    expect(screen.queryByText('Turno confirmado')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
    expect(chip()).toBeNull();
    expect((screen.getByPlaceholderText('Tu nombre') as HTMLInputElement).value).toBe('Juan');

    fireEvent.change(campoCodigo(), { target: { value: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(2));
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByText(/queda aplicado al pagar/)).toBeNull();
  });

  it('BENEFICIO_INVALIDO: muestra el mensaje del backend en el paso 3', async () => {
    createTurno.mockRejectedValueOnce(falla400('BENEFICIO_INVALIDO', 'El código ya venció'));
    renderModal();
    await irAlPaso3();
    completarDatos();
    escribirCodigoYSalir('DEB-7K3P9');
    await screen.findByTestId('chip-beneficio');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El código ya venció');
    expect(screen.getByText('Resumen del turno')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
  });

  it('otros errores de la reserva siguen abriendo el modal de error de siempre', async () => {
    createTurno.mockRejectedValueOnce(Object.assign(new Error('409'), { response: { status: 409, data: { message: 'Ese horario ya no está disponible' } } }));
    renderModal();
    await irAlPaso3();
    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    expect(await screen.findByRole('button', { name: 'Entendido' })).toBeTruthy();
    expect(screen.getByText('Ese horario ya no está disponible')).toBeTruthy();
  });

  it('con beneficioInicial (llegó por ?b=): chip en los tres pasos y el campo prellenado, sin volver a validar', async () => {
    renderModal({ beneficioInicial: { codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: '2026-11-12' } });

    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.getByTestId('chip-beneficio')).toHaveTextContent('15 % en servicios aplicado · vence el 12/11');

    fireEvent.click(screen.getByText('Corte'));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Fecha y hora')).toBeTruthy();
    expect(screen.getByTestId('chip-beneficio')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Resumen del turno');
    expect(screen.getByTestId('chip-beneficio')).toBeTruthy();
    expect(campoCodigo().value).toBe('DEB-7K3P9');
    expect(validarCodigo).not.toHaveBeenCalled();

    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ beneficio_codigo: 'DEB-7K3P9' });
  });

  it('con beneficioInicial la persona puede borrar el código y reservar sin descuento', async () => {
    renderModal({ beneficioInicial: { codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: null } });
    await irAlPaso3();
    completarDatos();

    fireEvent.change(campoCodigo(), { target: { value: '' } });
    expect(chip()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_codigo');
  });
});
