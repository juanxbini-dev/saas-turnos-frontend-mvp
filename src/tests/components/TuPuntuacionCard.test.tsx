import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TuPuntuacionCard } from '../../components/perfil/TuPuntuacionCard';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';

// "Tu puntuación" en el Perfil (spec post-servicio §7): promedio sobre 4 y
// cantidad, del mes y de siempre; nada de puntajes sueltos ni comentarios.

const get = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
}));

const responde = (data: unknown) => get.mockResolvedValue({ data: { success: true, data } });

describe('TuPuntuacionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
  });

  it('con puntajes muestra promedio "de 4" y cantidad, del mes y de siempre', async () => {
    responde({
      mes: { cantidad: 12, promedio: 3.58, desde: '2026-10-01', hasta: '2026-10-31' },
      historico: { cantidad: 1, promedio: 3.7 },
    });
    render(<TuPuntuacionCard />);

    expect(await screen.findByText('3,6 de 4')).toBeTruthy();
    expect(screen.getByText('12 puntuaciones')).toBeTruthy();
    expect(screen.getByText('3,7 de 4')).toBeTruthy();
    expect(screen.getByText('1 puntuación')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/api/puntuaciones/mia');
  });

  it('sin puntajes: "Todavía no tenés puntuaciones"', async () => {
    responde({
      mes: { cantidad: 0, promedio: null, desde: '2026-10-01', hasta: '2026-10-31' },
      historico: { cantidad: 0, promedio: null },
    });
    render(<TuPuntuacionCard />);

    expect(await screen.findByText('Todavía no tenés puntuaciones')).toBeTruthy();
    expect(screen.queryByText(/de 4/)).toBeNull();
  });

  it('con puntajes de antes pero ninguno este mes, lo aclara en el mes', async () => {
    responde({
      mes: { cantidad: 0, promedio: null, desde: '2026-10-01', hasta: '2026-10-31' },
      historico: { cantidad: 5, promedio: 4 },
    });
    render(<TuPuntuacionCard />);

    expect(await screen.findByText('Todavía no tenés puntuaciones este mes')).toBeTruthy();
    expect(screen.getByText('4,0 de 4')).toBeTruthy();
  });

  it('si falla, avisa y deja reintentar', async () => {
    get.mockRejectedValueOnce(new Error('Network Error'));
    render(<TuPuntuacionCard />);

    expect(await screen.findByText(/No se pudo cargar tu puntuación/)).toBeTruthy();
    responde({ mes: { cantidad: 1, promedio: 2, desde: '2026-10-01', hasta: '2026-10-31' }, historico: { cantidad: 1, promedio: 2 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getAllByText('2,0 de 4')).toHaveLength(2));
  });
});
