import { describe, it, expect } from 'vitest';
import {
  MOTIVOS_EXCLUSION,
  CLASES_TONO,
  motivoExclusion,
  recibiria,
  detalleContexto,
  ordenarCandidatos,
  armarBloques,
  resumirVistaPrevia,
  textoResumenRecibirian,
  textoResumenAfuera,
  textoContadoresBloque,
  opcionesSelectorCampanias,
  avisoSistemaVistaPrevia,
} from '../../components/campanias/vistaPrevia';
import { ordenarPorPrioridad, etiquetaPrioridad } from '../../components/campanias/prioridad';
import type { CandidatoDryRun, ContextoCandidato, DryRunResponse, TipoCampania } from '../../types/campania.types';
import { CONFIG, ESCENARIO, cand } from '../fixtures/campanias.fixtures';

// Casos FM, FD y la parte pura de VP de backend/docs/campanias-frontend-v1-casos-qa.md.

// Cualquier cosa que delate un dato faltante mal armado
// (separador al principio/final o doble, texto técnico, paréntesis vacío, "hace días" sin número, espacios en los bordes)
const SEPARADOR_SUELTO = /^\s*·|·\s*$|·\s*·|undefined|null|NaN|\(\s*\)|hace\s+días?\b|^\s|\s$/;

describe('FM: texto y color del motivo', () => {
  it('FM1: los 8 códigos de la spec dan su texto y su tono', () => {
    const esperado: [string | null, string, 'positivo' | 'aviso' | 'gris'][] = [
      [null, 'Recibiría el mensaje', 'positivo'],
      ['turno_proximo', 'Tiene un turno cerca: espera', 'aviso'],
      ['cap_diario', 'Hoy ya recibe otro mensaje', 'aviso'],
      ['cooldown', 'Recibió uno parecido hace poco', 'gris'],
      ['dedupe_referencia', 'Ya recibió este mensaje', 'gris'],
      ['opt_out', 'Se dio de baja', 'gris'],
      ['cliente_inactivo', 'Cliente inactivo', 'gris'],
      ['sin_telefono', 'Sin teléfono válido', 'gris'],
    ];

    for (const [codigo, texto, tono] of esperado) {
      expect(motivoExclusion(codigo)).toEqual({ texto, tono });
    }
    expect(Object.keys(MOTIVOS_EXCLUSION)).toHaveLength(7);

    // El tono se ve: verde = le llega, ámbar = espera, gris = no
    expect(CLASES_TONO.positivo).toContain('green');
    expect(CLASES_TONO.aviso).toContain('amber');
    expect(CLASES_TONO.gris).toContain('gray');
  });

  it('FM2: un código desconocido o vacío se muestra en gris y nunca cuenta como "recibiría"', () => {
    expect(motivoExclusion('motivo_nuevo')).toEqual({ texto: 'motivo_nuevo', tono: 'gris' });
    expect(motivoExclusion('').tono).toBe('gris');
    expect(recibiria({ excluido: 'motivo_nuevo' })).toBe(false);
    expect(recibiria({ excluido: '' })).toBe(false);
    // Códigos que coinciden con propiedades de Object no se confunden con motivos conocidos
    expect(motivoExclusion('toString')).toEqual({ texto: 'toString', tono: 'gris' });
  });

  it('FM2 (Q4): excluido ausente NO significa "recibiría" (solo null)', () => {
    const sinCampo = { excluido: undefined as unknown as string | null };

    expect(recibiria(sinCampo)).toBe(false);
    expect(motivoExclusion(undefined).tono).not.toBe('positivo');
    expect(resumirVistaPrevia({ recencia: [{ ...cand('c-9', 'Sin motivo', null), excluido: undefined as unknown as null }] }))
      .toEqual({ recibirian: 0, afuera: 1 });
  });
});

describe('FD: detalle del contexto en una línea', () => {
  it('FD1: turno abandonado, pendiente y cancelado', () => {
    const c = { servicio: 'Alisado', turno_fecha: '18/09' };

    expect(detalleContexto('turno_abandonado', { ...c, variante: 'pendiente' })).toBe('Alisado · turno 18/09 (sin confirmar)');
    expect(detalleContexto('turno_abandonado', { ...c, variante: 'cancelado' })).toBe('Alisado · turno 18/09 (cancelado)');
  });

  it('FD2: los demás tipos con todos sus campos', () => {
    expect(detalleContexto('post_servicio', { servicio: 'Alisado', turno_fecha: '18/09' })).toBe('Alisado · 18/09');
    expect(detalleContexto('recencia', { servicio_habitual: 'Corte', dias_desde_ultima_visita: 45 })).toBe('Corte · hace 45 días');
    expect(detalleContexto('winback', { dias_desde_ultima_visita: 120, nro_intento: 2 })).toBe('hace 120 días · intento 2');
    expect(detalleContexto('seguimiento_producto', { producto: 'Shampoo X', fecha_compra: '02/08' })).toBe('Shampoo X · compra 02/08');
    expect(detalleContexto('reposicion_producto', { producto: 'Shampoo X', fecha_compra: '02/08' })).toBe('Shampoo X · compra 02/08');
  });

  it('FD3: un campo faltante (ausente, null o "") se omite sin dejar separadores sueltos', () => {
    const casos: [TipoCampania, ContextoCandidato, string][] = [
      ['turno_abandonado', { turno_fecha: '18/09', variante: 'pendiente' }, 'turno 18/09 (sin confirmar)'],
      ['turno_abandonado', { servicio: 'Alisado', variante: 'cancelado' }, 'Alisado (cancelado)'],
      ['turno_abandonado', { servicio: '', turno_fecha: null as unknown as string, variante: 'pendiente' }, '(sin confirmar)'],   // Q14
      ['turno_abandonado', { servicio: 'Alisado', turno_fecha: '18/09' }, 'Alisado · turno 18/09'],
      ['turno_abandonado', { servicio: 'Alisado', turno_fecha: '18/09', variante: 'rara' }, 'Alisado · turno 18/09'],
      ['post_servicio', { servicio: 'Alisado' }, 'Alisado'],
      ['post_servicio', { turno_fecha: '10/09' }, '10/09'],
      ['recencia', { dias_desde_ultima_visita: 45 }, 'hace 45 días'],
      ['recencia', { servicio_habitual: 'Corte', dias_desde_ultima_visita: null as unknown as number }, 'Corte'],
      ['winback', { dias_desde_ultima_visita: 120 }, 'hace 120 días'],
      ['winback', { nro_intento: 2 }, 'intento 2'],
      ['seguimiento_producto', { fecha_compra: '02/08' }, 'compra 02/08'],
      ['reposicion_producto', { producto: 'Shampoo X', fecha_compra: '' }, 'Shampoo X'],
    ];

    for (const [tipo, contexto, esperado] of casos) {
      const linea = detalleContexto(tipo, contexto);
      expect(linea, `${tipo} ${JSON.stringify(contexto)}`).toBe(esperado);
      expect(linea).not.toMatch(SEPARADOR_SUELTO);
    }
  });

  it('FD4: contexto vacío, null o ausente da una línea vacía en todos los tipos', () => {
    const tipos: TipoCampania[] = ['turno_abandonado', 'post_servicio', 'seguimiento_producto', 'reposicion_producto', 'recencia', 'winback'];
    for (const tipo of tipos) {
      expect(detalleContexto(tipo, {})).toBe('');
      expect(detalleContexto(tipo, null)).toBe('');
      expect(detalleContexto(tipo, undefined)).toBe('');
    }
    expect(detalleContexto('campania_nueva', { servicio: 'Alisado' })).toBe('');   // tipo desconocido
  });

  it('FD5 (Q10): el 0 se muestra y "1 día" va en singular', () => {
    expect(detalleContexto('recencia', { servicio_habitual: 'Corte', dias_desde_ultima_visita: 0 })).toBe('Corte · hace 0 días');
    expect(detalleContexto('winback', { dias_desde_ultima_visita: 1, nro_intento: 0 })).toBe('hace 1 día · intento 0');
  });

  it('FD6: campos que no son del tipo no aparecen (ni el link de reserva)', () => {
    const todo: ContextoCandidato = {
      servicio: 'Alisado', turno_fecha: '18/09', variante: 'pendiente', servicio_habitual: 'Corte',
      dias_desde_ultima_visita: 120, incentivo: '20% off', nro_intento: 2, producto: 'Shampoo X',
      fecha_compra: '02/08', link_reserva: 'https://reservas.example/abc',
    };

    expect(detalleContexto('winback', todo)).toBe('hace 120 días · intento 2');
    expect(detalleContexto('recencia', todo)).toBe('Corte · hace 120 días');
    expect(detalleContexto('post_servicio', todo)).toBe('Alisado · 18/09');
  });
});

describe('VP (lógica pura): resumen, bloques y selector', () => {
  it('VP6/VP7 (Q1): clientes únicos por cliente_id; N + M = clientes distintos', () => {
    // Escenario: c-1 recibe una y queda afuera de otra por tope; c-2 elegible en dos; c-1 y c-5 se llaman igual
    expect(resumirVistaPrevia(ESCENARIO)).toEqual({ recibirian: 3, afuera: 2 });
    expect(resumirVistaPrevia({})).toEqual({ recibirian: 0, afuera: 0 });
  });

  it('VP8: bloques en orden de prioridad (no el del JSON), con su prioridad y contadores por fila', () => {
    const bloques = armarBloques(ESCENARIO, CONFIG);

    expect(bloques.map((b) => [b.tipo, b.prioridad, b.recibirian, b.afuera])).toEqual([
      ['turno_abandonado', 1, 1, 1],
      ['post_servicio', 2, 2, 0],
      ['seguimiento_producto', 3, 1, 0],
      ['recencia', 5, 0, 2],
      ['winback', 6, 0, 0],
    ]);
    expect(bloques[0].titulo).toBe('Turno abandonado');
  });

  it('VP9 (Q15): primero los que recibirían, después los excluidos, respetando el orden del backend', () => {
    const lista: CandidatoDryRun[] = [
      cand('x1', 'Excluida 1', 'cooldown'),
      cand('r1', 'Recibe 1', null),
      cand('x2', 'Excluida 2', 'opt_out'),
      cand('r2', 'Recibe 2', null),
    ];

    expect(ordenarCandidatos(lista).map((c) => c.cliente_id)).toEqual(['r1', 'r2', 'x1', 'x2']);
    expect(lista.map((c) => c.cliente_id)).toEqual(['x1', 'r1', 'x2', 'r2']);   // no muta la original
  });

  it('VP13: con una campaña puntual, si la respuesta no la trae igual hay un bloque vacío', () => {
    const bloques = armarBloques({}, CONFIG, 'reposicion_producto');

    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ tipo: 'reposicion_producto', prioridad: 4, recibirian: 0, afuera: 0, candidatos: [] });
    expect(armarBloques({}, CONFIG)).toEqual([]);   // "Todas" sin nada prendido → sin bloques
  });

  it('VP19 (Q17): una campaña desconocida en la respuesta se ignora (ni bloque ni conteo)', () => {
    const data = { ...ESCENARIO, campania_nueva: [cand('c-99', 'Desconocida', null)] } as unknown as DryRunResponse;

    expect(armarBloques(data, CONFIG).map((b) => b.tipo)).not.toContain('campania_nueva');
    expect(resumirVistaPrevia(data)).toEqual({ recibirian: 3, afuera: 2 });
  });

  it('Q10: los textos van en singular con 1', () => {
    expect(textoResumenRecibirian(1)).toBe('1 cliente recibiría un mensaje hoy');
    expect(textoResumenRecibirian(0)).toBe('0 clientes recibirían un mensaje hoy');
    expect(textoResumenRecibirian(3)).toBe('3 clientes recibirían un mensaje hoy');
    expect(textoResumenRecibirian(1, true)).toBe('1 cliente recibiría un mensaje si la prendieras');
    expect(textoResumenRecibirian(4, true)).toBe('4 clientes recibirían un mensaje si la prendieras');
    expect(textoResumenAfuera(1)).toBe('1 cliente queda afuera');
    expect(textoResumenAfuera(2)).toBe('2 clientes quedan afuera');
    expect(textoResumenAfuera(0)).toBe('0 clientes quedan afuera');
    expect(textoContadoresBloque(1, 1)).toBe('1 recibiría · 1 queda afuera');
    expect(textoContadoresBloque(2, 1)).toBe('2 recibirían · 1 queda afuera');
    expect(textoContadoresBloque(0, 2)).toBe('0 recibirían · 2 quedan afuera');
  });

  it('VP20: la línea del sistema según esté apagado, en simulación, en prueba o enviando de verdad', () => {
    expect(avisoSistemaVistaPrevia({ enabled: false, modo: 'live' })).toBe(
      'Hoy el sistema de campañas está apagado: no se envía nada. Esto muestra a quién le escribiría.'
    );
    expect(avisoSistemaVistaPrevia({ enabled: true, modo: 'shadow' })).toBe(
      'El sistema está en modo simulación: no se envía nada. Esto muestra a quién le escribiría.'
    );
    expect(avisoSistemaVistaPrevia({ enabled: true, modo: 'whitelist' })).toBe(
      'El sistema está en modo prueba: solo salen mensajes a los teléfonos de prueba.'
    );
    expect(avisoSistemaVistaPrevia({ enabled: true, modo: 'live' })).toBeNull();
    expect(avisoSistemaVistaPrevia(null)).toBeNull();
  });

  it('VP1/VP4 (Q16): el selector lista las 6 en orden de prioridad y marca las apagadas según lo guardado', () => {
    const desordenadas = [...CONFIG].reverse();

    expect(opcionesSelectorCampanias(desordenadas).map((o) => o.label)).toEqual([
      'Turno abandonado',
      'Post-servicio',
      'Seguimiento de producto',
      'Reposición de producto (apagada)',
      'Recordatorio por recencia',
      'Win-back (cliente perdido)',
    ]);

    // Si la configuración no trae alguna, igual aparece al final y como apagada
    const incompletas = CONFIG.filter((c) => c.tipo !== 'post_servicio');
    const ultima = opcionesSelectorCampanias(incompletas).at(-1)!;
    expect(ultima).toEqual({ value: 'post_servicio', label: 'Post-servicio (apagada)', apagada: true });
  });
});

describe('CP (lógica pura): prioridad', () => {
  it('CP1/CP4: ordena ascendente sin mutar; las que no traen prioridad van al final en su orden', () => {
    const lista = [
      { id: 'b', prioridad: 2 },
      { id: 'sin-1', prioridad: undefined },
      { id: 'a', prioridad: 1 },
      { id: 'sin-2', prioridad: null },
      { id: 'c', prioridad: 10 },
    ];

    expect(ordenarPorPrioridad(lista).map((x) => x.id)).toEqual(['a', 'b', 'c', 'sin-1', 'sin-2']);
    expect(lista.map((x) => x.id)).toEqual(['b', 'sin-1', 'a', 'sin-2', 'c']);
  });

  it('CP2/CP4: la etiqueta usa el valor de prioridad; sin número válido no hay etiqueta', () => {
    expect(etiquetaPrioridad(1)).toBe('Prioridad 1');
    expect(etiquetaPrioridad(50)).toBe('Prioridad 50');
    expect(etiquetaPrioridad(undefined)).toBeNull();
    expect(etiquetaPrioridad(null)).toBeNull();
    expect(etiquetaPrioridad(Number.NaN)).toBeNull();
  });
});
