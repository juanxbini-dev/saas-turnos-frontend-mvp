import { describe, it, expect } from 'vitest';
import { enlaceWhatsapp, textoMotivoAviso } from '../../components/paraContactar/avisos.utils';

describe('enlaceWhatsapp', () => {
  it('deja como viene un número que ya trae el 549', () => {
    expect(enlaceWhatsapp('5492915240411')).toBe('https://wa.me/5492915240411');
  });

  it('le agrega el 549 a un número local de 10 dígitos', () => {
    expect(enlaceWhatsapp('291 524-0411')).toBe('https://wa.me/5492915240411');
    expect(enlaceWhatsapp('1155554444')).toBe('https://wa.me/5491155554444');
  });

  it('sin teléfono o muy corto, no hay link', () => {
    expect(enlaceWhatsapp(null)).toBeNull();
    expect(enlaceWhatsapp('1234')).toBeNull();
  });
});

describe('textoMotivoAviso · producto_mas_o_menos', () => {
  it('dice qué producto y qué opinó', () => {
    expect(textoMotivoAviso({ motivo: 'producto_mas_o_menos', producto: { id: 'p1', nombre: 'Sérum' }, puntuacion: null })).toBe(
      'Dijo «Más o menos» del Sérum'
    );
  });

  it('sin producto (borrado), sigue diciendo qué opinó', () => {
    expect(textoMotivoAviso({ motivo: 'producto_mas_o_menos', producto: null, puntuacion: null })).toBe('Dijo «Más o menos» de un producto');
  });
});
