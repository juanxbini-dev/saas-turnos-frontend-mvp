import { describe, it, expect } from 'vitest';

// Testigo del huso de la suite (vitest.config.ts → test.env.TZ).
//
// Este archivo NO fija el huso a mano a propósito: prueba que la configuración
// global alcanza. Si alguien saca `env.TZ` del config, o el entorno no lo
// respeta, esto se pone rojo en un CI en UTC en vez de dejar que los tests de
// fechas pasen sin probar nada.

describe('huso de la suite', () => {
  it('process.env.TZ viene fijado por la configuración de Vitest', () => {
    expect(process.env.TZ).toBe('America/Argentina/Buenos_Aires');
  });

  it('el runtime lo respeta: Argentina es UTC-3 todo el año', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(180);
    // (No se compara el nombre que resuelve Intl: ICU lo canoniza como
    // 'America/Buenos_Aires' según la versión, y lo que importa es el offset.)
  });

  it("new Date('2026-08-01') cae en el día 31: el entorno delata el bug de corrimiento", () => {
    // 'YYYY-MM-DD' se interpreta como medianoche UTC → 21:00 del día anterior en Argentina
    const fecha = new Date('2026-08-01');
    expect(fecha.getDate()).toBe(31);
    expect(fecha.getMonth()).toBe(6);   // julio
  });
});
