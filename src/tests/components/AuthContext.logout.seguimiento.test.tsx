import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';

// El seguimiento de turnos trae datos personales: al cerrar sesión no queda en cache.

vi.mock('../../services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockRejectedValue(new Error('sin sesión')),
    login: vi.fn(),
  },
}));
vi.mock('../../services/gastos.service', () => ({ clearGastosToken: vi.fn() }));

import { AuthProvider, useAuth } from '../../context/AuthContext';

const BotonSalir = () => {
  const { logout } = useAuth();
  return <button onClick={() => logout()}>Salir</button>;
};

// JWT de mentira con empresaId, para que la clave lleve la empresa
function tokenFalso(empresaId: string) {
  const payload = btoa(JSON.stringify({ empresaId }));
  return `x.${payload}.y`;
}

describe('AuthContext.logout', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  it('limpia del cache el seguimiento de turnos de la empresa', async () => {
    localStorage.setItem('accessToken', tokenFalso('emp-1'));
    const clave = buildKey(ENTITIES.SEGUIMIENTO, 'tur-1');
    expect(clave).toBe('emp-1:seguimiento:tur-1');
    cacheService.set(clave, { algo: 1 }, TTL.SHORT);
    const otra = buildKey(ENTITIES.SERVICIOS);
    cacheService.set(otra, [1], TTL.LONG);

    render(<AuthProvider><BotonSalir /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(cacheService.get(clave)).toBeNull());
    expect(localStorage.getItem('accessToken')).toBeNull();
    // Solo toca el prefijo de seguimiento
    expect(cacheService.get(otra)).toEqual([1]);
  });
});
