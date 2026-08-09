import { vi } from 'vitest';
import { buildTurnosSublabel, buildClientesSublabel, buildComisionSublabel } from '../../pages/PerfilPage';

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

describe('buildClientesSublabel', () => {
  it('contrasta atendidos y repetidores, igual para staff y admin', () => {
    expect(buildClientesSublabel(9, 4)).toBe('9 ya atendidos · 4 repiten este mes');
  });

  it('sin atendidos ni repetidores: muestra 0 explícito', () => {
    expect(buildClientesSublabel(0, 0)).toBe('0 ya atendidos · 0 repiten este mes');
  });
});

describe('buildComisionSublabel', () => {
  // El formato exacto de moneda depende de la versión de ICU (espacios, símbolo);
  // se testea la estructura y los montos, no el string literal
  it('explicita el criterio "de lo cobrado" y desglosa servicios/productos', () => {
    const sublabel = buildComisionSublabel(120000, 35000);
    expect(sublabel).toMatch(/^de lo cobrado: /);
    expect(sublabel).toMatch(/120\.000\s*servicios/);
    expect(sublabel).toMatch(/35\.000\s*productos/);
    expect(sublabel).toContain(' · ');
  });

  it('con montos en cero: muestra $ 0 explícito en ambas partes', () => {
    const sublabel = buildComisionSublabel(0, 0);
    expect(sublabel).toMatch(/0\s*servicios/);
    expect(sublabel).toMatch(/0\s*productos/);
  });
});
