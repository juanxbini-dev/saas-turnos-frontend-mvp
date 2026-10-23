import React from 'react';
import { BrowserRouter, MemoryRouter, Outlet } from 'react-router-dom';
import { render, screen, cleanup, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// "Para contactar" lo ven staff (recepción comparte el rol con los profesionales), admin y super
// admin (los roles que acepta el backend en /api/avisos); cualquier otro rol no: ni la pestaña en
// Productos, ni el contador en el menú, ni el pedido del contador. Vive como pestaña de Productos (no como sección propia) y los
// links viejos a /para-contactar siguen andando.

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

// El contenido de la pestaña se prueba en ParaContactarTab: acá solo importa que aparezca
vi.mock('../../components/paraContactar/ParaContactarTab', () => ({
  ParaContactarTab: () => 'CONTENIDO para contactar',
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

// ProductosPage lee ?tab= de window.location (no del router): se usa el historial real del
// navegador, así el redirect de /para-contactar deja la URL que la página va a leer.
const entrarA = (ruta: string) => {
  window.history.pushState({}, '', ruta);
  return render(<BrowserRouter><AppRouter /></BrowserRouter>);
};

const linksProductos = () => screen.queryAllByRole('link', { name: /Productos/ });
const tabParaContactar = () => screen.queryByRole('button', { name: /Para contactar/ });
const tabVentas = () => screen.getByRole('button', { name: 'Ventas' });

beforeEach(() => { vi.clearAllMocks(); roles = []; });
afterEach(() => { cleanup(); window.history.pushState({}, '', '/'); });

describe('Para contactar · quién lo ve', () => {
  it('la regla: staff, admin y super admin sí; otro rol no', () => {
    expect(puedeVerParaContactar(['staff'])).toBe(true);
    expect(puedeVerParaContactar(['admin'])).toBe(true);
    expect(puedeVerParaContactar(['super_admin'])).toBe(true);
    expect(puedeVerParaContactar(['otro'])).toBe(false);
    expect(puedeVerParaContactar([])).toBe(false);
    expect(puedeVerParaContactar(undefined)).toBe(false);
  });

  it.each([[['admin']], [['admin', 'super_admin']], [['staff']]])('roles %j: el contador va en el ítem Productos del menú', (r) => {
    roles = r;
    renderSidebar();
    expect(screen.queryAllByRole('link', { name: /Para contactar/ })).toHaveLength(0);
    expect(linksProductos().length).toBeGreaterThan(0);
    expect(linksProductos()[0].getAttribute('href')).toBe('/productos');
    const badge = within(linksProductos()[0]).getByTestId('badge-para-contactar');
    expect(badge.textContent).toBe('4');
    expect(habilitado).toHaveBeenCalledWith(true);
  });

  it('un usuario sin esos roles ve Productos sin el contador y no se pide el contador', () => {
    roles = ['otro'];
    renderSidebar();
    expect(linksProductos().length).toBeGreaterThan(0);
    expect(screen.queryByTestId('badge-para-contactar')).toBeNull();
    expect(habilitado).not.toHaveBeenCalledWith(true);
  });
});

describe('Para contactar · pestaña de Productos', () => {
  it('un admin la ve justo después de Ventas, con el contador, y arranca en Catálogo', () => {
    roles = ['admin'];
    render(<ProductosPage />);

    const nombres = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    const iVentas = nombres.findIndex((n) => n === 'Ventas');
    expect(iVentas).toBeGreaterThan(-1);
    expect(nombres[iVentas + 1]).toMatch(/^Para contactar/);
    expect(screen.getByTestId('badge-para-contactar-tab').textContent).toBe('4');
    expect(screen.queryByText('CONTENIDO para contactar')).toBeNull();
  });

  it('recepción (staff) ve solo Ventas y Para contactar', () => {
    roles = ['staff'];
    render(<ProductosPage />);
    expect(tabVentas()).toBeTruthy();
    expect(tabParaContactar()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Catálogo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Configuración' })).toBeNull();
  });

  it('un usuario sin esos roles sigue viendo solo Ventas', () => {
    roles = ['otro'];
    render(<ProductosPage />);
    expect(tabVentas()).toBeTruthy();
    expect(tabParaContactar()).toBeNull();
    expect(screen.queryByText('CONTENIDO para contactar')).toBeNull();
  });

  it('?tab=para-contactar abre la pestaña; sin permiso cae en Ventas', () => {
    roles = ['staff'];
    window.history.pushState({}, '', '/productos?tab=para-contactar');
    render(<ProductosPage />);
    expect(screen.getByText('CONTENIDO para contactar')).toBeTruthy();
    cleanup();

    roles = ['otro'];
    render(<ProductosPage />);
    expect(screen.queryByText('CONTENIDO para contactar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registro de ventas' })).toBeTruthy();
  });
});

describe('Para contactar · el link viejo /para-contactar', () => {
  it.each([[['admin']], [['super_admin']], [['staff']]])('roles %j: terminan en Productos con la pestaña abierta', async (r) => {
    roles = r;
    entrarA('/para-contactar');
    expect(await screen.findByText('CONTENIDO para contactar')).toBeTruthy();
    expect(window.location.pathname).toBe('/productos');
    expect(window.location.search).toBe('?tab=para-contactar');
    expect(tabParaContactar()).toBeTruthy();
  });

  it('un usuario sin permiso que escribe la URL a mano termina en Productos, sin esa pestaña', async () => {
    roles = ['otro'];
    entrarA('/para-contactar');
    expect(await screen.findByRole('button', { name: 'Ventas' })).toBeTruthy();
    expect(window.location.pathname).toBe('/productos');
    expect(tabParaContactar()).toBeNull();
    expect(screen.queryByText('CONTENIDO para contactar')).toBeNull();
  });
});
