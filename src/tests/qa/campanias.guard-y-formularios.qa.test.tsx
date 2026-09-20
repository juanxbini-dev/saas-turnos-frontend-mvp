// QA L10, L5 y L9 (backend/docs/campanias-n8n-casos-qa.md)
import React from 'react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------- mocks
let roles: string[] = ['staff'];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles, empresa: 'deb' }, isLoading: false } }),
}));

// El router REAL con las páginas reemplazadas por carteles: lo que se prueba es qué guard
// envuelve a /campanias en AppRouter.tsx, no las páginas.
// vi.mock se iza al tope del archivo: el helper tiene que izarse con él
const cartel = vi.hoisted(() => (texto: string) => ({ default: () => texto }));
vi.mock('../../pages/LoginPage', () => cartel('PAGINA login'));
vi.mock('../../pages/DashboardPage', () => cartel('PAGINA dashboard'));
vi.mock('../../pages/UsuariosPage', () => cartel('PAGINA usuarios'));
vi.mock('../../pages/ClientesPage', () => cartel('PAGINA clientes'));
vi.mock('../../pages/TurnosPage', () => cartel('PAGINA turnos'));
vi.mock('../../pages/PerfilPage', () => cartel('PAGINA perfil'));
vi.mock('../../pages/ProductosPage', () => cartel('PAGINA productos'));
vi.mock('../../pages/ServiciosPage', () => cartel('PAGINA servicios'));
vi.mock('../../pages/FinanzasPage', () => ({ FinanzasPage: () => 'PAGINA finanzas' }));
vi.mock('../../pages/MetricasPage', () => cartel('PAGINA metricas'));
vi.mock('../../pages/GastosPage', () => cartel('PAGINA gastos'));
vi.mock('../../pages/CampaniasPage', () => cartel('PAGINA campanias'));
vi.mock('../../pages/ConfiguracionPage', () => cartel('PAGINA configuracion'));
vi.mock('../../pages/public/DebSalonLandingPage', () => ({ DebSalonLandingPage: () => 'PAGINA landing' }));
vi.mock('../../components/layout/Layout', () => ({ default: () => <Outlet /> }));
vi.mock('../../components/PrivateRoute', () => ({ PrivateRoute: () => <Outlet /> }));

const updateServicio = vi.fn();
vi.mock('../../services/servicio.service', () => ({
  servicioService: { updateServicio: (...a: unknown[]) => updateServicio(...a), createServicio: vi.fn() },
}));

const createCliente = vi.fn();
const updateCliente = vi.fn();
vi.mock('../../services/cliente.service', () => ({
  clienteService: {
    createCliente: (...a: unknown[]) => createCliente(...a),
    updateCliente: (...a: unknown[]) => updateCliente(...a),
  },
  getClienteDuplicado: () => null,
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() },
}));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import AppRouter from '../../router/AppRouter';
import { EditarServicioModal } from '../../components/servicios/EditarServicioModal';
import { ClienteModal } from '../../components/clientes/ClienteModal';
import type { Servicio } from '../../types/servicio.types';
import type { Cliente } from '../../types/cliente.types';

// ---------------------------------------------------------------- L10
describe('L10 · quién entra a /campanias (US1)', () => {
  const entrarA = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><AppRouter /></MemoryRouter>);

  it.each([[['staff']], [['admin']], [['admin', 'staff']]])('roles %j: escribir la URL a mano lo manda al inicio, no a Campañas', (r) => {
    roles = r;
    entrarA('/campanias');

    expect(screen.queryByText('PAGINA campanias')).toBeNull();
    expect(screen.getByText('PAGINA dashboard')).toBeTruthy();
  });

  it.each([[['super_admin']], [['admin', 'super_admin']]])('roles %j: entra', (r) => {
    roles = r;
    entrarA('/campanias');

    expect(screen.getByText('PAGINA campanias')).toBeTruthy();
  });

  it('testigo: el router de prueba sí navega (un admin entra a Métricas)', () => {
    roles = ['admin'];
    entrarA('/metricas');

    expect(screen.getByText('PAGINA metricas')).toBeTruthy();
  });
});

// ---------------------------------------------------------------- L5
describe('L5 · editar otra cosa de un servicio no le borra la frecuencia', () => {
  const servicio: Servicio = {
    id: 'srv-1', nombre: 'Corte', descripcion: null, duracion: 30, precio_base: 10000,
    precio_minimo: null, precio_maximo: null, frecuencia_dias: 30, empresa_id: 'emp-1', activo: true,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  } as Servicio;

  beforeEach(() => {
    vi.clearAllMocks();
    updateServicio.mockResolvedValue({});
  });

  it('cambiar solo el nombre: la frecuencia viaja igual (30) o no viaja; nunca null', async () => {
    render(<EditarServicioModal servicio={servicio} onClose={vi.fn()} onServicioActualizado={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ej: Corte de cabello'), { target: { value: 'Corte clásico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateServicio).toHaveBeenCalledTimes(1));
    const payload = updateServicio.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nombre).toBe('Corte clásico');
    expect(payload.frecuencia_dias === 30 || !('frecuencia_dias' in payload)).toBe(true);
  });

  it('un servicio SIN frecuencia que se edita sigue sin frecuencia (no aparece un 0 ni un NaN)', async () => {
    render(<EditarServicioModal servicio={{ ...servicio, frecuencia_dias: null }} onClose={vi.fn()} onServicioActualizado={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Ej: Corte de cabello'), { target: { value: 'Corte clásico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateServicio).toHaveBeenCalledTimes(1));
    const payload = updateServicio.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.frecuencia_dias ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------- L9
describe('L9 · tilde de novedades en el alta de cliente', () => {
  const TEXTO = 'Me autorizó a enviarle novedades por WhatsApp';
  const existente = { id: 'cli-1', nombre: 'Ana', email: null, telefono: '11 5555-4444', empresa_id: 'emp-1', activo: true } as unknown as Cliente;

  beforeEach(() => {
    vi.clearAllMocks();
    roles = ['staff'];
    createCliente.mockResolvedValue({});
    updateCliente.mockResolvedValue({});
  });

  it('en el alta aparece SIN tildar, y sin tocarlo no se manda una aceptación', async () => {
    render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    const tilde = screen.getByLabelText(TEXTO) as HTMLInputElement;
    expect(tilde.checked).toBe(false);

    fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Juan Pérez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(createCliente).toHaveBeenCalledTimes(1));
    expect((createCliente.mock.calls[0][0] as Record<string, unknown>).marketing_consentimiento).not.toBe(true);
  });

  it('tildado manda marketing_consentimiento: true', async () => {
    render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Juan Pérez' } });
    fireEvent.click(screen.getByLabelText(TEXTO));
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(createCliente).toHaveBeenCalledTimes(1));
    expect(createCliente.mock.calls[0][0]).toMatchObject({ nombre: 'Juan Pérez', marketing_consentimiento: true });
  });

  it('en la edición no aparece: la preferencia se cambia desde la ficha, con sus permisos', () => {
    render(<ClienteModal cliente={existente} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryByLabelText(TEXTO)).toBeNull();
  });

  it('el tilde no se hereda del alta anterior', async () => {
    const { rerender } = render(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(TEXTO));
    expect((screen.getByLabelText(TEXTO) as HTMLInputElement).checked).toBe(true);

    rerender(<ClienteModal cliente={null} isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />);
    rerender(<ClienteModal cliente={null} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect((screen.getByLabelText(TEXTO) as HTMLInputElement).checked).toBe(false);
  });
});
