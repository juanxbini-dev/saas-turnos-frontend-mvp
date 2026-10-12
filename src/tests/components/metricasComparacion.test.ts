import { describe, it, expect } from 'vitest';
import { comparacionDe } from '../../components/metricas/metricasComparacion';

describe('comparacionDe', () => {
  const hoy = new Date(2026, 9, 12); // 12 oct 2026

  it('mes en curso: compara con el mes anterior hasta el mismo día', () => {
    expect(comparacionDe(new Date(2026, 9, 1), 'mes', hoy)).toEqual({
      periodo: { fecha_desde: '2026-09-01', fecha_hasta: '2026-09-12' },
      etiqueta: 'vs 1–12 sep',
    });
  });

  it('mes cerrado: compara con el mes anterior completo', () => {
    expect(comparacionDe(new Date(2026, 8, 1), 'mes', hoy)).toEqual({
      periodo: { fecha_desde: '2026-08-01', fecha_hasta: '2026-08-31' },
      etiqueta: 'vs mes anterior',
    });
  });

  it('el día 31 se corta en el último día del mes anterior', () => {
    expect(comparacionDe(new Date(2026, 9, 1), 'mes', new Date(2026, 9, 31)).periodo).toEqual({
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
    });
    expect(comparacionDe(new Date(2028, 2, 1), 'mes', new Date(2028, 2, 30)).periodo.fecha_hasta).toBe('2028-02-29');
  });

  it('enero en curso compara con diciembre del año anterior', () => {
    expect(comparacionDe(new Date(2027, 0, 1), 'mes', new Date(2027, 0, 5))).toEqual({
      periodo: { fecha_desde: '2026-12-01', fecha_hasta: '2026-12-05' },
      etiqueta: 'vs 1–5 dic',
    });
  });

  it('año en curso: compara con el año anterior hasta la misma fecha', () => {
    expect(comparacionDe(new Date(2026, 0, 1), 'anio', hoy)).toEqual({
      periodo: { fecha_desde: '2025-01-01', fecha_hasta: '2025-10-12' },
      etiqueta: 'vs 2025 al 12 oct',
    });
  });

  it('año cerrado: compara con el año anterior completo', () => {
    expect(comparacionDe(new Date(2025, 0, 1), 'anio', hoy)).toEqual({
      periodo: { fecha_desde: '2024-01-01', fecha_hasta: '2024-12-31' },
      etiqueta: 'vs año anterior',
    });
  });
});
