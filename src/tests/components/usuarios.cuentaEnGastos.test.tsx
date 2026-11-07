import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CuentaEnGastosCampo } from '../../components/usuarios/CuentaEnGastosCampo';
import { CuentaEnGastosModal, opcionesMeses } from '../../components/usuarios/CuentaEnGastosModal';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import type { GastosUsuarioCuenta } from '../../types/gastos.types';
import type { Usuario } from '../../types/usuario.types';

// Campo "Cuenta en Gastos" de la pantalla de Usuarios (backend/docs/gastos-ingresos-plan.md P4):
// solo para el super admin, sin la contraseña de la sección Gastos.

let roles: string[] = [];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u-admin', roles, empresa: 'deb' }, roles, isLoading: false }, logout: vi.fn() }),
}));

vi.mock('../../api/axiosInstance', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const getUsuarios = vi.fn();
vi.mock('../../services/usuario.service', () => ({
  usuarioService: { getUsuarios: (...a: unknown[]) => getUsuarios(...a) },
}));

const getUsuariosCuenta = vi.fn();
const cambiarCuentaUsuario = vi.fn();
vi.mock('../../services/gastos.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/gastos.service')>();
  return {
    ...real,
    gastosService: {
      ...real.gastosService,
      getUsuariosCuenta: (...a: unknown[]) => getUsuariosCuenta(...a),
      cambiarCuentaUsuario: (...a: unknown[]) => cambiarCuentaUsuario(...a),
    },
  };
});

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const DANI: GastosUsuarioCuenta = {
  usuario_id: 'u-dani', nombre: 'Dani', cuenta_este_mes: false,
  tramos: [{ id: 't1', cuenta: false, periodo_desde: null, periodo_hasta: null, created_at: '2026-11-07T00:00:00Z' }],
};
const JULI: GastosUsuarioCuenta = { usuario_id: 'u-juli', nombre: 'Juli', cuenta_este_mes: true, tramos: [] };

beforeEach(() => {
  vi.clearAllMocks();
  cacheService.invalidateByPrefix(buildKey('usuarios'));
  cacheService.invalidateByPrefix(buildKey('gastos'));
});

afterEach(() => cleanup());

// ================================================================ Campo

describe('CuentaEnGastosCampo', () => {
  it('muestra si cuenta este mes y el resumen del último tramo; el historial va en el tooltip', () => {
    render(<CuentaEnGastosCampo item={DANI} onCambiar={vi.fn()} />);

    const sw = screen.getByRole('switch', { name: 'Cuenta en Gastos: Dani' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveTextContent('No cuenta');
    expect(screen.getByTestId('cuenta-gastos-resumen')).toHaveTextContent('No cuenta desde siempre');
    expect(screen.getByTestId('cuenta-gastos-u-dani').getAttribute('title')).toContain('Último cambio: No cuenta desde siempre');
  });

  it('sin tramos: cuenta en todos los meses', () => {
    render(<CuentaEnGastosCampo item={JULI} onCambiar={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('cuenta-gastos-resumen')).toHaveTextContent('Cuenta en todos los meses');
  });

  it('tocarlo no cambia nada: avisa para abrir el modal', () => {
    const onCambiar = vi.fn();
    render(<CuentaEnGastosCampo item={JULI} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onCambiar).toHaveBeenCalledWith(JULI);
    expect(cambiarCuentaUsuario).not.toHaveBeenCalled();
  });
});

// ================================================================ Modal

describe('CuentaEnGastosModal', () => {
  const renderModal = (item = JULI, onConfirmar = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) => {
    render(<CuentaEnGastosModal isOpen onClose={onClose} item={item} periodoActual="2026-11" onConfirmar={onConfirmar} />);
    return { onConfirmar, onClose };
  };
  const mes = () => screen.getByText('Mes').parentElement!.querySelector('select') as HTMLSelectElement;

  it('por defecto: "Desde [mes actual] en adelante", con el valor contrario al de este mes', async () => {
    const { onConfirmar, onClose } = renderModal();

    expect(screen.getByText('Juli deja de contar en Gastos')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Desde noviembre 2026 en adelante' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Solo en noviembre 2026' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Todos los meses (también los anteriores)' })).not.toBeChecked();
    expect(mes().value).toBe('2026-11');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith(false, 'desde', '2026-11'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('"Solo en" con otro mes: las etiquetas siguen al mes elegido', async () => {
    const { onConfirmar } = renderModal(DANI);
    expect(screen.getByText('Dani vuelve a contar en Gastos')).toBeInTheDocument();

    fireEvent.change(mes(), { target: { value: '2026-10' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Solo en octubre 2026' }));
    expect(screen.getByTestId('cuenta-gastos-explicacion')).toHaveTextContent(/^Solo en octubre 2026/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith(true, 'solo', '2026-10'));
  });

  it('"Todos los meses" esconde el selector de mes', async () => {
    const { onConfirmar } = renderModal();
    fireEvent.click(screen.getByRole('radio', { name: 'Todos los meses (también los anteriores)' }));

    expect(screen.queryByText('Mes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith(false, 'siempre', '2026-11'));
  });

  it('si falla, muestra el mensaje del backend y queda abierto', async () => {
    const onConfirmar = vi.fn().mockRejectedValue({ response: { data: { message: 'Usuario no encontrado' } } });
    const { onClose } = renderModal(JULI, onConfirmar);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no encontrado');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('los meses elegibles van de un año adelante a dos atrás, con el actual incluido', () => {
    const ms = opcionesMeses('2026-11');
    expect(ms[0]).toEqual({ value: '2027-11', label: 'Noviembre 2027' });
    expect(ms[ms.length - 1]!.value).toBe('2024-11');
    expect(ms.some((m) => m.value === '2026-11')).toBe(true);
  });
});

// ============================================================ Página

const usuario = (id: string, nombre: string, rol: Usuario['roles'][number] = 'staff'): Usuario => ({
  id, email: '', nombre, username: nombre.toLowerCase(), empresa_id: 'e', roles: [rol], activo: true,
  last_login: null, created_at: '2026-01-01', updated_at: '2026-01-01',
});

describe('UsuariosPage', () => {
  // Import diferido: los mocks de arriba tienen que estar puestos antes
  const renderPagina = async () => {
    const { default: UsuariosPage } = await import('../../pages/UsuariosPage');
    return render(<MemoryRouter><UsuariosPage /></MemoryRouter>);
  };

  beforeEach(() => {
    getUsuarios.mockResolvedValue([usuario('u-dani', 'Dani', 'super_admin'), usuario('u-juli', 'Juli')]);
    getUsuariosCuenta.mockResolvedValue({ periodo_actual: '2026-11', usuarios: [DANI, JULI] });
    cambiarCuentaUsuario.mockResolvedValue({ ...JULI, cuenta_este_mes: false });
  });

  it('admin y staff no ven nada nuevo ni se pide nada', async () => {
    roles = ['admin'];
    await renderPagina();

    expect((await screen.findAllByText('Juli')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Cuenta en Gastos')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(getUsuariosCuenta).not.toHaveBeenCalled();
  });

  it('el super admin ve el campo por usuario y, al confirmar el modal, se guarda y se recarga', async () => {
    roles = ['super_admin'];
    await renderPagina();

    // Tabla (escritorio) y lista (celular) se renderizan las dos en jsdom
    const switchesJuli = await screen.findAllByRole('switch', { name: 'Cuenta en Gastos: Juli' });
    expect(switchesJuli[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('switch', { name: 'Cuenta en Gastos: Dani' })[0]).toHaveAttribute('aria-checked', 'false');
    expect(getUsuariosCuenta).toHaveBeenCalledTimes(1);

    fireEvent.click(switchesJuli[0]!);
    await screen.findByTestId('cuenta-gastos-modal');
    expect(screen.getByText('Juli deja de contar en Gastos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(cambiarCuentaUsuario).toHaveBeenCalledWith('u-juli', false, 'desde', '2026-11'));
    await waitFor(() => expect(getUsuariosCuenta).toHaveBeenCalledTimes(2));
  });

  it('si no carga quién cuenta, avisa con "Reintentar" sin romper la pantalla', async () => {
    roles = ['super_admin'];
    getUsuariosCuenta.mockRejectedValueOnce(new Error('403'));
    await renderPagina();

    expect(await screen.findByText('No se pudo cargar quién cuenta en Gastos.')).toBeInTheDocument();
    expect(screen.getAllByText('Juli').length).toBeGreaterThan(0);
  });
});
