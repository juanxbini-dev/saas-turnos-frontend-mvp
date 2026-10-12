import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AvisoCambioGanancias, AVISO_GANANCIAS_KEY } from '../../components/gastos/AvisoCambioGanancias';

// Aviso único de gastos-ganancias-spec §4.8 / P7

describe('AvisoCambioGanancias', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('aparece la primera vez con el texto del cambio, sin nombre interno', () => {
    render(<AvisoCambioGanancias />);

    const aviso = screen.getByTestId('aviso-cambio-ganancias');
    expect(aviso.textContent).toContain('lo que atendés vos y el costo de los productos vendidos ya no cuentan como gasto');
    expect(aviso.textContent).toContain('Los meses anteriores también se actualizaron');
    expect(aviso.textContent).not.toMatch(/Turnos 2\.0/);
  });

  it('al cerrarlo desaparece y no vuelve en la próxima visita', () => {
    const { unmount } = render(<AvisoCambioGanancias />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    expect(screen.queryByTestId('aviso-cambio-ganancias')).toBeNull();
    expect(localStorage.getItem(AVISO_GANANCIAS_KEY)).toBe('1');

    unmount();
    render(<AvisoCambioGanancias />);
    expect(screen.queryByTestId('aviso-cambio-ganancias')).toBeNull();
  });

  it('si localStorage falla (modo privado) se muestra y se puede cerrar igual, sin romper', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });

    render(<AvisoCambioGanancias />);
    expect(screen.getByTestId('aviso-cambio-ganancias')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByTestId('aviso-cambio-ganancias')).toBeNull();
  });
});
