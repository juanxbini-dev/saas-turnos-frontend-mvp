import { describe, expect, it } from 'vitest';
import { agruparPares, coincideBusqueda, elegiblesCon, ordenarGrupos } from '../../components/clientes/gruposDuplicados';
import type { FichaDuplicado, ParDuplicado } from '../../types/clienteDuplicados.types';

const ficha = (id: string, nombre: string, turnos = 0): FichaDuplicado => ({
  id, nombre, telefono: null, email: null, creado_at: '2026-10-01T12:00:00.000Z',
  turnos, turnos_futuros: 0, ventas: 0, ultima_visita: null, canal: 'panel',
});

const par = (categoria: ParDuplicado['categoria'], a: FichaDuplicado, b: FichaDuplicado, decision: ParDuplicado['decision'] = 'pendiente'): ParDuplicado => ({
  categoria, motivos: ['nombre'], decision, cambio_desde_revision: false,
  grupo_mixto: false, decidido_at: null, responsable_id: null, a, b,
});

const ids = (g: { fichas: FichaDuplicado[] }) => g.fichas.map((f) => f.id).sort();

describe('ordenarGrupos y coincideBusqueda', () => {
  const fuerte = agruparPares([par('fuerte', ficha('f1', 'Ariel Vega', 1), ficha('f2', 'Ariel Vega'))])[0];
  const aCorroborar = agruparPares([par('a_corroborar', ficha('c1', 'Abril Ruiz', 9), ficha('c2', 'Abril Ruiz'))])[0];

  it('por categoría, las coincidencias fuertes van primero', () => {
    const ordenados = ordenarGrupos([aCorroborar, fuerte], 'categoria');
    expect(ordenados[0].id).toBe(fuerte.id);
  });

  it('por nombre, va por orden alfabético', () => {
    const ordenados = ordenarGrupos([fuerte, aCorroborar], 'nombre');
    expect(ordenados[0].fichas[0].nombre).toBe('Abril Ruiz');
  });

  it('por turnos, primero la persona con más turnos', () => {
    const ordenados = ordenarGrupos([fuerte, aCorroborar], 'turnos');
    expect(ordenados[0].fichas[0].nombre).toBe('Abril Ruiz');
  });

  it('la búsqueda encuentra por nombre, por teléfono de los dígitos y por mail', () => {
    expect(coincideBusqueda(fuerte, 'vega')).toBe(true);
    expect(coincideBusqueda(fuerte, '2915')).toBe(false); // sin teléfono cargado en estas fichas
    expect(coincideBusqueda(aCorroborar, 'ruiz')).toBe(true);
    expect(coincideBusqueda(aCorroborar, 'nadie')).toBe(false);
    expect(coincideBusqueda(fuerte, '')).toBe(true);
  });
});

describe('agruparPares', () => {
  it('tres fichas que coinciden todas con todas forman una sola persona', () => {
    const a = ficha('a', 'Agustin Alvarez', 5);
    const b = ficha('b', 'Agustin Alvarez');
    const c = ficha('c', 'Agustin Fabian Alvarez', 2);
    const grupos = agruparPares([par('fuerte', a, b), par('fuerte', a, c), par('a_corroborar', b, c)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fichas.map((f) => f.id)).toEqual(['a', 'c', 'b']); // ordenadas por turnos
    expect(grupos[0].sinUnir).toBe(false);
    expect(grupos[0].pares).toHaveLength(3);
  });

  it('A con B y A con C, sin nada entre B y C: no son una persona de tres, son dos tarjetas', () => {
    const a = ficha('a', 'Agustin Alvarez', 5);
    const b = ficha('b', 'Agustin Alvarez');
    const c = ficha('c', 'Agus Alvarez', 2);
    const grupos = agruparPares([par('fuerte', a, b), par('a_corroborar', a, c)]);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.fichas.length === 2)).toBe(true);
    expect(grupos.every((g) => !g.sinUnir)).toBe(true);
  });

  it('A-B y B-C sin A-C: la principal B no arrastra a A y a C a un mismo grupo por cadena', () => {
    // A y C no tienen nada en común: B es el único enlace
    const a = ficha('a', 'Ana Lopez', 3);
    const b = ficha('b', 'Ana', 5);
    const c = ficha('c', 'Ana Gomez', 0);
    const grupos = agruparPares([par('fuerte', a, b), par('a_corroborar', b, c)]);
    expect(grupos).toHaveLength(2);
    const conA = grupos.find((g) => g.fichas.some((f) => f.id === 'a'))!;
    expect(ids(conA)).toEqual(['a', 'b']);
    // Con B como principal, solo se puede unir A (su coincidencia directa), nunca C
    expect(elegiblesCon(conA, 'b')).toEqual(['a']);
  });

  it('un contacto compartido entre dos personas no las une: quedan en tarjetas aparte', () => {
    // Juan Cruz Bini comparte teléfono con Martina y con Circuito Hoy: no son la misma persona
    const juan = ficha('j', 'Juan Cruz Bini', 45);
    const martina = ficha('m', 'Martina Bini', 3);
    const circuito = ficha('c', 'Circuito Hoy', 1);
    const grupos = agruparPares([par('contacto_compartido', juan, martina), par('contacto_compartido', juan, circuito)]);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.sinUnir)).toBe(true);
    expect(grupos.every((g) => g.fichas.length === 2)).toBe(true);
  });

  it('una cadena de coincidencias fuertes no se corta por un contacto compartido aparte', () => {
    const a = ficha('a', 'Ariel Vega', 3);
    const b = ficha('b', 'Ariel Vega');
    const otra = ficha('o', 'Sofia Michel');
    const grupos = agruparPares([par('fuerte', a, b), par('contacto_compartido', b, otra)]);
    const principal = grupos.find((g) => !g.sinUnir)!;
    expect(principal.fichas.map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(grupos.filter((g) => g.sinUnir)).toHaveLength(1);
  });

  it('madre e hija que solo comparten teléfono: tarjeta aparte, sin nada para unir', () => {
    const madre = ficha('m', 'Maria Lopez', 6);
    const hija = ficha('h', 'Lucia Lopez', 0);
    const grupos = agruparPares([par('contacto_compartido', madre, hija)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].sinUnir).toBe(true);
    expect(grupos[0].directos).toEqual([]);
    expect(elegiblesCon(grupos[0], 'm')).toEqual([]);
  });

  it('un contacto compartido dentro de una tarjeta no es coincidencia directa: no se marca para unir', () => {
    // M y X coinciden, X y H coinciden, pero M y H solo comparten teléfono (nombres distintos)
    const m = ficha('m', 'Maria Lopez', 6);
    const x = ficha('x', 'Maria', 1);
    const h = ficha('h', 'Lucia Maria', 0);
    const grupos = agruparPares([par('fuerte', m, x), par('fuerte', x, h), par('contacto_compartido', m, h)]);
    expect(grupos.some((g) => g.fichas.length === 3)).toBe(false);
    const conM = grupos.find((g) => !g.sinUnir && g.fichas.some((f) => f.id === 'm'))!;
    expect(ids(conM)).toEqual(['m', 'x']);
    expect(elegiblesCon(conM, 'm')).toEqual(['x']);
  });

  it('un par marcado como personas distintas no une aunque sea fuerte, y parte la tarjeta', () => {
    const a = ficha('a', 'Agus Perez', 1);
    const b = ficha('b', 'Agus Perez', 4);
    const c = ficha('c', 'Agus P.', 2);
    const grupos = agruparPares([
      par('fuerte', a, b),
      par('fuerte', a, c),
      par('fuerte', b, c, 'personas_distintas'),
    ]);
    expect(grupos.some((g) => !g.sinUnir && g.fichas.length === 3)).toBe(false);
    const separado = grupos.find((g) => g.sinUnir)!;
    expect(ids(separado)).toEqual(['b', 'c']);
    expect(separado.directos).toEqual([]);
  });
});
