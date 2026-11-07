import { describe, it, expect } from 'vitest';
import {
  beneficioValeCon, nombreDePila, profesionalesDelBeneficio, textoBeneficioNoAplicaCon, unirNombres,
} from '../../config/beneficio';
import { textoValeCon } from '../../components/beneficios/beneficios.utils';
import { profesionalesDeRespuesta } from '../../hooks/useProfesionalesPanel';

// lista-vieja-cierre D1/D3: helpers del beneficio por profesional.

const CARO = { id: 'u-caro', nombre: 'Caro' };
const JULI = { id: 'u-juli', nombre: 'Juli' };
const MELI = { id: 'u-meli', nombre: 'Meli' };

describe('beneficio por profesional', () => {
  it('beneficioValeCon: con la lista decide; sin el campo (backend viejo) vale con todos; con [] no vale con nadie', () => {
    expect(beneficioValeCon({ profesionales: [CARO] }, 'u-caro')).toBe(true);
    expect(beneficioValeCon({ profesionales: [CARO] }, 'u-juli')).toBe(false);
    expect(beneficioValeCon({}, 'u-juli')).toBe(true);
    expect(beneficioValeCon({ profesionales: null }, 'u-juli')).toBe(true);
    expect(beneficioValeCon({ profesionales: [] }, 'u-juli')).toBe(false);
    expect(beneficioValeCon({ profesionales: [CARO] }, null)).toBe(true);
    expect(beneficioValeCon(null, 'u-juli')).toBe(true);
  });

  it('unirNombres: "A", "A o B", "A, B o C" (y con "y")', () => {
    expect(unirNombres([])).toBe('');
    expect(unirNombres(['Caro'])).toBe('Caro');
    expect(unirNombres(['Caro', 'Juli'])).toBe('Caro o Juli');
    expect(unirNombres(['Caro', 'Juli', 'Meli'])).toBe('Caro, Juli o Meli');
    expect(unirNombres(['Caro', 'Juli', 'Meli'], 'y')).toBe('Caro, Juli y Meli');
  });

  it('nombreDePila: la primera palabra', () => {
    expect(nombreDePila('Carolina Gómez')).toBe('Carolina');
    expect(nombreDePila('  Juli  ')).toBe('Juli');
    expect(nombreDePila(undefined)).toBe('');
  });

  it('textoBeneficioNoAplicaCon: el aviso de D3 (texto de Juan), con nombres de pila', () => {
    expect(textoBeneficioNoAplicaCon([{ id: 'a', nombre: 'Carolina Gómez' }, { id: 'b', nombre: 'Juli Ruiz' }], 'Dani Pérez'))
      .toBe('Este beneficio solo es apto para usar con Carolina o Juli.');
    expect(textoBeneficioNoAplicaCon([CARO, JULI, MELI], 'Dani')).toBe('Este beneficio solo es apto para usar con Caro, Juli o Meli.');
    expect(textoBeneficioNoAplicaCon([CARO])).toBe('Este beneficio solo es apto para usar con Caro.');
    expect(textoBeneficioNoAplicaCon([], 'Dani')).toBe('Este beneficio no se puede usar con ningún profesional por ahora.');
    // Sin la lista (solo ante un 400 del backend)
    expect(textoBeneficioNoAplicaCon(undefined, 'Dani Pérez')).toBe('Este beneficio no es apto para usar con Dani.');
    expect(textoBeneficioNoAplicaCon(undefined)).toBe('Este beneficio no es apto para usar con este profesional.');
  });

  it('profesionalesDelBeneficio: solo { id, nombre } válidos; [] se conserva; sin array = no se sabe', () => {
    expect(profesionalesDelBeneficio([{ ...CARO, extra: 1 }, { id: 3 }, null])).toEqual([CARO]);
    expect(profesionalesDelBeneficio([])).toEqual([]);
    expect(profesionalesDelBeneficio(undefined)).toBeUndefined();
    expect(profesionalesDelBeneficio('x')).toBeUndefined();
  });

  it('textoValeCon (columna de Beneficios): "Caro, Juli y Meli"; sin lista, "Todos"', () => {
    expect(textoValeCon([CARO, JULI, MELI])).toBe('Caro, Juli y Meli');
    expect(textoValeCon([CARO])).toBe('Caro');
    expect(textoValeCon(undefined)).toBe('Todos');
    // Con la lista del panel: si están todos, no se escribe la lista entera
    expect(textoValeCon([CARO, JULI, MELI], [CARO, JULI, MELI])).toBe('Todos los profesionales');
    expect(textoValeCon([CARO, JULI], [CARO, JULI, MELI])).toBe('Caro y Juli');
    expect(textoValeCon([CARO], [CARO])).toBe('Caro');
    expect(textoValeCon([])).toBe('Ningún profesional activo');
  });

  it('profesionalesDeRespuesta: acepta { data: { profesionales } } y { data: [] }, sin super_admin ni inactivos', () => {
    const p = (id: string, roles: string[], activo = true) => ({ id, nombre: id, username: id, email: '', roles, activo });
    expect(profesionalesDeRespuesta({ data: { profesionales: [p('a', ['admin']), p('b', ['super_admin']), p('c', ['staff'], false)] } }).map((x) => x.id)).toEqual(['a']);
    expect(profesionalesDeRespuesta({ data: [p('a', ['staff'])] }).map((x) => x.id)).toEqual(['a']);
    expect(profesionalesDeRespuesta(null)).toEqual([]);
  });
});
