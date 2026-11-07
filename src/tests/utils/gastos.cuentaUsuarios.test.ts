import { describe, it, expect } from 'vitest';
import {
  armarPedidoCuenta,
  esPeriodoValido,
  explicarCambioCuenta,
  historialTramos,
  mensajeCambioCuenta,
  opcionesAlcanceCuenta,
  resumenTramos,
  textoTramo,
} from '../../components/gastos/cuentaGastos.utils';
import { mesConAnio } from '../../components/gastos/gastos.utils';
import type { GastosUsuarioCuentaTramo } from '../../types/gastos.types';

// "Cuenta en Gastos" por usuario (backend/docs/gastos-ingresos-plan.md): un
// cambio es un tramo (cuenta, desde, hasta). "desde X" = (X, null),
// "solo X" = (X, X), "todos los meses" = (null, null).

const tramo = (cuenta: boolean, desde: string | null, hasta: string | null, id = 't'): GastosUsuarioCuentaTramo => ({
  id, cuenta, periodo_desde: desde, periodo_hasta: hasta, created_at: '2026-11-07T12:00:00.000Z',
});

describe('mesConAnio', () => {
  it('siempre con año y en minúscula, aunque sea el año en curso', () => {
    expect(mesConAnio('2026-11')).toBe('noviembre 2026');
    expect(mesConAnio('2025-01')).toBe('enero 2025');
  });
});

describe('textoTramo', () => {
  it('todos los meses: "No cuenta desde siempre" / "Cuenta desde siempre"', () => {
    expect(textoTramo(tramo(false, null, null))).toBe('No cuenta desde siempre');
    expect(textoTramo(tramo(true, null, null))).toBe('Cuenta desde siempre');
  });

  it('desde un mes: "No cuenta desde noviembre 2026"', () => {
    expect(textoTramo(tramo(false, '2026-11', null))).toBe('No cuenta desde noviembre 2026');
    expect(textoTramo(tramo(true, '2027-02', null))).toBe('Cuenta desde febrero 2027');
  });

  it('solo un mes: "Solo octubre 2026: no cuenta"', () => {
    expect(textoTramo(tramo(false, '2026-10', '2026-10'))).toBe('Solo octubre 2026: no cuenta');
    expect(textoTramo(tramo(true, '2026-10', '2026-10'))).toBe('Solo octubre 2026: cuenta');
  });

  it('rangos que la API hoy no arma igual se leen bien', () => {
    expect(textoTramo(tramo(false, '2026-10', '2026-12'))).toBe('No cuenta de octubre 2026 a diciembre 2026');
    expect(textoTramo(tramo(false, null, '2026-12'))).toBe('No cuenta hasta diciembre 2026');
  });
});

describe('resumenTramos e historialTramos', () => {
  it('sin tramos cuenta en todos los meses (el default)', () => {
    expect(resumenTramos([])).toBe('Cuenta en todos los meses');
    expect(historialTramos([])).toBe('Nunca se cambió: cuenta en todos los meses.');
  });

  it('el resumen es el tramo más nuevo (la API los manda más nuevo primero)', () => {
    const tramos = [tramo(false, '2026-10', '2026-10', 'nuevo'), tramo(false, null, null, 'viejo')];
    expect(resumenTramos(tramos)).toBe('Solo octubre 2026: no cuenta');
  });

  it('el historial lista todos, del más nuevo al más viejo', () => {
    const tramos = [tramo(true, '2026-11', null), tramo(false, null, null)];
    expect(historialTramos(tramos).split('\n')).toEqual([
      'Último cambio: Cuenta desde noviembre 2026',
      'Antes: No cuenta desde siempre',
      'El cambio más nuevo manda en los meses que se pisan.',
    ]);
  });
});

describe('opciones del modal de alcance', () => {
  it('en orden: desde (default), solo, todos los meses, con el mes elegido en el texto', () => {
    expect(opcionesAlcanceCuenta('2026-11')).toEqual([
      { value: 'desde', label: 'Desde noviembre 2026 en adelante' },
      { value: 'solo', label: 'Solo en noviembre 2026' },
      { value: 'siempre', label: 'Todos los meses (también los anteriores)' },
    ]);
  });

  it('la explicación dice qué meses se tocan y que los demás quedan igual', () => {
    expect(explicarCambioCuenta('Dani', false, 'desde', '2026-11'))
      .toMatch(/^Desde noviembre 2026 en adelante lo que facture Dani no entra en "Entró".*Los meses anteriores quedan como estaban\.$/);
    expect(explicarCambioCuenta('Dani', false, 'solo', '2026-10'))
      .toMatch(/^Solo en octubre 2026 .*Los demás meses quedan como estaban\.$/);
    expect(explicarCambioCuenta('Juli', true, 'siempre', '2026-11'))
      .toMatch(/^En todos los meses, también los anteriores, lo que facture Juli vuelve a entrar/);
  });

  it('el aviso de éxito repite el tramo que quedó', () => {
    expect(mensajeCambioCuenta('Dani', false, 'desde', '2026-11')).toBe('Dani: no cuenta desde noviembre 2026');
    expect(mensajeCambioCuenta('Dani', false, 'solo', '2026-10')).toBe('Dani: solo octubre 2026: no cuenta');
    expect(mensajeCambioCuenta('Juli', true, 'siempre', '2026-11')).toBe('Juli: cuenta desde siempre');
  });
});

describe('armarPedidoCuenta (body de POST /usuarios-cuenta/:usuarioId)', () => {
  it('"desde" y "solo" llevan el periodo', () => {
    expect(armarPedidoCuenta(false, 'desde', '2026-11')).toEqual({ cuenta: false, alcance: 'desde', periodo: '2026-11' });
    expect(armarPedidoCuenta(true, 'solo', '2026-10')).toEqual({ cuenta: true, alcance: 'solo', periodo: '2026-10' });
  });

  it('"siempre" no manda periodo aunque se lo pasen', () => {
    const body = armarPedidoCuenta(false, 'siempre', '2026-11');
    expect(body).toEqual({ cuenta: false, alcance: 'siempre' });
    expect('periodo' in body).toBe(false);
  });

  it('"desde" y "solo" sin periodo, o con uno mal formado, tiran antes de llamar a la API', () => {
    expect(() => armarPedidoCuenta(false, 'desde')).toThrow('Elegí un mes válido');
    expect(() => armarPedidoCuenta(false, 'solo', null)).toThrow();
    expect(() => armarPedidoCuenta(false, 'desde', '2026-13')).toThrow();
    expect(() => armarPedidoCuenta(false, 'desde', '2026-1')).toThrow();
  });

  it('esPeriodoValido acepta solo YYYY-MM con mes 01–12', () => {
    expect(esPeriodoValido('2026-01')).toBe(true);
    expect(esPeriodoValido('2026-12')).toBe(true);
    expect(esPeriodoValido('2026-00')).toBe(false);
    expect(esPeriodoValido('')).toBe(false);
    expect(esPeriodoValido(undefined)).toBe(false);
  });
});
