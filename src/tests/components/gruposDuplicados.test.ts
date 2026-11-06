import { describe, expect, it } from 'vitest';
import { agruparPares, coincideBusqueda, ordenarGrupos } from '../../components/clientes/gruposDuplicados';
import type { FichaDuplicado, ParDuplicado } from '../../types/clienteDuplicados.types';

const ficha = (id: string, nombre: string, turnos = 0): FichaDuplicado => ({
  id, nombre, telefono: null, email: null, creado_at: '2026-10-01T12:00:00.000Z',
  turnos, turnos_futuros: 0, ventas: 0, ultima_visita: null, canal: 'panel',
});

const par = (categoria: ParDuplicado['categoria'], a: FichaDuplicado, b: FichaDuplicado): ParDuplicado => ({
  categoria, motivos: ['nombre'], decision: 'pendiente', cambio_desde_revision: false,
  grupo_mixto: false, decidido_at: null, responsable_id: null, a, b,
});

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
  it('une las fichas de una persona en un solo grupo, aunque tengan tres', () => {
    const a = ficha('a', 'Agustin Alvarez', 5);
    const b = ficha('b', 'Agustin Alvarez');
    const c = ficha('c', 'Agustin Fabian Alvarez', 2);
    const grupos = agruparPares([par('fuerte', a, b), par('fuerte', a, c)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fichas.map((f) => f.id)).toEqual(['a', 'c', 'b']); // ordenadas por turnos
    expect(grupos[0].soloContactoCompartido).toBe(false);
  });

  it('un contacto compartido entre dos personas no las une: quedan en tarjetas aparte', () => {
    // Juan Cruz Bini comparte teléfono con Martina y con Circuito Hoy: no son la misma persona
    const juan = ficha('j', 'Juan Cruz Bini', 45);
    const martina = ficha('m', 'Martina Bini', 3);
    const circuito = ficha('c', 'Circuito Hoy', 1);
    const grupos = agruparPares([par('contacto_compartido', juan, martina), par('contacto_compartido', juan, circuito)]);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.soloContactoCompartido)).toBe(true);
    expect(grupos.every((g) => g.fichas.length === 2)).toBe(true);
  });

  it('una cadena de coincidencias fuertes no se corta por un contacto compartido aparte', () => {
    const a = ficha('a', 'Ariel Vega', 3);
    const b = ficha('b', 'Ariel Vega');
    const otra = ficha('o', 'Sofia Michel');
    const grupos = agruparPares([par('fuerte', a, b), par('contacto_compartido', b, otra)]);
    const principal = grupos.find((g) => !g.soloContactoCompartido)!;
    expect(principal.fichas.map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(grupos.filter((g) => g.soloContactoCompartido)).toHaveLength(1);
  });
});
