import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, beforeEach, describe, expect, it } from 'vitest';
import { EdicionesPendientes } from '../../components/clientes/EdicionesPendientes';
import { clienteService } from '../../services/cliente.service';
import { toastService } from '../../services/toast.service';
import { EdicionPendiente } from '../../types/cliente.types';

vi.mock('../../services/cliente.service', () => ({
  clienteService: { getEdicionesPendientes: vi.fn(), resolverEdicion: vi.fn() },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const cambio = (extra: Record<string, unknown> = {}) => ({
  id: 'c-mail', turno_id: 'tur-1', campo: 'email', valor_anterior: 'vieja@x.com', valor_nuevo: 'nueva@x.com',
  estado: 'pendiente', motivo_no_aplicado: null, origen: 'reserva_web', creado_at: '2026-11-05T15:00:00.000Z', ...extra,
});

const ana = (cambios = [cambio()]) => ({
  cliente: { id: 'ana', nombre: 'Ana Gómez', email: 'vieja@x.com', telefono: '2915134540' },
  cambios,
}) as unknown as EdicionPendiente;

const armar = (ediciones: EdicionPendiente[]) => {
  vi.mocked(clienteService.getEdicionesPendientes).mockResolvedValue(ediciones);
  const onResuelto = vi.fn();
  render(<EdicionesPendientes onResuelto={onResuelto} />);
  return { onResuelto };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clienteService.resolverEdicion).mockResolvedValue({ aplicados: ['email'], rechazados: [], no_aplicados: [] });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('EdicionesPendientes', () => {
  it('sin pedidos no muestra nada', async () => {
    const { } = armar([]);

    await waitFor(() => expect(clienteService.getEdicionesPendientes).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Pedidos de cambio de datos' })).toBeNull();
  });

  it('muestra el aviso con lo que tiene la ficha y lo que se pidió', async () => {
    armar([ana()]);

    const aviso = await screen.findByRole('region', { name: 'Pedidos de cambio de datos' });
    expect(within(aviso).getByText('Un cliente pidió cambiar sus datos')).toBeTruthy();
    expect(within(aviso).getByText('Ana Gómez')).toBeTruthy();
    expect(within(aviso).getByText(/vieja@x.com/)).toBeTruthy();
    expect(within(aviso).getByText('nueva@x.com')).toBeTruthy();
  });

  it('cuenta los clientes, no los datos', async () => {
    const otra = { ...ana(), cliente: { id: 'sol', nombre: 'Sol Díaz', email: null, telefono: null } };
    armar([ana([cambio(), cambio({ id: 'c-nombre', campo: 'nombre', valor_nuevo: 'Ana María' })]), otra]);

    expect(await screen.findByText('2 clientes pidieron cambiar sus datos')).toBeTruthy();
  });

  it('Aprobar manda exactamente los pedidos que se ven y avisa', async () => {
    vi.mocked(clienteService.getEdicionesPendientes).mockResolvedValueOnce([ana([cambio(), cambio({ id: 'c-nombre', campo: 'nombre' })])]);
    const { onResuelto } = armar([]);
    vi.mocked(clienteService.getEdicionesPendientes).mockResolvedValue([]);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));

    await waitFor(() => expect(clienteService.resolverEdicion).toHaveBeenCalledWith('ana', 'aprobar', ['c-mail', 'c-nombre']));
    await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('Datos de Ana Gómez actualizados', undefined));
    expect(onResuelto).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull());
  });

  it('Rechazar avisa que la ficha queda como estaba', async () => {
    armar([ana()]);
    vi.mocked(clienteService.resolverEdicion).mockResolvedValue({ aplicados: [], rechazados: ['email'], no_aplicados: [] });

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));

    await waitFor(() => expect(clienteService.resolverEdicion).toHaveBeenCalledWith('ana', 'rechazar', ['c-mail']));
    await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('Pedido rechazado: la ficha de Ana Gómez queda como estaba', undefined));
  });

  it('si el mail ya es de otra ficha lo dice, y no festeja', async () => {
    armar([ana()]);
    vi.mocked(clienteService.resolverEdicion).mockResolvedValue({
      aplicados: [], rechazados: [], no_aplicados: [{ campo: 'email', motivo: 'email_de_otra_ficha' }],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));

    await waitFor(() => expect(toastService.warning).toHaveBeenCalledWith('El mail no se cambió: ya lo tiene otra ficha.', undefined));
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('si otro ya lo resolvió, muestra el mensaje y vuelve a pedir la lista', async () => {
    armar([ana()]);
    vi.mocked(clienteService.resolverEdicion).mockRejectedValue({ response: { data: { message: 'Ese pedido ya se resolvió' } } });

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Ese pedido ya se resolvió', undefined));
    await waitFor(() => expect(clienteService.getEdicionesPendientes).toHaveBeenCalledTimes(2));
  });
});
