// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClienteModal } from '../../components/clientes/ClienteModal';
import { clienteService } from '../../services/cliente.service';
import { Cliente } from '../../types/cliente.types';

// El aviso de ficha repetida dentro del formulario real (docs/clientes-duplicados-plan.md, backend)

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles: ['admin'], empresa: 'deb' }, isLoading: false } }),
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() },
}));

const existente = { id: 'c1', nombre: 'Marta Gómez', email: null, telefono: '2914227745', empresa_id: 'e1', activo: true } as unknown as Cliente;

const errorDuplicado = (permite: boolean) => ({
  response: { data: { message: 'Ese teléfono ya está cargado', cliente: existente, motivo: 'telefono_otro_nombre', permite_crear_igual: permite } },
});

describe('ClienteModal · aviso de ficha repetida', () => {
  const createCliente = vi.spyOn(clienteService, 'createCliente');
  const updateCliente = vi.spyOn(clienteService, 'updateCliente');

  beforeEach(() => {
    createCliente.mockReset();
    updateCliente.mockReset();
  });

  afterEach(() => vi.clearAllMocks());

  const cargarYCrear = () => {
    fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Sofía Gómez' } });
    fireEvent.change(screen.getByPlaceholderText('email@ejemplo.com'), { target: { value: 'sofia@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
  };

  it('"crear igual" reenvía la misma ficha avisando que es otra persona', async () => {
    createCliente.mockRejectedValueOnce(errorDuplicado(true)).mockResolvedValueOnce(existente);
    const onSuccess = vi.fn();
    render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={onSuccess} />);

    cargarYCrear();
    fireEvent.click(await screen.findByRole('button', { name: 'Es otra persona, crear igual' }));

    await waitFor(() => expect(createCliente).toHaveBeenCalledTimes(2));
    expect(createCliente.mock.calls[0][0].es_otra_persona).toBeUndefined();
    expect(createCliente.mock.calls[1][0]).toMatchObject({ nombre: 'Sofía Gómez', es_otra_persona: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByText('Ese teléfono ya está cargado')).toBeNull();
  });

  it('si no se permite, no ofrece crear igual', async () => {
    createCliente.mockRejectedValueOnce(errorDuplicado(false));
    render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    cargarYCrear();

    await screen.findByRole('button', { name: 'Entendido' });
    expect(screen.queryByRole('button', { name: /crear igual/ })).toBeNull();
  });

  it('en la edición dice "guardar igual" y reenvía por updateCliente', async () => {
    updateCliente.mockRejectedValueOnce(errorDuplicado(true)).mockResolvedValueOnce(existente);
    render(<ClienteModal cliente={{ ...existente, id: 'c2', nombre: 'Sofía Gómez' }} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Es otra persona, guardar igual' }));

    await waitFor(() => expect(updateCliente).toHaveBeenCalledTimes(2));
    expect(updateCliente.mock.calls[1][1]).toMatchObject({ es_otra_persona: true });
  });

  it('Escape con el aviso abierto no cierra el formulario de abajo', async () => {
    createCliente.mockRejectedValueOnce(errorDuplicado(true));
    const onClose = vi.fn();
    render(<ClienteModal cliente={null} isOpen onClose={onClose} onSuccess={vi.fn()} />);

    cargarYCrear();
    await screen.findByRole('button', { name: /crear igual/ });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  describe('mail obligatorio', () => {
    it.each([['', 'vacío'], ['nadie', 'inválido']])('un alta con mail %s no se envía (%s)', async (email) => {
      render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Sofía Gómez' } });
      fireEvent.change(screen.getByPlaceholderText('email@ejemplo.com'), { target: { value: email } });
      fireEvent.submit(screen.getByRole('button', { name: 'Crear' }).closest('form')!);

      await waitFor(() => expect(createCliente).not.toHaveBeenCalled());
    });

    it('una ficha vieja sin mail se puede editar sin agregarlo', async () => {
      updateCliente.mockResolvedValueOnce(existente);
      render(<ClienteModal cliente={{ ...existente, id: 'c2' }} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

      await waitFor(() => expect(updateCliente).toHaveBeenCalledTimes(1));
    });

    it('a una ficha con mail no se le puede vaciar', async () => {
      render(<ClienteModal cliente={{ ...existente, id: 'c2', email: 'ana@x.com' }} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.change(screen.getByDisplayValue('ana@x.com'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

      await waitFor(() => expect(updateCliente).not.toHaveBeenCalled());
    });
  });

  it('al reabrir para otra alta el formulario viene vacío', () => {
    const props = { cliente: null, onClose: vi.fn(), onSuccess: vi.fn() };
    const { rerender } = render(<ClienteModal {...props} isOpen />);
    fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Ana Gómez' } });

    rerender(<ClienteModal {...props} isOpen={false} />);
    rerender(<ClienteModal {...props} isOpen />);

    expect((screen.getByPlaceholderText('Nombre del cliente') as HTMLInputElement).value).toBe('');
  });
});
