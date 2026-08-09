/**
 * Tests del flujo handleDeleteConfirm en ClientesPage.
 *
 * Se testea el comportamiento del handler ante tres escenarios:
 *   1. Éxito: llama a revalidate y cierra el deleteModal
 *   2. Error 409 (turnos activos): cierra deleteModal y abre turnosActivosModal con el mensaje
 *   3. Otro error (ej: 500, red): llama a toast.error con el mensaje descriptivo
 *
 * Estrategia: renderizar ClientesPage completo y disparar la confirmación
 * de eliminación a través de la UI (ConfirmModal). Se mockean todas las
 * dependencias externas para evitar llamadas reales.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { vi } from 'vitest';

// ── Mocks de dependencias ─────────────────────────────────────────────────────

vi.mock('../../services/cliente.service', () => ({
  clienteService: {
    getClientes:   vi.fn(),
    deleteCliente: vi.fn(),
  },
}));

vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    getProfesionales: vi.fn(() => Promise.resolve({ data: { profesionales: [] } })),
  },
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// toastService es lo que llama useToast internamente
vi.mock('../../services/toast.service', () => ({
  toastService: {
    success:    vi.fn(),
    error:      vi.fn(),
    warning:    vi.fn(),
    info:       vi.fn(),
    dismiss:    vi.fn(),
    dismissAll: vi.fn(),
  },
}));

vi.mock('../../cache/key.builder', () => ({
  buildKey: vi.fn(() => 'test-key'),
  ENTITIES: { CLIENTES: 'clientes' },
}));

vi.mock('../../cache/ttl', () => ({
  TTL: { SHORT: 60, MEDIUM: 300, LONG: 1800 },
}));

vi.mock('../../cache/cache.service', () => ({
  cacheService: {
    get:        vi.fn(() => null),
    set:        vi.fn(),
    delete:     vi.fn(),
    clear:      vi.fn(),
    invalidate: vi.fn(),
  },
}));

// ── Imports post-mock ─────────────────────────────────────────────────────────

import ClientesPage from '../../pages/ClientesPage';
import { clienteService } from '../../services/cliente.service';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { toastService } from '../../services/toast.service';

// ── Datos de prueba ───────────────────────────────────────────────────────────

const clienteEjemplo = {
  id:         'cliente-001',
  nombre:     'Ana López',
  email:      'ana@test.com',
  telefono:   '2915000001',
  empresa_id: 'empresa-001',
  activo:     true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Configura los mocks base. revalidateMock puede pasarse para inspeccionarlo.
 */
function setupDefaultMocks(revalidateMock = vi.fn()) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    state: { roles: ['admin'], authUser: null, status: 'authenticated' },
  });

  (useFetch as ReturnType<typeof vi.fn>).mockReturnValue({
    data: {
      items:         [clienteEjemplo],
      total_paginas: 1,
      total:         1,
    },
    loading:    false,
    revalidate: revalidateMock,
  });
}

/**
 * Renderiza ClientesPage, abre el deleteModal haciendo click en el botón
 * "Eliminar" de la tabla (desktop), y retorna el botón de confirmación
 * del ConfirmModal para que el test lo dispare cuando quiera.
 *
 * El Modal de la aplicación no tiene role="dialog" — es un div genérico.
 * El título del ConfirmModal ("Eliminar cliente") aparece en un h3 dentro
 * del panel. Subimos al panel del modal (el div.bg-white.rounded-lg) para
 * acotar el within() y encontrar el botón correcto.
 */
async function abrirModalYObtenerBotonConfirmar() {
  render(<ClientesPage />);

  // Antes de abrir el modal solo hay botones de la tabla.
  // Buscamos el botón "Eliminar" de la fila del cliente (el primero visible).
  const botonesEliminar = await screen.findAllByRole('button', { name: /^eliminar$/i });
  fireEvent.click(botonesEliminar[0]);

  // Esperamos que el ConfirmModal aparezca con su título
  const tituloModal = await screen.findByText('Eliminar cliente');

  // El h3 del título está dentro del header del modal panel.
  // Subimos: h3 → div.header → div.panel (bg-white / rounded-lg)
  // Tomamos el tercer ancestro para cubrir toda la estructura del modal.
  const panelModal = tituloModal.parentElement?.parentElement?.parentElement as HTMLElement;

  // Dentro del panel hay exactamente un botón con texto "Eliminar" (el de confirmar)
  const btnConfirmar = within(panelModal).getByRole('button', { name: /^eliminar$/i });
  return btnConfirmar;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClientesPage — handleDeleteConfirm', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── ÉXITO ─────────────────────────────────────────────────────────────────

  describe('eliminación exitosa', () => {

    it('llama a revalidate después de eliminar correctamente', async () => {
      const revalidateMock = vi.fn();
      setupDefaultMocks(revalidateMock);
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockResolvedValue(undefined);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(revalidateMock).toHaveBeenCalledTimes(1);
      });
    });

    it('cierra el deleteModal después de eliminar correctamente', async () => {
      setupDefaultMocks();
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockResolvedValue(undefined);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        // El título del ConfirmModal desaparece cuando el modal se cierra
        expect(screen.queryByText('Eliminar cliente')).not.toBeInTheDocument();
      });
    });

    it('muestra toast.success con el nombre del cliente eliminado', async () => {
      setupDefaultMocks();
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockResolvedValue(undefined);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.success).toHaveBeenCalledTimes(1);
      });

      const [mensaje] = (toastService.success as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(mensaje).toContain('Ana López');
    });

    it('llama a deleteCliente con el id correcto', async () => {
      setupDefaultMocks();
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockResolvedValue(undefined);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(clienteService.deleteCliente).toHaveBeenCalledWith('cliente-001');
      });
    });

  });

  // ── ERROR 409: TURNOS ACTIVOS ─────────────────────────────────────────────

  describe('error 409 — cliente con turnos activos', () => {

    it('cierra el deleteModal cuando la API retorna 409', async () => {
      setupDefaultMocks();
      const error409 = Object.assign(new Error('Conflict'), {
        response: {
          status: 409,
          data:   { message: 'No se puede eliminar el cliente porque tiene 2 turnos pendientes o confirmados' },
        },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error409);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        // El ConfirmModal de eliminar se cierra
        expect(screen.queryByText('Eliminar cliente')).not.toBeInTheDocument();
      });
    });

    it('abre turnosActivosModal con el mensaje que viene de la API', async () => {
      setupDefaultMocks();
      const mensajeApi = 'No se puede eliminar el cliente porque tiene 2 turnos pendientes o confirmados';
      const error409 = Object.assign(new Error('Conflict'), {
        response: {
          status: 409,
          data:   { message: mensajeApi },
        },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error409);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      // El turnosActivosModal usa el título "No se puede eliminar el cliente"
      await waitFor(() => {
        expect(screen.getByText('No se puede eliminar el cliente')).toBeInTheDocument();
      });

      // El mensaje de la API aparece dentro del modal
      expect(screen.getByText(mensajeApi)).toBeInTheDocument();
    });

    it('usa el mensaje de fallback si error.response.data.message no existe', async () => {
      setupDefaultMocks();
      const error409 = Object.assign(new Error('Conflict'), {
        response: {
          status: 409,
          data:   {},   // sin campo message
        },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error409);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(screen.getByText('No se puede eliminar el cliente')).toBeInTheDocument();
      });

      // Fallback definido en handleDeleteConfirm
      expect(screen.getByText('El cliente tiene turnos activos.')).toBeInTheDocument();
    });

    it('no llama a revalidate cuando la API retorna 409', async () => {
      const revalidateMock = vi.fn();
      setupDefaultMocks(revalidateMock);
      const error409 = Object.assign(new Error('Conflict'), {
        response: { status: 409, data: { message: 'Tiene turnos activos' } },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error409);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(screen.getByText('No se puede eliminar el cliente')).toBeInTheDocument();
      });

      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('no llama a toast.error cuando la API retorna 409', async () => {
      setupDefaultMocks();
      const error409 = Object.assign(new Error('Conflict'), {
        response: { status: 409, data: { message: 'Tiene turnos activos' } },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error409);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(screen.getByText('No se puede eliminar el cliente')).toBeInTheDocument();
      });

      expect(toastService.error).not.toHaveBeenCalled();
    });

  });

  // ── OTRO ERROR (ej: 500, 403, error de red) ───────────────────────────────

  describe('error genérico (no 409)', () => {

    it('llama a toast.error con el mensaje de la respuesta si existe', async () => {
      setupDefaultMocks();
      const error500 = Object.assign(new Error('Internal Server Error'), {
        response: {
          status: 500,
          data:   { message: 'Error interno del servidor' },
        },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error500);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalledTimes(1);
      });

      const [mensaje] = (toastService.error as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(mensaje).toBe('Error interno del servidor');
    });

    it('llama a toast.error con error.message si no hay response.data.message', async () => {
      setupDefaultMocks();
      // Error sin .response — típico de un fallo de red (CORS, timeout, etc.)
      const errorRed = Object.assign(new Error('Network Error'));
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(errorRed);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalledTimes(1);
      });

      const [mensaje] = (toastService.error as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(mensaje).toBe('Network Error');
    });

    it('usa el fallback "Error inesperado" si el error no tiene mensaje alguno', async () => {
      setupDefaultMocks();
      const errorVacio = Object.assign(new Error(), { message: '' });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(errorVacio);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalledTimes(1);
      });

      const [mensaje] = (toastService.error as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(mensaje).toBe('Error inesperado');
    });

    it('no abre turnosActivosModal cuando el error no es 409', async () => {
      setupDefaultMocks();
      const error403 = Object.assign(new Error('Forbidden'), {
        response: { status: 403, data: { message: 'Sin permisos' } },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error403);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalled();
      });

      expect(screen.queryByText('No se puede eliminar el cliente')).not.toBeInTheDocument();
    });

    it('no llama a revalidate cuando hay un error genérico', async () => {
      const revalidateMock = vi.fn();
      setupDefaultMocks(revalidateMock);
      const error500 = Object.assign(new Error('Server Error'), {
        response: { status: 500, data: { message: 'Error interno' } },
      });
      (clienteService.deleteCliente as ReturnType<typeof vi.fn>)
        .mockRejectedValue(error500);

      const btnConfirmar = await abrirModalYObtenerBotonConfirmar();

      await act(async () => {
        fireEvent.click(btnConfirmar);
      });

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalled();
      });

      expect(revalidateMock).not.toHaveBeenCalled();
    });

  });

});
