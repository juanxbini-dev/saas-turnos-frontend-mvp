import { describe, it, expect } from 'vitest';
import {
  validarCamposCampania,
  filtrarSinDuracion,
  textoDuracion,
} from '../../utils/productoCampanias.utils';

describe('validarCamposCampania', () => {
  it('vacío (o espacios) = null', () => {
    expect(validarCamposCampania('', ' ')).toEqual({
      ok: true,
      data: { duracion_estimada_dias: null, seguimiento_dias: null },
    });
  });

  it('acepta los bordes de los rangos', () => {
    expect(validarCamposCampania('1', '')).toMatchObject({ ok: true, data: { duracion_estimada_dias: 1 } });
    expect(validarCamposCampania('730', '')).toMatchObject({ ok: true, data: { duracion_estimada_dias: 730 } });
    expect(validarCamposCampania('', '1')).toMatchObject({ ok: true, data: { seguimiento_dias: 1 } });
    expect(validarCamposCampania('', '365')).toMatchObject({ ok: true, data: { seguimiento_dias: 365 } });
  });

  it.each(['0', '731', '1.5', '-1', '1e2', 'abc'])('rechaza duración %s', v => {
    expect(validarCamposCampania(v, '').ok).toBe(false);
  });

  it.each(['0', '366', '2.5', '-1'])('rechaza seguimiento %s', v => {
    expect(validarCamposCampania('', v).ok).toBe(false);
  });

  it('seguimiento tiene que ser menor que la duración', () => {
    expect(validarCamposCampania('30', '29').ok).toBe(true);
    expect(validarCamposCampania('30', '30').ok).toBe(false);
    expect(validarCamposCampania('30', '31').ok).toBe(false);
  });
});

describe('filtrarSinDuracion', () => {
  it('deja solo los productos sin duración (null o ausente)', () => {
    const lista = [
      { id: 'a', duracion_estimada_dias: 60 },
      { id: 'b', duracion_estimada_dias: null },
      { id: 'c' },
    ];
    expect(filtrarSinDuracion(lista).map(p => p.id)).toEqual(['b', 'c']);
  });
});

describe('textoDuracion', () => {
  it('formatea días y guion si falta', () => {
    expect(textoDuracion(60)).toBe('Dura 60 días');
    expect(textoDuracion(1)).toBe('Dura 1 día');
    expect(textoDuracion(null)).toBe('—');
  });
});
