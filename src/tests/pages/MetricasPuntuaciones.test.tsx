import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import MetricasPage from '../../pages/MetricasPage';
import Sidebar from '../../components/layout/Sidebar';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { Puntuacion, PuntuacionesResumen } from '../../types/puntuaciones.types';

// Puntuaciones dentro de Métricas (spec post-servicio §7): solo super admin,
// "Para revisar" con marcar como revisado, y el contador del menú al día.

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

let roles: string[] = [];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles }, roles }, logout: vi.fn() }),
}));

// La parte "Negocio" de Métricas no se prueba acá
vi.mock('../../services/metricas.service', () => ({
  metricasService: {
    getResumen: () => Promise.resolve(null),
    getEvolucion: () => Promise.resolve([]),
    getEquipo: () => Promise.resolve([]),
    getClientesNuevos: () => Promise.resolve(null),
    getComparativa: () => Promise.resolve([]),
  },
}));
vi.mock('../../services/usuario.service', () => ({
  usuarioService: { getUsuarios: () => Promise.resolve([]) },
}));
vi.mock('../../services/productos.service', () => ({
  productosService: { getStats: () => Promise.resolve({ bajo_stock_count: 0 }) },
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Las puntuaciones pasan por el servicio REAL: se mockea solo el cliente HTTP
const get = vi.fn();
const patch = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

const BAJO: Puntuacion = {
  id: 'p-1', fecha: '2026-10-02T23:30:00.000Z', fecha_turno: '2026-10-02', puntaje: 1, origen: 'boton',
  profesional_id: 'u-ana', profesional: 'Ana', servicio: 'Color', cliente_id: 'c-1', cliente: 'Laura Díaz',
  comentario: 'Me hicieron esperar 40 minutos', comentario_at: '2026-10-02T23:35:00.000Z',
  revisado_at: null, revisado_por: null, resena_click_at: null,
};

const REGULAR_SIN_COMENTARIO: Puntuacion = {
  ...BAJO, id: 'p-2', puntaje: 2, cliente: 'Marta Ruiz', comentario: null, comentario_at: null,
};

const RESUMEN: PuntuacionesResumen = {
  general: { cantidad: 10, promedio: 3.6, por_nivel: { '4': 7, '3': 2, '2': 0, '1': 1 }, resenas_clic: 4, con_comentario: 2 },
  por_profesional: [
    { usuario_id: 'u-ana', nombre: 'Ana', cantidad: 6, promedio: 3.5, por_nivel: { '4': 4, '3': 1, '2': 0, '1': 1 }, bajos_pendientes: 1 },
    { usuario_id: 'u-beto', nombre: 'Beto', cantidad: 4, promedio: 3.75, por_nivel: { '4': 3, '3': 1, '2': 0, '1': 0 }, bajos_pendientes: 0 },
  ],
  por_mes: [{ mes: '2026-10', cantidad: 10, promedio: 3.6 }],
  para_revisar: 2,
};

let pendientes = 2;

function rutear(url: string, config?: { params?: Record<string, unknown> }) {
  if (url === '/api/puntuaciones/para-revisar/contador') return ok({ pendientes });
  if (url === '/api/puntuaciones/resumen') return ok(RESUMEN);
  if (url === '/api/puntuaciones') {
    const p = config?.params ?? {};
    const items = p.solo_bajos === 'true' && p.revision === 'pendientes'
      ? [BAJO, REGULAR_SIN_COMENTARIO].slice(0, pendientes)
      : [BAJO, REGULAR_SIN_COMENTARIO];
    return ok({ items, total: items.length, pagina: 1, por_pagina: 20 });
  }
  return Promise.reject(new Error(`URL inesperada ${url}`));
}

const renderMetricas = (ruta = '/metricas') => render(
  <MemoryRouter initialEntries={[ruta]}>
    <MetricasPage />
  </MemoryRouter>
);

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />
  </MemoryRouter>
);

const llamadasA = (url: string) => get.mock.calls.filter(([u]) => u === url);

beforeEach(() => {
  vi.clearAllMocks();
  cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
  pendientes = 2;
  get.mockImplementation(rutear);
  patch.mockImplementation(() => {
    pendientes -= 1;
    return ok({ pendientes });
  });
});

afterEach(() => cleanup());

describe('Métricas · pestaña Puntuaciones', () => {
  it('super admin ve la pestaña con el contador de pendientes', async () => {
    roles = ['admin', 'super_admin'];
    renderMetricas();

    const tab = await screen.findByRole('tab', { name: /Puntuaciones/ });
    await waitFor(() => expect(within(tab).getByText('2')).toBeTruthy());
    expect(screen.getByRole('tab', { name: 'Negocio' }).getAttribute('aria-selected')).toBe('true');
  });

  it('un admin común no ve la pestaña ni pide nada de puntuaciones, aunque escriba la URL', async () => {
    roles = ['admin'];
    renderMetricas('/metricas?vista=puntuaciones');

    await screen.findByRole('heading', { name: 'Métricas' });
    expect(screen.queryByRole('tab', { name: /Puntuaciones/ })).toBeNull();
    expect(screen.queryByText('Para revisar')).toBeNull();
    expect(get.mock.calls.some(([u]) => String(u).startsWith('/api/puntuaciones'))).toBe(false);
  });

  it('muestra para revisar con comentario o "Sin comentario", y los números con nombre de nivel', async () => {
    roles = ['super_admin'];
    renderMetricas('/metricas?vista=puntuaciones');

    expect((await screen.findAllByText('Me hicieron esperar 40 minutos')).length).toBeGreaterThan(0);
    const items = await screen.findAllByTestId('para-revisar-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Malo')).toBeTruthy();
    expect(within(items[0]).getByText(/Color · con Ana/)).toBeTruthy();
    expect(within(items[1]).getByText('Regular')).toBeTruthy();
    expect(within(items[1]).getByText('Sin comentario')).toBeTruthy();

    // Números del período
    expect((await screen.findAllByText('3,6 de 4')).length).toBeGreaterThan(0);
    const niveles = screen.getByRole('list', { name: 'Cuántos de cada nivel' });
    expect(within(niveles).getByText('Excelente')).toBeTruthy();
    expect(within(niveles).getByText('Malo')).toBeTruthy();
    expect(screen.getAllByRole('cell', { name: 'Octubre de 2026' }).length).toBe(1);
    expect(screen.getByText('3,8 de 4')).toBeTruthy();   // Beto: 3,75 → 3,8

    // "Para revisar" pide solo los bajos pendientes; la lista completa, el período
    const listas = llamadasA('/api/puntuaciones').map(([, c]) => (c as { params: Record<string, unknown> }).params);
    expect(listas).toContainEqual(expect.objectContaining({ solo_bajos: 'true', revision: 'pendientes' }));
    expect(listas).toContainEqual(expect.objectContaining({ revision: 'todos', fecha_desde: expect.any(String), fecha_hasta: expect.any(String) }));
  });

  it('marcar como revisado llama al PATCH y baja el contador (pestaña y menú)', async () => {
    roles = ['super_admin'];
    renderMetricas('/metricas?vista=puntuaciones');
    renderSidebar();

    await waitFor(() => expect(screen.getAllByTestId('badge-puntuaciones')[0].textContent).toBe('2'));
    const items = await screen.findAllByTestId('para-revisar-item');
    fireEvent.click(within(items[0]).getByRole('button', { name: 'Marcar como revisado' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/puntuaciones/p-1', { revisado: true }));
    await waitFor(() => expect(screen.getAllByTestId('badge-puntuaciones')[0].textContent).toBe('1'));
    const tab = screen.getByRole('tab', { name: /Puntuaciones/ });
    await waitFor(() => expect(within(tab).getByText('1')).toBeTruthy());
    await waitFor(() => expect(screen.getAllByTestId('para-revisar-item')).toHaveLength(1));
  });

  it('con el filtro de revisados se puede volver a pendientes', async () => {
    roles = ['super_admin'];
    const revisado = { ...BAJO, revisado_at: '2026-10-03T12:00:00.000Z', revisado_por: 'Dani' };
    get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/api/puntuaciones' && config?.params?.revision === 'revisados') {
        return ok({ items: [revisado], total: 1, pagina: 1, por_pagina: 10 });
      }
      return rutear(url, config);
    });
    patch.mockImplementation(() => ok({ pendientes: 3 }));
    renderMetricas('/metricas?vista=puntuaciones');

    fireEvent.change(await screen.findByLabelText('Qué mostrar'), { target: { value: 'revisados' } });
    expect(await screen.findByText(/Revisado por Dani/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a pendientes' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/puntuaciones/p-1', { revisado: false }));
  });
});

describe('Menú · aviso de puntuaciones para revisar', () => {
  it('super admin ve el número en Métricas', async () => {
    roles = ['admin', 'super_admin'];
    renderSidebar();
    await waitFor(() => expect(screen.getAllByTestId('badge-puntuaciones')[0].textContent).toBe('2'));
  });

  it('con 0 pendientes no se muestra', async () => {
    roles = ['super_admin'];
    pendientes = 0;
    renderSidebar();
    await waitFor(() => expect(llamadasA('/api/puntuaciones/para-revisar/contador').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('badge-puntuaciones')).toBeNull();
  });

  it('un admin común no lo ve ni lo pide', async () => {
    roles = ['admin'];
    renderSidebar();
    await screen.findAllByRole('link', { name: 'Métricas' });
    expect(screen.queryByTestId('badge-puntuaciones')).toBeNull();
    expect(llamadasA('/api/puntuaciones/para-revisar/contador')).toHaveLength(0);
  });

  it('un admin común tampoco lo pide al volver a la ventana', async () => {
    roles = ['admin'];
    renderSidebar();
    await screen.findAllByRole('link', { name: 'Métricas' });
    fireEvent.focus(window);
    await new Promise((r) => setTimeout(r, 50));
    expect(llamadasA('/api/puntuaciones/para-revisar/contador')).toHaveLength(0);
  });
});
