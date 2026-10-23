import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Sidebar from '../../components/layout/Sidebar';

// Plan mails-beneficios fase 4b: el ítem "Beneficios" lo ven admin y super_admin, no el staff.

let roles: string[] = [];

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { roles } }, logout: vi.fn() }),
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: () => ({ data: null, loading: false, error: null, revalidate: vi.fn() }),
}));

vi.mock('../../hooks/useContadorParaRevisar', () => ({
  useContadorParaRevisar: () => ({ pendientes: 0, loading: false, error: null, revalidate: vi.fn() }),
}));

vi.mock('../../hooks/useContadorParaContactar', () => ({
  useContadorParaContactar: () => ({ pendientes: 0, alta: 0, media: 0, loading: false, error: null, revalidate: vi.fn() }),
}));

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />
  </MemoryRouter>
);

// El sidebar se pinta dos veces (desktop y mobile): alcanza con que exista o no
const links = () => screen.queryAllByRole('link', { name: 'Beneficios' });

describe('Sidebar — ítem Beneficios', () => {
  beforeEach(() => { roles = []; });

  it('un admin lo ve, apunta a /beneficios y queda entre Métricas y Perfil (no ve Gastos ni Campañas)', () => {
    roles = ['admin'];
    renderSidebar();
    expect(links().length).toBeGreaterThan(0);
    expect(links()[0].getAttribute('href')).toBe('/beneficios');

    const nombres = screen.getAllByRole('link').map((l) => l.textContent);
    const posicion = nombres.indexOf('Beneficios');
    expect(nombres[posicion - 1]).toBe('Métricas');
    expect(nombres[posicion + 1]).toBe('Perfil');
  });

  it('super_admin también lo ve, justo después de Campañas', () => {
    roles = ['admin', 'super_admin'];
    renderSidebar();
    expect(links().length).toBeGreaterThan(0);
    const nombres = screen.getAllByRole('link').map((l) => l.textContent);
    expect(nombres[nombres.indexOf('Beneficios') - 1]).toBe('Campañas');
  });

  it('el staff no lo ve', () => {
    roles = ['staff'];
    renderSidebar();
    expect(links()).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Turnos' }).length).toBeGreaterThan(0);
  });
});
