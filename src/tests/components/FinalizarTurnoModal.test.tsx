import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { FinalizarTurnoModal } from '../../components/turnos/FinalizarTurnoModal';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/turno.service', () => ({
  turnoService: {
    finalizarTurno: vi.fn(),
    editarPago: vi.fn(),
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

// productos.service lo usa useFetch internamente — mockearlo para evitar imports reales
vi.mock('../../services/productos.service', () => ({
  productosService: {
    getProductos: vi.fn(() => Promise.resolve([])),
  },
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const turnoBase = {
  id: 'turno-1',
  cliente_id: 'cliente-1',
  usuario_id: 'usuario-1',
  servicio_id: 'servicio-1',
  cliente_nombre: 'Juan Perez',
  cliente_email: 'juan@test.com',
  servicio: 'Corte',
  fecha: '2026-05-08',
  hora: '10:00:00',
  precio: 1500,
  estado: 'confirmado' as const,
  metodo_pago: 'pendiente' as const,
  precio_original: undefined,
  descuento_porcentaje: undefined,
  duracion_minutos: 30,
  empresa_id: 'empresa-1',
  created_at: '2026-05-08T00:00:00Z',
  updated_at: '2026-05-08T00:00:00Z',
  notas: null,
  usuario_nombre: 'Profesional',
  usuario_username: 'profesional',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  turno: turnoBase,
  mode: 'finalizar' as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FinalizarTurnoModal', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-establecer implementación por defecto del axiosInstance mock después del clearAllMocks
    const axiosMod = await import('../../api/axiosInstance');
    const axiosMock = axiosMod.default as unknown as { get: ReturnType<typeof vi.fn> };
    axiosMock.get.mockResolvedValue({ data: { data: [] } });

    // Evitar que alert() cause errores en jsdom
    vi.stubGlobal('alert', vi.fn());
  });

  // ─── Visibilidad ────────────────────────────────────────────────────────────

  describe('visibilidad', () => {
    it('no renderiza nada cuando isOpen es false', () => {
      const { container } = render(
        <FinalizarTurnoModal {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renderiza el modal cuando isOpen es true', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      // El Modal renderiza el título en un h3
      expect(screen.getByText('Finalizar Turno')).toBeInTheDocument();
    });

    it('muestra el nombre del cliente', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });

    it('muestra el nombre del servicio', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('Corte')).toBeInTheDocument();
    });
  });

  // ─── Modo editar ────────────────────────────────────────────────────────────

  describe('modo editar', () => {
    it('muestra el título "Editar Pago del Turno" cuando mode es editar', () => {
      render(<FinalizarTurnoModal {...defaultProps} mode="editar" />);
      expect(screen.getByText('Editar Pago del Turno')).toBeInTheDocument();
    });

    it('no muestra el título "Finalizar Turno" en modo editar', () => {
      render(<FinalizarTurnoModal {...defaultProps} mode="editar" />);
      expect(screen.queryByText('Finalizar Turno')).not.toBeInTheDocument();
    });
  });

  // ─── Botones de método de pago ───────────────────────────────────────────────

  describe('botones de método de pago', () => {
    it('muestra el botón de efectivo', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('efectivo')).toBeInTheDocument();
    });

    it('muestra el botón de transferencia', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('transferencia')).toBeInTheDocument();
    });

    it('muestra el botón de pendiente', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('pendiente')).toBeInTheDocument();
    });

    it('al hacer click en efectivo, ese botón recibe la clase de activo (border-blue-500)', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      const btnEfectivo = screen.getByText('efectivo').closest('button')!;

      fireEvent.click(btnEfectivo);

      expect(btnEfectivo.className).toContain('border-blue-500');
    });

    it('al hacer click en transferencia, ese botón recibe la clase de activo', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      const btnTransferencia = screen.getByText('transferencia').closest('button')!;

      fireEvent.click(btnTransferencia);

      expect(btnTransferencia.className).toContain('border-blue-500');
    });

    it('al hacer click en efectivo, el botón de pendiente pierde la clase activa', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      const btnEfectivo = screen.getByText('efectivo').closest('button')!;
      const btnPendiente = screen.getByText('pendiente').closest('button')!;

      fireEvent.click(btnEfectivo);

      expect(btnPendiente.className).not.toContain('border-blue-500');
    });
  });

  // ─── Resumen de precios ─────────────────────────────────────────────────────

  describe('resumen de precios', () => {
    it('muestra la sección "Resumen" cuando el precio del turno es mayor a 0', () => {
      // turnoBase.precio = 1500 > 0, sin precioModificado, calculo no es null
      render(<FinalizarTurnoModal {...defaultProps} />);
      expect(screen.getByText('Resumen')).toBeInTheDocument();
    });

    it('no muestra el resumen si el precio es 0 (subtotal ≤ 0)', () => {
      const turnoSinPrecio = { ...turnoBase, precio: 0 };
      render(<FinalizarTurnoModal {...defaultProps} turno={turnoSinPrecio} />);
      expect(screen.queryByText('Resumen')).not.toBeInTheDocument();
    });
  });

  // ─── Botón Cancelar ─────────────────────────────────────────────────────────

  describe('botón Cancelar', () => {
    it('llama a onClose cuando se hace click en el botón Cancelar de los botones de acción', () => {
      const onClose = vi.fn();
      render(<FinalizarTurnoModal {...defaultProps} onClose={onClose} />);

      // Hay exactamente un botón "Cancelar" en la barra de acciones (showAgregarProductos=false)
      const btnCancelar = screen.getByText('Cancelar');
      fireEvent.click(btnCancelar);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Botón Guardar / estado disabled ────────────────────────────────────────

  describe('botón guardar', () => {
    it('el botón de acción principal está habilitado cuando hay metodoPago (estado inicial: pendiente)', () => {
      render(<FinalizarTurnoModal {...defaultProps} />);
      // El estado inicial es 'pendiente', metodoPago es truthy → !metodoPago es false → no disabled
      const botonPrincipal = screen.getByText('Guardar como pendiente');
      expect(botonPrincipal.closest('button')).not.toBeDisabled();
    });
  });

  // ─── Submit modo finalizar ──────────────────────────────────────────────────

  describe('submit modo finalizar', () => {
    it('llama a turnoService.finalizarTurno con el id del turno al hacer submit', async () => {
      const { turnoService } = await import('../../services/turno.service');
      const finalizarMock = turnoService.finalizarTurno as ReturnType<typeof vi.fn>;
      finalizarMock.mockResolvedValueOnce({ id: 'turno-1', estado: 'completado' });

      render(<FinalizarTurnoModal {...defaultProps} />);

      // Seleccionar efectivo — el label del botón de submit cambia a "Finalizar Turno"
      fireEvent.click(screen.getByText('efectivo').closest('button')!);

      // Hay dos elementos con ese texto: el h3 del título y el botón.
      // Buscamos el botón de submit por role.
      const botonesFinalizarTurno = screen.getAllByText('Finalizar Turno');
      const botonSubmit = botonesFinalizarTurno.find(
        (el) => el.closest('button') && el.closest('button')!.getAttribute('disabled') === null
      )!;

      await act(async () => {
        fireEvent.click(botonSubmit);
      });

      await waitFor(() => {
        expect(finalizarMock).toHaveBeenCalledTimes(1);
      });

      const [idLlamado] = finalizarMock.mock.calls[0] as [string, unknown];
      expect(idLlamado).toBe('turno-1');
    });

    it('llama a finalizarTurno con metodoPago efectivo en el payload', async () => {
      const { turnoService } = await import('../../services/turno.service');
      const finalizarMock = turnoService.finalizarTurno as ReturnType<typeof vi.fn>;
      finalizarMock.mockResolvedValueOnce({ id: 'turno-1', estado: 'completado' });

      render(<FinalizarTurnoModal {...defaultProps} />);

      fireEvent.click(screen.getByText('efectivo').closest('button')!);

      const botonesFinalizarTurno = screen.getAllByText('Finalizar Turno');
      const botonSubmit = botonesFinalizarTurno.find(
        (el) => el.closest('button') && el.closest('button')!.getAttribute('disabled') === null
      )!;

      await act(async () => {
        fireEvent.click(botonSubmit);
      });

      await waitFor(() => {
        expect(finalizarMock).toHaveBeenCalled();
      });

      const [, payload] = finalizarMock.mock.calls[0] as [string, { metodoPago: string }];
      expect(payload.metodoPago).toBe('efectivo');
    });

    it('llama a onSuccess después de un submit exitoso en modo finalizar', async () => {
      const onSuccess = vi.fn();
      const { turnoService } = await import('../../services/turno.service');
      const finalizarMock = turnoService.finalizarTurno as ReturnType<typeof vi.fn>;
      finalizarMock.mockResolvedValueOnce({ id: 'turno-1', estado: 'completado' });

      render(<FinalizarTurnoModal {...defaultProps} onSuccess={onSuccess} />);

      fireEvent.click(screen.getByText('efectivo').closest('button')!);

      const botonesFinalizarTurno = screen.getAllByText('Finalizar Turno');
      const botonSubmit = botonesFinalizarTurno.find(
        (el) => el.closest('button') && el.closest('button')!.getAttribute('disabled') === null
      )!;

      await act(async () => {
        fireEvent.click(botonSubmit);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── Submit modo editar ─────────────────────────────────────────────────────

  describe('submit modo editar', () => {
    it('llama a turnoService.editarPago en modo editar', async () => {
      const { turnoService } = await import('../../services/turno.service');
      const editarMock = turnoService.editarPago as ReturnType<typeof vi.fn>;
      editarMock.mockResolvedValueOnce({ id: 'turno-1' });

      render(<FinalizarTurnoModal {...defaultProps} mode="editar" />);

      // En modo editar el botón dice "Guardar cambios"
      await act(async () => {
        fireEvent.click(screen.getByText('Guardar cambios'));
      });

      await waitFor(() => {
        expect(editarMock).toHaveBeenCalledTimes(1);
      });
    });

    it('NO llama a finalizarTurno en modo editar', async () => {
      const { turnoService } = await import('../../services/turno.service');
      const finalizarMock = turnoService.finalizarTurno as ReturnType<typeof vi.fn>;
      const editarMock = turnoService.editarPago as ReturnType<typeof vi.fn>;
      editarMock.mockResolvedValueOnce({ id: 'turno-1' });

      render(<FinalizarTurnoModal {...defaultProps} mode="editar" />);

      await act(async () => {
        fireEvent.click(screen.getByText('Guardar cambios'));
      });

      await waitFor(() => {
        expect(editarMock).toHaveBeenCalled();
      });

      expect(finalizarMock).not.toHaveBeenCalled();
    });

    it('llama a onSuccess después de un submit exitoso en modo editar', async () => {
      const onSuccess = vi.fn();
      const { turnoService } = await import('../../services/turno.service');
      const editarMock = turnoService.editarPago as ReturnType<typeof vi.fn>;
      editarMock.mockResolvedValueOnce({ id: 'turno-1' });

      render(<FinalizarTurnoModal {...defaultProps} mode="editar" onSuccess={onSuccess} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Guardar cambios'));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });
});
