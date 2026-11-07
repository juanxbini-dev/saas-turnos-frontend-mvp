import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import type { BeneficioDeLink } from '../../types/beneficios.public.types';

vi.setConfig({ testTimeout: 20000 });

// lista-vieja-cierre D3/D4: el beneficio (link `?m=`, cupón o código `?b=`) vale
// con algunos profesionales. Reservando con uno que no está:
//   - aviso antes de confirmar: "Este beneficio solo es apto para usar con A, B
//     o C." (texto de Juan) y, chico, "El turno se reserva sin el beneficio."
//   - sin precio tachado, y la reserva va SIN beneficio (no viaja beneficio_m,
//     cupón ni código) y sin consumir el link
//   - si igual el backend responde 400 BENEFICIO_PROFESIONAL: mensaje claro y
//     "Reservar sin beneficio", sin dar el link por perdido

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
const PROFESIONALES = [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-juli', nombre: 'Juli' }, { id: 'u-meli', nombre: 'Meli' }];
const DESCUENTO = {
  nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false,
  profesionales: PROFESIONALES,
};
const PRECARGA = { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: '2915123456' };
const AVISO = 'Este beneficio solo es apto para usar con Caro, Juli o Meli.';
const SIN = 'El turno se reserva sin el beneficio.';

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

function renderModal(extra: Partial<React.ComponentProps<typeof CreateTurnoPublicModal>> = {}, profesional = { id: 'u-dani', nombre: 'Dani' }) {
  return render(
    <CreateTurnoPublicModal
      {...extra}
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      profesionalId={profesional.id}
      profesionalNombre={profesional.nombre}
      empresaSlug="deb-salon"
      empresaId="emp-1"
    />
  );
}

const aviso = () => screen.queryByTestId('aviso-beneficio-no-aplica');

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

describe('CreateTurnoPublicModal — beneficio por profesional (D3/D4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: null } } });
  });

  it('link con un profesional fuera del beneficio: aviso en los tres pasos, sin precio tachado, y la reserva va sin beneficio sin consumir el link', async () => {
    const onBeneficioLinkReservado = vi.fn();
    const onBeneficioLinkRechazado = vi.fn();
    renderModal({ beneficioLink: link(), onBeneficioLinkReservado, onBeneficioLinkRechazado });

    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(aviso()).toHaveTextContent(AVISO);
    expect(screen.queryByTestId('cartel-beneficio-link')).toBeNull();
    expect(screen.queryByTestId('precio-tachado')).toBeNull();

    await irAlPaso3();
    expect(aviso()).toHaveTextContent(AVISO);
    // Junto al botón de confirmar (zona fija)
    expect(screen.getByTestId('aviso-sin-beneficio-confirmar')).toHaveTextContent(SIN);
    expect(screen.queryByTestId('beneficio-cancelacion')).toBeNull();
    // Sin el link, se puede escribir otro código
    expect(screen.getByLabelText('¿Tenés un código?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const body = createTurno.mock.calls[0][0];
    expect(body).not.toHaveProperty('beneficio_m');
    expect(body).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByTestId('beneficio-no-aplicado')).toBeNull();
    expect(onBeneficioLinkReservado).not.toHaveBeenCalled();
    expect(onBeneficioLinkRechazado).not.toHaveBeenCalled();
  });

  it('link con un profesional del beneficio: como siempre (cartel, precio tachado y beneficio_m)', async () => {
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...DESCUENTO } } } });
    renderModal({ beneficioLink: link() }, { id: 'u-juli', nombre: 'Juli' });
    expect(await screen.findByTestId('cartel-beneficio-link')).toHaveTextContent('Tu 20 % ya está aplicado');
    expect(aviso()).toBeNull();
    expect(screen.getByTestId('precio-con-descuento')).toHaveTextContent('$9.600');
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ beneficio_m: M });
  });

  it('código `?b=` que no vale con el profesional: sin chip, con aviso, y no viaja', async () => {
    const onBeneficioUsado = vi.fn();
    renderModal({ beneficioInicial: { codigo: 'DEB-AAAA2', beneficio: DESCUENTO, vence_el: null }, onBeneficioUsado });
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.queryByTestId('chip-beneficio')).toBeNull();
    expect(aviso()).toHaveTextContent(AVISO);

    await irAlPaso3();
    expect(screen.getByTestId('codigo-no-aplica')).toHaveTextContent(`${AVISO}${SIN}`);
    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_codigo');
    expect(onBeneficioUsado).not.toHaveBeenCalled();
  });

  it('cupón escrito que no vale con el profesional: aviso y no viaja', async () => {
    validarCodigo.mockResolvedValue({
      valido: true, origen: 'cupon', estado: 'disponible', vence_el: '2026-11-12', turno: null,
      beneficio: { ...DESCUENTO, profesionales: [{ id: 'u-caro', nombre: 'Caro' }] },
    });
    renderModal();
    await irAlPaso3();
    const campo = screen.getByLabelText('¿Tenés un código?');
    fireEvent.change(campo, { target: { value: 'DEB-7K3P9' } });
    fireEvent.blur(campo);

    expect(await screen.findByTestId('aviso-beneficio-no-aplica')).toHaveTextContent('Este beneficio solo es apto para usar con Caro.');
    expect(screen.queryByTestId('cartel-beneficio-link')).toBeNull();
    expect(screen.queryByTestId('precio-con-descuento')).toBeNull();

    completarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_codigo');
  });

  it('400 BENEFICIO_PROFESIONAL con el link: lo explica, deja reservar sin beneficio y no da el link por perdido', async () => {
    const onBeneficioLinkRechazado = vi.fn();
    createTurno
      .mockRejectedValueOnce(Object.assign(new Error('400'), {
        response: { status: 400, data: { success: false, code: 'BENEFICIO_PROFESIONAL', message: 'no' } },
      }))
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'tur-1', beneficio: null } } });
    // La landing creía que Juli estaba en el beneficio (lista vieja)
    renderModal({ beneficioLink: link(), onBeneficioLinkRechazado }, { id: 'u-juli', nombre: 'Juli' });
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    const alerta = await screen.findByTestId('error-beneficio');
    expect(alerta).toHaveTextContent('No se aplicó tu beneficio');
    expect(alerta).toHaveTextContent(AVISO);
    expect(alerta).toHaveTextContent('Tu turno todavía no está reservado.');
    expect(onBeneficioLinkRechazado).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reservar sin beneficio' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(2));
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_m');
    expect(createTurno.mock.calls[1][0]).not.toHaveProperty('beneficio_codigo');
  });

  it('con nombres completos, el aviso usa el nombre de pila', async () => {
    renderModal(
      { beneficioLink: link({ beneficio: { ...DESCUENTO, profesionales: [{ id: 'u-caro', nombre: 'Carolina Gómez' }] } }) },
      { id: 'u-dani', nombre: 'Dani Pérez' }
    );
    expect(await screen.findByTestId('aviso-beneficio-no-aplica')).toHaveTextContent('Este beneficio solo es apto para usar con Carolina.');
    await irAlPaso3();
    expect(screen.getByTestId('aviso-sin-beneficio-confirmar')).toHaveTextContent(SIN);
  });

  it('con `profesionales: []` (nadie del beneficio sigue activo) no vale con nadie: aviso y sin beneficio_m', async () => {
    renderModal({ beneficioLink: link({ beneficio: { ...DESCUENTO, profesionales: [] } }) }, { id: 'u-caro', nombre: 'Caro' });
    expect(await screen.findByTestId('aviso-beneficio-no-aplica')).toHaveTextContent('Este beneficio no se puede usar con ningún profesional por ahora.');
    expect(screen.queryByTestId('precio-tachado')).toBeNull();
    await irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('beneficio_m');
  });

  it('sin lista de profesionales (respuesta vieja) vale con todos', async () => {
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...DESCUENTO } } } });
    renderModal({ beneficioLink: link({ beneficio: { ...DESCUENTO, profesionales: undefined } }) });
    expect(await screen.findByTestId('cartel-beneficio-link')).toBeTruthy();
    expect(aviso()).toBeNull();
  });
});
