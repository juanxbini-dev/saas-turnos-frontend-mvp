import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAvisoAntesDeSalir } from '../../hooks/useAvisoAntesDeSalir';

// Caso CS15 (decisión Q8): con cambios sin guardar, el navegador pide confirmación al cerrar/recargar.

const intentarSalir = () => {
  const evento = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(evento);
  return evento.defaultPrevented;
};

describe('useAvisoAntesDeSalir', () => {
  it('CS15: pide confirmación solo mientras está activo, y deja de pedirla al desactivarse o desmontarse', () => {
    const { rerender, unmount } = renderHook(({ activo }) => useAvisoAntesDeSalir(activo), {
      initialProps: { activo: false },
    });
    expect(intentarSalir()).toBe(false);

    rerender({ activo: true });
    expect(intentarSalir()).toBe(true);

    rerender({ activo: false });
    expect(intentarSalir()).toBe(false);

    rerender({ activo: true });
    unmount();
    expect(intentarSalir()).toBe(false);
  });
});
