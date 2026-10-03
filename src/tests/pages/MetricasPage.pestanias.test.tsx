import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import MetricasPage from '../../pages/MetricasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { reiniciarContadorParaRevisar } from '../../services/puntuaciones.service';

// Pestañas de Métricas (super admin): accesibles con teclado, y en
// "Puntuaciones" no se piden los números de "Negocio".

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

let roles: string[] = ['super_admin'];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles }, roles }, logout: vi.fn() }),
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Todo pasa por los servicios REALES: se mockea solo el cliente HTTP
const get = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: { get: (...a: unknown[]) => get(...a), patch: vi.fn() },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

function rutear(url: string) {
  if (url === '/api/puntuaciones/para-revisar/contador') return ok({ pendientes: 0 });
  if (url === '/api/puntuaciones/resumen') {
    return ok({
      general: { cantidad: 0, promedio: null, por_nivel: { '4': 0, '3': 0, '2': 0, '1': 0 }, resenas_clic: 0, con_comentario: 0 },
      por_profesional: [], por_mes: [], para_revisar: 0,
    });
  }
  if (url === '/api/puntuaciones') return ok({ items: [], total: 0, pagina: 1, por_pagina: 20 });
  if (url === '/api/usuarios') return ok([]);
  if (url.startsWith('/api/metricas/')) return ok(url.startsWith('/api/metricas/resumen') || url.startsWith('/api/metricas/clientes-nuevos') ? null : []);
  return Promise.reject(new Error(`URL inesperada ${url}`));
}

function MostrarUrl() {
  const loc = useLocation();
  return <div data-testid="url">{loc.search}</div>;
}

const renderMetricas = (ruta = '/metricas') => render(
  <MemoryRouter initialEntries={[ruta]}>
    <MetricasPage />
    <MostrarUrl />
  </MemoryRouter>
);

const pestania = (nombre: RegExp | string) => screen.getByRole('tab', { name: nombre });
const pedidosDeNegocio = () => get.mock.calls.filter(([u]) => String(u).startsWith('/api/metricas/'));

beforeEach(() => {
  vi.clearAllMocks();
  roles = ['super_admin'];
  cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
  cacheService.invalidateByPrefix(buildKey(ENTITIES.METRICAS));
  reiniciarContadorParaRevisar();
  get.mockImplementation(rutear);
});

afterEach(() => cleanup());

describe('Métricas · pestañas accesibles', () => {
  it('cada pestaña controla su panel y el panel dice qué pestaña lo nombra', async () => {
    renderMetricas();

    const negocio = await screen.findByRole('tab', { name: 'Negocio' });
    expect(negocio.id).toBe('metricas-tab-negocio');
    expect(negocio.getAttribute('aria-controls')).toBe('metricas-panel-negocio');
    expect(pestania(/Puntuaciones/).getAttribute('aria-controls')).toBe('metricas-panel-puntuaciones');

    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe('metricas-panel-negocio');
    expect(panel.getAttribute('aria-labelledby')).toBe('metricas-tab-negocio');
  });

  it('flechas, Inicio y Fin mueven el foco y la pestaña elegida; solo la activa entra con Tab', async () => {
    renderMetricas();
    const negocio = await screen.findByRole('tab', { name: 'Negocio' });
    expect(negocio.getAttribute('tabindex')).toBe('0');
    expect(pestania(/Puntuaciones/).getAttribute('tabindex')).toBe('-1');

    negocio.focus();
    fireEvent.keyDown(negocio, { key: 'ArrowRight' });
    await waitFor(() => expect(pestania(/Puntuaciones/).getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(pestania(/Puntuaciones/));
    expect(pestania(/Puntuaciones/).getAttribute('tabindex')).toBe('0');
    expect(pestania('Negocio').getAttribute('tabindex')).toBe('-1');
    expect(screen.getByTestId('url').textContent).toBe('?vista=puntuaciones');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('metricas-tab-puntuaciones');

    // Da la vuelta: desde la última, derecha vuelve a la primera
    fireEvent.keyDown(pestania(/Puntuaciones/), { key: 'ArrowRight' });
    await waitFor(() => expect(pestania('Negocio').getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(pestania('Negocio'));

    fireEvent.keyDown(pestania('Negocio'), { key: 'ArrowLeft' });
    await waitFor(() => expect(document.activeElement).toBe(pestania(/Puntuaciones/)));
    fireEvent.keyDown(pestania(/Puntuaciones/), { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(pestania('Negocio')));
    fireEvent.keyDown(pestania('Negocio'), { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(pestania(/Puntuaciones/)));
    expect(pestania(/Puntuaciones/).getAttribute('aria-selected')).toBe('true');
  });

  it('sin pestañas (admin común) el contenido no se marca como panel', async () => {
    roles = ['admin'];
    renderMetricas();
    await screen.findByRole('heading', { name: 'Métricas' });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });
});

describe('Métricas · pedidos por pestaña', () => {
  it('en Puntuaciones no se pide nada de Negocio', async () => {
    renderMetricas('/metricas?vista=puntuaciones');

    await screen.findByText('Para revisar');
    await waitFor(() => expect(get.mock.calls.some(([u]) => u === '/api/puntuaciones/resumen')).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(pedidosDeNegocio()).toHaveLength(0);
    expect(get.mock.calls.some(([u]) => u === '/api/usuarios')).toBe(false);
  });

  it('al volver a Negocio sí se piden', async () => {
    renderMetricas('/metricas?vista=puntuaciones');
    await screen.findByText('Para revisar');

    fireEvent.click(pestania('Negocio'));
    await waitFor(() => expect(pedidosDeNegocio().length).toBeGreaterThan(0));
    expect(pedidosDeNegocio().some(([u]) => String(u).startsWith('/api/metricas/resumen'))).toBe(true);
  });
});
