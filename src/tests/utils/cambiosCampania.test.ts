import { describe, it, expect } from 'vitest';
import {
  esVacio,
  valoresIguales,
  parametrosIguales,
  hayCambios,
  actualizarTiposSucios,
  erroresParametros,
  tieneErrores,
  estadoTrasGuardar,
  fusionarConfigGuardada,
  ERROR_NUMERO,
  ERROR_REGLA,
} from '../../components/campanias/cambiosCampania';
import type { ParametrosCampania } from '../../types/campania.types';
import { conf } from '../fixtures/campanias.fixtures';

// Casos FC1–FC8 de backend/docs/campanias-frontend-v1-casos-qa.md.
// Regla: una tarjeta está "sucia" si lo que ve Dani difiere de lo último guardado.

const base = (parametros: ParametrosCampania | null | undefined, habilitada = true) => ({ habilitada, parametros });
const sucia = (a: ParametrosCampania | null | undefined, b: ParametrosCampania | null | undefined) =>
  hayCambios(base(a), base(b));

describe('comparación de cambios (¿la tarjeta está sucia?)', () => {
  it('FC1: dos objetos distintos con los mismos valores son iguales', () => {
    const a: ParametrosCampania = { ventana_dias: 30, cooldown_dias: 15 };
    const b: ParametrosCampania = { ventana_dias: 30, cooldown_dias: 15 };

    expect(a).not.toBe(b);
    expect(sucia(a, b)).toBe(false);
  });

  it('FC2: mismas claves en otro orden son iguales', () => {
    expect(sucia({ ventana_dias: 30, cooldown_dias: 15 }, { cooldown_dias: 15, ventana_dias: 30 })).toBe(false);
  });

  it('FC3: ausente, undefined y "" son el mismo vacío, en los dos sentidos', () => {
    const conValor = { umbral_winback_dias: 90 };
    const pares: [ParametrosCampania, ParametrosCampania][] = [
      [conValor, { ...conValor, incentivo: '' }],
      [{ ...conValor, incentivo: undefined }, { ...conValor, incentivo: '' }],
      [conValor, { ...conValor, incentivo: undefined }],
    ];

    for (const [a, b] of pares) {
      expect(sucia(a, b)).toBe(false);
      expect(sucia(b, a)).toBe(false);
    }
  });

  it('FC4: vacío contra algo con contenido es un cambio (incluido el 0, el false y los espacios)', () => {
    expect(sucia({ incentivo: '' }, { incentivo: 'hola' })).toBe(true);
    expect(sucia({}, { incentivo: 'hola' })).toBe(true);
    expect(sucia({ incentivo: 'hola' }, { incentivo: '' })).toBe(true);    // borrar un texto que tenía algo
    expect(sucia({}, { ventana_dias: 0 })).toBe(true);
    expect(valoresIguales(0, '')).toBe(false);
    expect(valoresIguales(0, undefined)).toBe(false);
    expect(valoresIguales(false, undefined)).toBe(false);
    // Q3: los espacios no se recortan
    expect(valoresIguales('   ', '')).toBe(false);
    expect(esVacio('   ')).toBe(false);
  });

  it('FC5 (Q2): null y [] también son vacío', () => {
    expect(esVacio(null)).toBe(true);
    expect(esVacio([])).toBe(true);
    expect(sucia({ incentivo: null as unknown as string }, { incentivo: '' })).toBe(false);
    expect(sucia({ incentivo: null as unknown as string }, {})).toBe(false);
    expect(sucia({ reglas_tags: [] }, {})).toBe(false);
    expect(sucia({}, { reglas_tags: [] })).toBe(false);
    // parámetros enteros en null / ausentes
    expect(parametrosIguales(null, {})).toBe(true);
    expect(parametrosIguales(undefined, { incentivo: '' })).toBe(true);
  });

  it('FC6: prender o apagar cuenta como cambio aunque los parámetros sean iguales', () => {
    const p = { ventana_dias: 30 };
    expect(hayCambios(base(p, true), base({ ...p }, false))).toBe(true);
    expect(hayCambios(base(p, false), base({ ...p }, true))).toBe(true);
    expect(hayCambios(base(p, true), base({ ...p }, true))).toBe(false);
  });

  it('FC7: reglas_tags se compara por contenido y orden', () => {
    const t = { tag: 'tratamiento', delay_dias: 7 };
    const c = { tag: 'color', delay_dias: 20 };

    expect(sucia({ reglas_tags: [t, c] }, { reglas_tags: [{ ...t }, { ...c }] })).toBe(false);   // (a)
    expect(sucia({ reglas_tags: [t, c] }, { reglas_tags: [c, t] })).toBe(true);                   // (b) reordenado
    expect(sucia({ reglas_tags: [t, c] }, { reglas_tags: [t] })).toBe(true);                      // (c) uno de menos
    expect(sucia({ reglas_tags: [t] }, { reglas_tags: [t, c] })).toBe(true);                      // (c) uno de más
    expect(sucia({ reglas_tags: [t] }, { reglas_tags: [{ ...t, delay_dias: 8 }] })).toBe(true);   // (d) valor interno
    expect(sucia({ reglas_tags: [] }, { reglas_tags: [] })).toBe(false);                          // (e)
  });

  it('FC8: dentro de cada regla, el orden de las claves no importa', () => {
    const a = { reglas_tags: [{ tag: 'tratamiento', delay_dias: 7 }] };
    const b = { reglas_tags: [{ delay_dias: 7, tag: 'tratamiento' }] };

    expect(sucia(a, b)).toBe(false);
  });
});

describe('validación (CS17, CS18)', () => {
  it('CS17: cada campo numérico que muestra la tarjeta tiene que ser un número ≥ 1', () => {
    expect(erroresParametros('recencia', { ventana_dias: 30, cooldown_dias: 15 })).toEqual({});
    expect(erroresParametros('recencia', { ventana_dias: 1, cooldown_dias: 1 })).toEqual({});        // el borde es válido

    for (const invalido of [undefined, null, 0, 0.5, -3, Number.NaN]) {
      const errores = erroresParametros('recencia', { ventana_dias: invalido as number, cooldown_dias: 15 });
      expect(errores, `ventana_dias = ${invalido}`).toEqual({ ventana_dias: ERROR_NUMERO });
    }
    expect(ERROR_NUMERO).toBe('Completá un número mayor a 0');

    // Parámetros vacíos: todos los numéricos del tipo fallan, y solo esos
    expect(Object.keys(erroresParametros('winback', null)).sort()).toEqual(['cooldown_dias', 'max_intentos', 'umbral_winback_dias']);
    expect(Object.keys(erroresParametros('turno_abandonado', {})).sort()).toEqual(['dias_post_cancelacion', 'horas_pendiente']);
  });

  it('CS17: el beneficio de win-back es opcional y no se valida', () => {
    const base = { umbral_winback_dias: 90, max_intentos: 2, cooldown_dias: 30 };
    expect(erroresParametros('winback', { ...base, incentivo: '' })).toEqual({});
    expect(erroresParametros('winback', base)).toEqual({});
  });

  it('CS18: cada regla por tag necesita tag (no solo espacios) y días ≥ 1; sin reglas no hay error', () => {
    const ok = { tag: 'tratamiento', delay_dias: 7 };

    expect(erroresParametros('seguimiento_producto', { reglas_tags: [ok] })).toEqual({});
    expect(erroresParametros('seguimiento_producto', { reglas_tags: [] })).toEqual({});
    expect(erroresParametros('seguimiento_producto', {})).toEqual({});
    expect(erroresParametros('seguimiento_producto', {
      reglas_tags: [ok, { tag: '', delay_dias: 7 }, { tag: '   ', delay_dias: 7 }, { tag: 'color', delay_dias: 0 }, ok],
    })).toEqual({
      'reglas_tags.1': ERROR_REGLA,
      'reglas_tags.2': ERROR_REGLA,
      'reglas_tags.3': ERROR_REGLA,
    });
    expect(ERROR_REGLA).toBe('Completá el tag y los días');
  });

  it('tieneErrores: solo cuenta los errores con texto', () => {
    expect(tieneErrores({})).toBe(false);
    expect(tieneErrores({ ventana_dias: undefined })).toBe(false);
    expect(tieneErrores({ ventana_dias: ERROR_NUMERO })).toBe(true);
  });
});

describe('lo que queda después de guardar (CS16, Q5)', () => {
  const enviado = { habilitada: true, parametros: { reglas_tags: [{ tag: 'Tratamiento', delay_dias: 7 }], incentivo: ' 20% ' } };

  it('CS16: la respuesta del backend pisa lo enviado (tags en minúscula, texto recortado)', () => {
    const respuesta = { habilitada: true, parametros: { reglas_tags: [{ tag: 'tratamiento', delay_dias: 7 }], incentivo: '20%' } };

    expect(estadoTrasGuardar(enviado, respuesta)).toEqual(respuesta);
  });

  it('CS16: si la respuesta no trae una clave o no trae habilitada, se conserva lo enviado', () => {
    expect(estadoTrasGuardar(enviado, { parametros: { incentivo: '20%' } })).toEqual({
      habilitada: true,
      parametros: { reglas_tags: [{ tag: 'Tratamiento', delay_dias: 7 }], incentivo: '20%' },
    });
    expect(estadoTrasGuardar(enviado, null)).toEqual(enviado);
    expect(estadoTrasGuardar(enviado, { habilitada: false })).toEqual({ ...enviado, habilitada: false });
  });

  it('CS16: la config que guarda la página conserva tipo y prioridad aunque el PUT no los traiga (o traiga otros)', () => {
    const previa = conf('seguimiento_producto', 3, false, { reglas_tags: [] });
    const respuesta = { tipo: 'recencia' as const, prioridad: undefined as unknown as number, habilitada: true, parametros: { reglas_tags: [] } };

    const guardada = fusionarConfigGuardada(previa, enviado, respuesta);
    expect(guardada.tipo).toBe('seguimiento_producto');
    expect(guardada.prioridad).toBe(3);
    expect(guardada.habilitada).toBe(true);
    expect(guardada.id).toBe(previa.id);
  });
});

describe('conjunto de tarjetas sucias', () => {
  it('agrega y quita tipos, y devuelve la misma referencia si no cambia nada', () => {
    const vacio: ReadonlySet<string> = new Set();

    const conRecencia = actualizarTiposSucios(vacio, 'recencia', true);
    expect([...conRecencia]).toEqual(['recencia']);
    expect(actualizarTiposSucios(conRecencia, 'recencia', true)).toBe(conRecencia);
    expect(actualizarTiposSucios(vacio, 'recencia', false)).toBe(vacio);

    const sinRecencia = actualizarTiposSucios(conRecencia, 'recencia', false);
    expect(sinRecencia.size).toBe(0);
    expect([...conRecencia]).toEqual(['recencia']);   // no muta el anterior
  });
});
