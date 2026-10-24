import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinalizarTurnoModal } from '../../components/turnos/FinalizarTurnoModal';
import type { TurnoConDetalle } from '../../types/turno.types';

// Plan mails-beneficios §4.5 (P8): con código de beneficio el descuento viene
// precargado y bloqueado; "Cobrar sin el código (no corresponde)" lo desbloquea
// (queda en 0) y manda usar_beneficio:false. Sin tilde viaja usar_beneficio:true.

const finalizarTurno = vi.fn();
const editarPago = vi.fn();
vi.mock('../../services/turno.service', () => ({
  turnoService: {
    finalizarTurno: (...a: unknown[]) => finalizarTurno(...a),
    editarPago: (...a: unknown[]) => editarPago(...a),
  },
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(() => ({ data: [], loading: false, revalidate: vi.fn() })),
}));

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../services/productos.service', () => ({
  productosService: { getProductos: vi.fn(() => Promise.resolve([])) },
}));

const BENEFICIO = {
  codigo_id: 'bc-1', codigo: 'DEB-7K3P9', nombre: 'Bienvenida', tipo: 'descuento' as const, porcentaje: 15,
  aplica_servicio: true, aplica_productos: false, estado: 'reservado' as const,
};

// beneficios-tipos §3.4/§3.7: un regalo, sin porcentaje
const BENEFICIO_OTRO = {
  ...BENEFICIO, nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null,
};

const turnoBase: TurnoConDetalle = {
  id: 'turno-1',
  cliente_id: 'cliente-1',
  usuario_id: 'usuario-1',
  servicio_id: 'servicio-1',
  cliente_nombre: 'Juan Perez',
  cliente_email: 'juan@test.com',
  servicio: 'Corte',
  fecha: '2026-11-05',
  hora: '10:00:00',
  precio: 10000,
  estado: 'confirmado',
  metodo_pago: 'pendiente',
  duracion_minutos: 30,
  empresa_id: 'empresa-1',
  created_at: '2026-11-05T00:00:00Z',
  updated_at: '2026-11-05T00:00:00Z',
  notas: null,
  usuario_nombre: 'Profesional',
  usuario_username: 'profesional',
  beneficio: BENEFICIO,
};

const TEXTO_TILDE = 'Cobrar sin el código (no corresponde)';
const campoPorcentaje = () => screen.getByLabelText('Porcentaje de descuento') as HTMLInputElement;
const tilde = () => screen.getByLabelText(TEXTO_TILDE) as HTMLInputElement;
const checkboxServicio = () => screen.getByLabelText(/^Servicio/) as HTMLInputElement;

function renderModal(extra: Partial<React.ComponentProps<typeof FinalizarTurnoModal>> = {}) {
  return render(
    <FinalizarTurnoModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      turno={turnoBase}
      mode="finalizar"
      {...extra}
    />
  );
}

async function cobrarEnEfectivo() {
  fireEvent.click(screen.getByText('efectivo').closest('button')!);
  const boton = screen.getAllByText('Finalizar Turno').map((el) => el.closest('button')).find((b) => b && !b.disabled)!;
  await act(async () => { fireEvent.click(boton); });
}

describe('FinalizarTurnoModal — turno con código de beneficio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    finalizarTurno.mockResolvedValue({ id: 'turno-1', estado: 'completado' });
    editarPago.mockResolvedValue({ id: 'turno-1' });
  });

  it('muestra el chip 🎟 arriba y precarga el descuento del código, bloqueado', () => {
    renderModal();

    expect(screen.getByText('Código DEB-7K3P9 · 15 % en servicios')).toBeTruthy();
    expect(screen.getByText('El descuento del código queda aplicado.')).toBeTruthy();
    expect(campoPorcentaje().value).toBe('15');
    expect(campoPorcentaje().disabled).toBe(true);
    expect(screen.getByText('Fijado por el código de descuento.')).toBeTruthy();
    expect(checkboxServicio().checked).toBe(true);
    expect(checkboxServicio().disabled).toBe(true);
    expect(tilde().checked).toBe(false);
    // El resumen ya muestra el descuento
    expect(screen.getByText('Descuento (15%):')).toBeTruthy();
  });

  it('sin tildar: manda usar_beneficio:true con el descuento del código', async () => {
    renderModal();
    await cobrarEnEfectivo();

    await waitFor(() => expect(finalizarTurno).toHaveBeenCalledTimes(1));
    const [id, payload] = finalizarTurno.mock.calls[0];
    expect(id).toBe('turno-1');
    expect(payload).toMatchObject({
      metodoPago: 'efectivo',
      descuentoPorcentaje: 15,
      descuentoAplicarA: { servicio: true, productos: false },
      usar_beneficio: true,
    });
  });

  it('"Cobrar sin el código": desbloquea los campos, el descuento queda en 0 y manda usar_beneficio:false', async () => {
    renderModal();

    fireEvent.click(tilde());

    expect(tilde().checked).toBe(true);
    expect(campoPorcentaje().disabled).toBe(false);
    expect(campoPorcentaje().value).toBe('');
    expect(screen.getByText('Se cobra sin el código: queda libre para otro turno.')).toBeTruthy();
    expect(screen.queryByText('Fijado por el código de descuento.')).toBeNull();
    expect(screen.queryByText('Descuento (15%):')).toBeNull();

    await cobrarEnEfectivo();

    await waitFor(() => expect(finalizarTurno).toHaveBeenCalledTimes(1));
    const [, payload] = finalizarTurno.mock.calls[0];
    expect(payload).toMatchObject({ usar_beneficio: false });
    expect(payload.descuentoPorcentaje).toBeUndefined();
  });

  it('sin el código se puede cargar otro descuento a mano; destildar vuelve a poner el del código', () => {
    renderModal();
    fireEvent.click(tilde());

    fireEvent.change(campoPorcentaje(), { target: { value: '10' } });
    expect(campoPorcentaje().value).toBe('10');

    fireEvent.click(tilde());
    expect(tilde().checked).toBe(false);
    expect(campoPorcentaje().value).toBe('15');
    expect(campoPorcentaje().disabled).toBe(true);
  });

  it('en modo editar también precarga y manda usar_beneficio', async () => {
    renderModal({ mode: 'editar', turno: { ...turnoBase, estado: 'completado', metodo_pago: 'efectivo', descuento_porcentaje: 15, beneficio: { ...BENEFICIO, estado: 'usado' } } });

    expect(campoPorcentaje().value).toBe('15');
    expect(campoPorcentaje().disabled).toBe(true);

    fireEvent.click(tilde());
    await act(async () => { fireEvent.click(screen.getByText('Guardar cambios')); });

    await waitFor(() => expect(editarPago).toHaveBeenCalledTimes(1));
    expect(editarPago.mock.calls[0][1]).toMatchObject({ usar_beneficio: false });
    expect(finalizarTurno).not.toHaveBeenCalled();
  });

  it('un turno sin código: ni chip, ni tilde, ni usar_beneficio en el payload; el descuento se edita como siempre', async () => {
    renderModal({ turno: { ...turnoBase, beneficio: null } });

    expect(screen.queryByText(/Código DEB-/)).toBeNull();
    expect(screen.queryByLabelText(TEXTO_TILDE)).toBeNull();
    expect(campoPorcentaje().disabled).toBe(false);
    expect(campoPorcentaje().value).toBe('');

    await cobrarEnEfectivo();
    await waitFor(() => expect(finalizarTurno).toHaveBeenCalledTimes(1));
    expect(finalizarTurno.mock.calls[0][1]).not.toHaveProperty('usar_beneficio');
  });
});

describe('FinalizarTurnoModal — beneficio tipo "otro" (regalo: no se acumula, D21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    finalizarTurno.mockResolvedValue({ id: 'turno-1', estado: 'completado' });
    editarPago.mockResolvedValue({ id: 'turno-1' });
  });

  it('muestra "Este turno viene con: …" y el descuento queda vacío y bloqueado', () => {
    renderModal({ turno: { ...turnoBase, beneficio: BENEFICIO_OTRO } });

    expect(screen.getByTestId('beneficio-viene-con').textContent).toBe('Este turno viene con: Ampolla de tratamiento de regalo');
    expect(campoPorcentaje().value).toBe('');
    expect(campoPorcentaje().disabled).toBe(true);
    expect(screen.getByText('El turno viene con un regalo: no se suma un descuento.')).toBeTruthy();
    expect(screen.queryByText('El descuento del código queda aplicado.')).toBeNull();
    // "Cobrar sin el código" sigue estando
    expect(tilde().checked).toBe(false);
  });

  it('manda usar_beneficio:true sin descuento', async () => {
    renderModal({ turno: { ...turnoBase, beneficio: BENEFICIO_OTRO } });
    await cobrarEnEfectivo();

    await waitFor(() => expect(finalizarTurno).toHaveBeenCalledTimes(1));
    const [, payload] = finalizarTurno.mock.calls[0];
    expect(payload).toMatchObject({ metodoPago: 'efectivo', usar_beneficio: true });
    expect(payload.descuentoPorcentaje).toBeUndefined();
  });

  it('"Cobrar sin el código" desbloquea el descuento: se carga a mano y viaja con usar_beneficio:false', async () => {
    renderModal({ turno: { ...turnoBase, beneficio: BENEFICIO_OTRO } });
    fireEvent.click(tilde());

    expect(campoPorcentaje().disabled).toBe(false);
    expect(screen.queryByTestId('beneficio-viene-con')).toBeNull();
    fireEvent.change(campoPorcentaje(), { target: { value: '10' } });
    await cobrarEnEfectivo();

    await waitFor(() => expect(finalizarTurno).toHaveBeenCalledTimes(1));
    expect(finalizarTurno.mock.calls[0][1]).toMatchObject({ descuentoPorcentaje: 10, usar_beneficio: false });
  });

  it('volver a usar el regalo vacía el descuento que se había cargado', () => {
    renderModal({ turno: { ...turnoBase, beneficio: BENEFICIO_OTRO } });
    fireEvent.click(tilde());
    fireEvent.change(campoPorcentaje(), { target: { value: '10' } });
    fireEvent.click(tilde());

    expect(campoPorcentaje().value).toBe('');
    expect(campoPorcentaje().disabled).toBe(true);
  });

  it('en modo editar el descuento que tenía el turno se vacía: con el regalo no se acumula', () => {
    renderModal({ mode: 'editar', turno: { ...turnoBase, estado: 'completado', metodo_pago: 'efectivo', descuento_porcentaje: 5, beneficio: { ...BENEFICIO_OTRO, estado: 'usado' } } });
    expect(campoPorcentaje().value).toBe('');
    expect(campoPorcentaje().disabled).toBe(true);
  });
});
