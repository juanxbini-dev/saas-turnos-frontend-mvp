import { vi } from 'vitest';
import { buildTurnosSublabel } from '../../pages/PerfilPage';

// El import de PerfilPage arrastra axiosInstance; mockearlo evita side effects de interceptores
vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe('buildTurnosSublabel', () => {
  it('staff: contrasta agendados vs cobrados y apunta a Finanzas', () => {
    expect(buildTurnosSublabel(false, 68)).toBe('68 cobrados este mes · detalle en Finanzas');
  });

  it('staff sin cobrados: muestra 0 explícito', () => {
    expect(buildTurnosSublabel(false, 0)).toBe('0 cobrados este mes · detalle en Finanzas');
  });

  it('admin: aclara que el conteo es de toda la empresa y no muestra contraste', () => {
    // El conteo de agendados del admin es de toda la empresa; sus finanzas son propias.
    // Mostrar "sus" cobrados junto a un total de empresa sería comparar peras con manzanas.
    expect(buildTurnosSublabel(true, 68)).toBe('agendados este mes (toda la empresa)');
  });
});
