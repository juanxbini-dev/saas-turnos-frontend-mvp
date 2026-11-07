import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, expect, it } from 'vitest';
import { UnificacionesRealizadas } from '../../components/clientes/UnificacionesRealizadas';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { UnificacionActiva } from '../../types/clienteDuplicados.types';

vi.mock('../../services/clienteDuplicados.service', () => ({
  clienteDuplicadosService: {
    listar: vi.fn(),
    listarUnificaciones: vi.fn(),
    revisar: vi.fn(),
    unificar: vi.fn(),
    deshacer: vi.fn(),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const unificacion: UnificacionActiva = {
  id: 'u-1',
  principal_id: 'a1',
  principal_nombre: 'Agus Perez',
  unificada_id: 'b2',
  alias_telefono: '2915705422',
  alias_email: 'agus2@x.com',
  creado_at: '2026-11-05T12:00:00.000Z',
  usuario_nombre: 'Juan',
};

describe('UnificacionesRealizadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la pestaña con las unificaciones activas', async () => {
    vi.mocked(clienteDuplicadosService.listarUnificaciones).mockResolvedValue([unificacion]);
    render(<UnificacionesRealizadas />);
    expect(await screen.findByText(/absorbió una ficha con teléfono/)).toBeInTheDocument();
    expect(screen.getByText('Agus Perez')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando no hay unificaciones', async () => {
    vi.mocked(clienteDuplicadosService.listarUnificaciones).mockResolvedValue([]);
    render(<UnificacionesRealizadas />);
    expect(await screen.findByText('Todavía no hay unificaciones.')).toBeInTheDocument();
  });

  it('Deshacer pide confirmación antes de devolver los turnos', async () => {
    vi.mocked(clienteDuplicadosService.listarUnificaciones).mockResolvedValue([unificacion]);
    vi.mocked(clienteDuplicadosService.deshacer).mockResolvedValue(undefined);
    render(<UnificacionesRealizadas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText(/Se devuelven a su ficha original los turnos y ventas/)).toBeInTheDocument();
    expect(clienteDuplicadosService.deshacer).not.toHaveBeenCalled();

    // Dos botones "Deshacer": el de la fila y el de confirmar. El de confirmar es el último en el DOM
    const botones = screen.getAllByRole('button', { name: 'Deshacer' });
    fireEvent.click(botones[botones.length - 1]);
    await waitFor(() => expect(clienteDuplicadosService.deshacer).toHaveBeenCalledWith('u-1'));
  });
});
