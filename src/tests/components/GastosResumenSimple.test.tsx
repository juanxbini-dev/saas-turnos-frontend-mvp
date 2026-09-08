import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GastosResumenSimple } from '../../components/gastos/GastosResumenSimple';
import { formatMoneda } from '../../components/gastos/gastos.utils';
import type { GastosDetalleMes, GastosResumen } from '../../types/gastos.types';

// Casos D1–D3 de docs/gastos-v3-casos-qa.md (backend/docs). D4 (Q1) está en el
// backend: GetGastosMetricasUseCase.test.ts.

const plano = (s: string) => s.replace(/\s+/g, ' ').trim();
const moneda = (n: number) => plano(formatMoneda(n));

const RESUMEN: GastosResumen = {
  periodo: '2026-09',
  total_gastos: 1407300, fijos: 870000, variables: 125000, derivados: 412300,
  ingresos: 1080000, neto: -327300, margen_pct: -30.3,
  pagado: 225000, pendiente: 770000,
  ratio_gastos_ingresos: 1.3, acumulado_anio: 9000000, promedio_mensual_anio: 1000000,
  anterior: { total_gastos: 1300000, fijos: 800000, variables: 100000, derivados: 400000, ingresos: 1000000, neto: -300000, margen_pct: -30 },
};

const DETALLE: GastosDetalleMes = {
  periodo: '2026-09',
  ingresos: { servicios: 780000, productos: 300000, total: 1080000, turnos_cobrados: 12, productos_vendidos: 14, pendiente_cobro: 0 },
  comisiones: [], comisiones_total: 385000, mercaderia_costo: 27300, mercaderia_unidades: 14,
};

// La tarjeta es el div.rounded-xl que contiene el título; el subtítulo es el último span
const tarjeta = (titulo: string) => screen.getByText(titulo).closest('div.rounded-xl')!;
const subtituloDe = (titulo: string) => {
  const lineas = Array.from(tarjeta(titulo).querySelectorAll('span')).map((s) => plano(s.textContent ?? ''));
  return lineas[lineas.length - 1];
};

describe('GastosResumenSimple', () => {
  it('D1: "Salió" desglosa pagado, salió solo y falta con los tres campos del resumen', () => {
    render(<GastosResumenSimple resumen={RESUMEN} detalle={DETALLE} isLoading={false} />);

    expect(subtituloDe('Salió')).toBe(`${moneda(225000)} pagado · ${moneda(412300)} salió solo · falta ${moneda(770000)}`);
    expect(plano(tarjeta('Salió').textContent!)).toContain(moneda(1407300));
  });

  it('D2: con pendiente 0 dice "todo pagado" y no muestra "falta $ 0"', () => {
    render(<GastosResumenSimple resumen={{ ...RESUMEN, pendiente: 0, pagado: 995000 }} detalle={DETALLE} isLoading={false} />);

    expect(subtituloDe('Salió')).toBe(`todo pagado · ${moneda(412300)} salió solo`);
    expect(document.body.textContent).not.toMatch(/falta/);
  });

  it('D3: "Entró" muestra turnos cobrados y productos cuando hay detalle', () => {
    render(<GastosResumenSimple resumen={RESUMEN} detalle={DETALLE} isLoading={false} />);

    expect(subtituloDe('Entró')).toBe(`12 turnos cobrados · ${moneda(300000)} en productos`);
  });

  it('D3: sin detalle (todavía carga) muestra la variación contra el mes anterior y no explota', () => {
    render(<GastosResumenSimple resumen={RESUMEN} detalle={null} isLoading={false} />);

    expect(subtituloDe('Entró')).toBe('subió 8% respecto al mes pasado');
  });

  it('D3: sin detalle ni mes anterior tampoco explota', () => {
    render(<GastosResumenSimple resumen={{ ...RESUMEN, anterior: null }} detalle={null} isLoading={false} />);

    expect(subtituloDe('Entró')).toBe('sin mes anterior para comparar');
  });
});
