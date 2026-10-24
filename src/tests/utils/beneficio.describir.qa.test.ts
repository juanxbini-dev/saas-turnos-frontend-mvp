import { describe, it, expect } from 'vitest';
import { describirBeneficio, describirBeneficioConNombre, esBeneficioOtro } from '../../config/beneficio';

// FE-1 (backend/docs/beneficios-tipos-casos-qa.md): la función compartida que describe un beneficio
// la usan la landing, /beneficio, el chip 🎟, los modales de cobro y el de crear turno. Un error acá
// se ve en todas las pantallas: con un "otro" no puede aparecer "null %", "NaN" ni "descuento".

const DESCUENTO = { nombre: 'Bienvenida', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false };
const REGALO = { nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null, aplica_servicio: true, aplica_productos: false };

const BASURA = /null|NaN|undefined/;

describe('describirBeneficio por tipo (FE-1)', () => {
  it('descuento: porcentaje y a qué aplica', () => {
    expect(describirBeneficio(DESCUENTO)).toBe('20 % en servicios');
    expect(describirBeneficio({ ...DESCUENTO, aplica_servicio: false, aplica_productos: true })).toBe('20 % en productos');
    expect(describirBeneficio({ ...DESCUENTO, aplica_productos: true })).toBe('20 % en servicios y productos');
    expect(describirBeneficio(DESCUENTO, { conPalabraDescuento: true })).toBe('20 % de descuento en servicios');
  });

  it('otro: el nombre tal cual, aunque se pida la palabra "descuento"', () => {
    expect(describirBeneficio(REGALO)).toBe('Ampolla de tratamiento de regalo');
    expect(describirBeneficio(REGALO, { conPalabraDescuento: true })).toBe('Ampolla de tratamiento de regalo');
    expect(describirBeneficioConNombre(REGALO)).toBe('Ampolla de tratamiento de regalo');
    expect(esBeneficioOtro(REGALO)).toBe(true);
  });

  it('resumen con nombre (avisos de la campaña): descuento "Nombre (20 %)"', () => {
    expect(describirBeneficioConNombre(DESCUENTO)).toBe('Bienvenida (20 %)');
  });

  it('nunca imprime null, NaN ni undefined, ni con datos raros o de una respuesta vieja sin tipo', () => {
    const casos = [
      REGALO,
      { ...REGALO, aplica_servicio: undefined, aplica_productos: undefined },
      { ...DESCUENTO, porcentaje: null },                 // descuento roto: cae al nombre
      { nombre: 'Viejo sin tipo', porcentaje: 15 },        // respuesta de antes del cambio
      { nombre: 'Viejo sin tipo ni porcentaje', porcentaje: null },
      { ...REGALO, tipo: null },
    ];
    for (const b of casos) {
      expect(describirBeneficio(b)).not.toMatch(BASURA);
      expect(describirBeneficio(b, { conPalabraDescuento: true })).not.toMatch(BASURA);
      expect(describirBeneficioConNombre(b)).not.toMatch(BASURA);
    }
    // Sin tipo pero con porcentaje: se trata como descuento (sessionStorage de antes del cambio)
    expect(describirBeneficio({ nombre: 'Viejo sin tipo', porcentaje: 15 })).toBe('15 % en servicios');
  });

  it('un "otro" nunca dice "descuento" ni "%"', () => {
    for (const texto of [describirBeneficio(REGALO), describirBeneficio(REGALO, { conPalabraDescuento: true }), describirBeneficioConNombre(REGALO)]) {
      expect(texto).not.toMatch(/descuento|%/i);
    }
  });
});
