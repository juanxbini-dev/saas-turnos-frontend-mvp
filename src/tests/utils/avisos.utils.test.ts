import { describe, it, expect } from 'vitest';
import { enlaceWhatsapp } from '../../components/paraContactar/avisos.utils';

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
