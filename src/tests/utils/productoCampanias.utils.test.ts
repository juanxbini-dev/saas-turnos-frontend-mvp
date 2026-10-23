import { describe, it, expect } from 'vitest';
import {
  validarCamposCampania,
  filtrarSinDuracion,
  textoDuracion,
  nombreParaMensaje,
} from '../../utils/productoCampanias.utils';

describe('validarCamposCampania', () => {
  it('vacío (o espacios) = null', () => {
    expect(validarCamposCampania('', ' ')).toEqual({
      ok: true,
      data: { duracion_estimada_dias: null, seguimiento_dias: null, nombre_mensaje: null },
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
  it('deja solo los productos ACTIVOS sin duración (null o ausente)', () => {
    const lista: Array<{ id: string; activo: boolean; duracion_estimada_dias?: number | null }> = [
      { id: 'a', activo: true, duracion_estimada_dias: 60 },
      { id: 'b', activo: true, duracion_estimada_dias: null },
      { id: 'c', activo: true },
      { id: 'd', activo: false, duracion_estimada_dias: null },
      { id: 'e', activo: false, duracion_estimada_dias: 30 },
    ];
    expect(filtrarSinDuracion(lista).map(p => p.id)).toEqual(['b', 'c']);
  });
});

describe('validarCamposCampania · nombre para mensajes', () => {
  it('vacío o solo espacios = null', () => {
    expect(validarCamposCampania('', '', '')).toMatchObject({ ok: true, data: { nombre_mensaje: null } });
    expect(validarCamposCampania('', '', '   ')).toMatchObject({ ok: true, data: { nombre_mensaje: null } });
  });

  it('recorta espacios', () => {
    expect(validarCamposCampania('', '', '  shampoo Densifying ')).toMatchObject({
      ok: true,
      data: { nombre_mensaje: 'shampoo Densifying' },
    });
  });

  it('acepta 60 caracteres (después del trim) y rechaza 61', () => {
    expect(validarCamposCampania('', '', ` ${'a'.repeat(60)} `).ok).toBe(true);
    expect(validarCamposCampania('', '', 'a'.repeat(61))).toEqual({
      ok: false,
      error: 'El nombre para mensajes puede tener hasta 60 caracteres',
    });
  });

  it('rechaza saltos de línea en el medio', () => {
    const conSalto = 'shampoo' + String.fromCharCode(10) + 'Densifying';
    const conRetorno = 'shampoo' + String.fromCharCode(13) + 'Densifying';
    expect(validarCamposCampania('', '', conSalto)).toEqual({
      ok: false,
      error: 'El nombre para mensajes no puede tener saltos de línea',
    });
    expect(validarCamposCampania('', '', conRetorno).ok).toBe(false);
  });
});

describe('nombreParaMensaje', () => {
  it('usa el nombre para mensajes y, si está vacío, el nombre del producto', () => {
    expect(nombreParaMensaje(' shampoo Densifying ', 'Sh Densifying')).toBe('shampoo Densifying');
    expect(nombreParaMensaje('  ', 'Sh Densifying')).toBe('Sh Densifying');
  });
});

describe('textoDuracion', () => {
  it('formatea días y guion si falta', () => {
    expect(textoDuracion(60)).toBe('Dura 60 días');
    expect(textoDuracion(1)).toBe('Dura 1 día');
    expect(textoDuracion(null)).toBe('—');
  });
});
