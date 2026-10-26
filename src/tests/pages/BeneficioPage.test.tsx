import React from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BeneficioPage } from '../../pages/public/BeneficioPage';
import AppRouter from '../../router/AppRouter';

// beneficio-con-turno D1 y D5: /beneficio ya no tiene formulario.
//   - con `?m=` (link de un mail viejo) → redirige a `/?m=…`
//   - sin `m` → "Este beneficio llega por mail" + botón a reservar
// No llama a ningún endpoint: el contexto (y el clic) lo pide la landing.

const get = vi.fn();
const post = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

// Para la prueba de ruta: sin sesión y sin el resto de las páginas
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: null, isAuthenticated: false, loading: false, roles: [] }, logout: vi.fn() }),
}));
vi.mock('../../pages/public/DebSalonLandingPage', () => ({
  DebSalonLandingPage: () => {
    const location = useLocation();
    return <div>PAGINA landing {location.search}</div>;
  },
}));
vi.mock('../../pages/LoginPage', () => ({ default: () => <div>PAGINA login</div> }));

const M = 'Xk92mPq7Lt';

function DondeEstoy() {
  const location = useLocation();
  return <div data-testid="ubicacion">{`${location.pathname}${location.search}`}</div>;
}

const renderPagina = (ruta: string) => render(
  <MemoryRouter initialEntries={[ruta]}>
    <Routes>
      <Route path="/beneficio" element={<BeneficioPage />} />
      <Route path="/" element={<DondeEstoy />} />
    </Routes>
  </MemoryRouter>
);

describe('/beneficio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = 'DEB Salon';
  });

  it('con ?m= redirige a la landing con el mismo m (sin consultar nada acá)', () => {
    renderPagina(`/beneficio?m=${M}`);
    expect(screen.getByTestId('ubicacion').textContent).toBe(`/?m=${M}`);
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('el m viaja escapado', () => {
    renderPagina('/beneficio?m=a%26b%3Dc');
    expect(screen.getByTestId('ubicacion').textContent).toBe('/?m=a%26b%3Dc');
  });

  it('sin m: explica que el beneficio llega por mail y ofrece reservar, sin formulario', () => {
    renderPagina('/beneficio');
    expect(screen.getByRole('heading', { level: 1, name: 'Tu beneficio' })).toBeTruthy();
    expect(screen.getByText(/Este beneficio llega por mail/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reservar turno' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quiero mi código' })).toBeNull();
    expect(document.title).toBe('Tu beneficio · DEB Salón');
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('nunca muestra el nombre interno del sistema', () => {
    renderPagina('/beneficio');
    expect(document.body.textContent).not.toMatch(/Turnos 2\.0/);
    expect(document.body.textContent).toContain('DEB Salón');
  });

  it('está en el router como ruta pública, sin login, y redirige a la landing', async () => {
    render(
      <MemoryRouter initialEntries={[`/beneficio?m=${M}`]}>
        <AppRouter />
      </MemoryRouter>
    );
    expect(await screen.findByText(`PAGINA landing ?m=${M}`)).toBeTruthy();
    expect(screen.queryByText('PAGINA login')).toBeNull();
  });
});
