import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Sidebar from '../../components/layout/Sidebar';

// Spec campanias-n8n §4.1 / US1: el ítem "Campañas" lo ve solo super_admin.

let roles: string[] = [];

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { roles } }, logout: vi.fn() }),
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: () => ({ data: null, loading: false, error: null, revalidate: vi.fn() }),
}));

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />
  </MemoryRouter>
);

// El sidebar se pinta dos veces (desktop y mobile): alcanza con que exista o no
const linksCampanias = () => screen.queryAllByRole('link', { name: 'Campañas' });

describe('Sidebar — ítem Campañas', () => {
  beforeEach(() => { roles = []; });

  it('super_admin lo ve y apunta a /campanias', () => {
    roles = ['admin', 'super_admin'];
    renderSidebar();
    expect(linksCampanias().length).toBeGreaterThan(0);
    expect(linksCampanias()[0].getAttribute('href')).toBe('/campanias');
  });

  it('un admin común no lo ve', () => {
    roles = ['admin'];
    renderSidebar();
    expect(linksCampanias()).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Métricas' }).length).toBeGreaterThan(0);
  });

  it('el staff no lo ve', () => {
    roles = ['staff'];
    renderSidebar();
    expect(linksCampanias()).toHaveLength(0);
  });
});
