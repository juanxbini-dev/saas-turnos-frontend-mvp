import React from 'react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// "Para contactar" lo ven staff (recepción comparte el rol con los profesionales), admin y super
// admin (los roles que acepta el backend en /api/avisos); cualquier otro rol no: ni el ítem del
// menú, ni la ruta, ni el pedido del contador. Es una sección propia del menú lateral, no una
// pestaña de Productos.

let roles: string[] = [];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles, empresa: 'deb' }, roles, isLoading: false }, logout: vi.fn() }),
}));

// Con useFetch mockeado, ProductosPage y el Sidebar no piden nada al servidor
vi.mock('../../hooks/useFetch', () => ({
  useFetch: () => ({ data: null, loading: false, error: null, revalidate: vi.fn() }),
}));
vi.mock('../../hooks/useContadorParaRevisar', () => ({
  useContadorParaRevisar: () => ({ pendientes: 0, loading: false, error: null, revalidate: vi.fn() }),
}));

const habilitado = vi.fn();
vi.mock('../../hooks/useContadorParaContactar', () => ({
  useContadorParaContactar: (h: boolean) => {
    habilitado(h);
    return { pendientes: h ? 4 : 0, alta: 0, media: 0, loading: false, error: null, revalidate: vi.fn() };
  },
}));

// La pestaña Ventas (la de siempre para un profesional) pide el resumen al entrar
vi.mock('../../services/productos.service', () => ({
  productosService: { getProductos: vi.fn(), getStats: vi.fn(), getConfiguracion: vi.fn() },
  getResumenVentas: vi.fn(() => Promise.resolve({
    totales: { total_ventas: 0, costo_total: 0, ganancia_bruta: 0, ganancia_profesionales: 0, ganancia_empresa: 0 },
    por_profesional: [],
    por_producto: [],
  })),
  getRegistroVentas: vi.fn(() => Promise.resolve({ rows: [], total: 0 })),
  updateVentaProducto: vi.fn(),
  deleteVentaProducto: vi.fn(),
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));


// El router REAL con las otras páginas reemplazadas por carteles (ProductosPage es la real)
const cartel = vi.hoisted(() => (texto: string) => ({ default: () => texto }));
vi.mock('../../pages/LoginPage', () => cartel('PAGINA login'));
vi.mock('../../pages/DashboardPage', () => cartel('PAGINA dashboard'));
vi.mock('../../pages/UsuariosPage', () => cartel('PAGINA usuarios'));
vi.mock('../../pages/ClientesPage', () => cartel('PAGINA clientes'));
vi.mock('../../pages/TurnosPage', () => cartel('PAGINA turnos'));
vi.mock('../../pages/PerfilPage', () => cartel('PAGINA perfil'));
vi.mock('../../pages/ServiciosPage', () => cartel('PAGINA servicios'));
vi.mock('../../pages/FinanzasPage', () => ({ FinanzasPage: () => 'PAGINA finanzas' }));
vi.mock('../../pages/MetricasPage', () => cartel('PAGINA metricas'));
vi.mock('../../pages/GastosPage', () => cartel('PAGINA gastos'));
vi.mock('../../pages/CampaniasPage', () => cartel('PAGINA campanias'));
vi.mock('../../pages/ConfiguracionPage', () => cartel('PAGINA configuracion'));
vi.mock('../../pages/ParaContactarPage', () => cartel('PAGINA para contactar'));
vi.mock('../../pages/public/DebSalonLandingPage', () => ({ DebSalonLandingPage: () => 'PAGINA landing' }));
vi.mock('../../components/layout/Layout', () => ({ default: () => <Outlet /> }));
vi.mock('../../components/PrivateRoute', () => ({ PrivateRoute: () => <Outlet /> }));

import AppRouter from '../../router/AppRouter';
import Sidebar from '../../components/layout/Sidebar';
import ProductosPage from '../../pages/ProductosPage';
import { puedeVerParaContactar } from '../../services/avisos.service';

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />
  </MemoryRouter>
);

const entrarA = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><AppRouter /></MemoryRouter>);

const linksParaContactar = () => screen.queryAllByRole('link', { name: /Para contactar/ });
const linksProductos = () => screen.queryAllByRole('link', { name: /Productos/ });

beforeEach(() => { vi.clearAllMocks(); roles = []; });
afterEach(() => cleanup());

describe('Para contactar · quién lo ve', () => {
  it('la regla: staff, admin y super admin sí; otro rol no', () => {
    expect(puedeVerParaContactar(['staff'])).toBe(true);
    expect(puedeVerParaContactar(['admin'])).toBe(true);
    expect(puedeVerParaContactar(['super_admin'])).toBe(true);
    expect(puedeVerParaContactar(['otro'])).toBe(false);
    expect(puedeVerParaContactar([])).toBe(false);
    expect(puedeVerParaContactar(undefined)).toBe(false);
  });

  it.each([[['admin']], [['admin', 'super_admin']], [['staff']]])('roles %j: ven el ítem del menú con el contador', (r) => {
    roles = r;
    renderSidebar();
    expect(linksParaContactar().length).toBeGreaterThan(0);
    expect(linksParaContactar()[0].getAttribute('href')).toBe('/para-contactar');
    expect(screen.getAllByTestId('badge-para-contactar')[0].textContent).toBe('4');
    expect(habilitado).toHaveBeenCalledWith(true);
  });

  it('el contador ya no va en el ítem Productos', () => {
    roles = ['admin'];
    renderSidebar();
    expect(linksProductos().length).toBeGreaterThan(0);
    expect(linksProductos()[0].querySelector('[data-testid="badge-para-contactar"]')).toBeNull();
  });

  it('un usuario sin esos roles no ve el ítem y no se pide el contador', () => {
    roles = ['otro'];
    renderSidebar();
    expect(linksParaContactar()).toHaveLength(0);
    expect(screen.queryByTestId('badge-para-contactar')).toBeNull();
    expect(habilitado).not.toHaveBeenCalledWith(true);
  });

  it('un usuario sin permiso que escribe la URL a mano va al inicio', () => {
    roles = ['otro'];
    entrarA('/para-contactar');
    expect(screen.queryByText('PAGINA para contactar')).toBeNull();
    expect(screen.getByText('PAGINA dashboard')).toBeTruthy();
  });

  it.each([[['admin']], [['super_admin']], [['staff']]])('roles %j: entran a la pantalla', (r) => {
    roles = r;
    entrarA('/para-contactar');
    expect(screen.getByText('PAGINA para contactar')).toBeTruthy();
  });
});

describe('Para contactar · ya no es pestaña de Productos', () => {
  it.each([[['admin']], [['staff']]])('roles %j: Productos no tiene la pestaña', (r) => {
    roles = r;
    render(<ProductosPage />);
    expect(screen.getByRole('button', { name: 'Ventas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Para contactar/ })).toBeNull();
  });
});
