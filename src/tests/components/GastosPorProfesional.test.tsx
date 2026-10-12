import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GastosPorProfesional, detalleProfesional } from '../../components/gastos/GastosPorProfesional';
import { totalesDeProfesionales } from '../../services/gastos.service';
import { MemoryRouter } from 'react-router-dom';
import { GastosQueEntro } from '../../components/gastos/GastosQueEntro';
import { formatMoneda } from '../../components/gastos/gastos.utils';
import type { GastosDetalleMes, GastosProfesionalMes } from '../../types/gastos.types';

// Tabla "Por profesional" de backend/docs/gastos-ganancias-spec.md §4.6 (P2, P9).
// Números del ejemplo de §5: A (empleada) y Dani (dueño).

const plano = (s: string) => s.replace(/\s+/g, ' ').trim();
const moneda = (n: number) => plano(formatMoneda(n));
const texto = (el: Element | null) => plano(el?.textContent ?? '');

const prof = (over: Partial<GastosProfesionalMes>): GastosProfesionalMes => ({
  profesional_id: 'p', nombre: 'X', avatar_url: null, es_duenio: false, activo: true,
  facturado_servicios: 0, facturado_productos: 0, facturado: 0,
  a_pagar_servicios: 0, a_pagar_productos: 0, a_pagar: 0, ganancia_salon: 0,
  turnos_cobrados: 0, canjes: 0, unidades_vendidas: 0, pendiente_cobro: 0,
  ...over,
});

const ANA = prof({
  profesional_id: 'p-ana', nombre: 'Ana',
  facturado_servicios: 400000, facturado_productos: 50000, facturado: 450000,
  a_pagar_servicios: 160000, a_pagar_productos: 2000, a_pagar: 162000, ganancia_salon: 288000,
  turnos_cobrados: 20, unidades_vendidas: 5, canjes: 1, pendiente_cobro: 12000,
});
const DANI = prof({
  profesional_id: 'p-dani', nombre: 'Dani Entraigas', es_duenio: true,
  facturado_servicios: 600000, facturado_productos: 30000, facturado: 630000,
  a_pagar: 0, ganancia_salon: 630000, turnos_cobrados: 30, unidades_vendidas: 3,
});
const BELU = prof({
  profesional_id: 'p-belu', nombre: 'Belu', activo: false,
  facturado: 100000, facturado_servicios: 100000, a_pagar: 40000, a_pagar_servicios: 40000, ganancia_salon: 60000,
  turnos_cobrados: 1,
});

vi.mock('../../api/axiosInstance', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const detalle = (profesionales: GastosProfesionalMes[]): GastosDetalleMes => ({
  periodo: '2026-09',
  totales: totalesDeProfesionales(profesionales),
  ingresos: { servicios: 1000000, productos: 80000, total: 1080000, turnos_cobrados: 50, productos_vendidos: 8, pendiente_cobro: 12000 },
  profesionales,
  productos: { costo_vendido: 48000, costo_canjes: 0, unidades: 8 },
  a_pagar_total: 162000,
});

const tabla = () => screen.getByTestId('por-profesional-tabla');
const cards = () => screen.getByTestId('por-profesional-cards');
const col = (el: HTMLElement, c: 'facturo' | 'pagarle' | 'salon') => texto(within(el).getByTestId(`col-${c}`));

describe('GastosPorProfesional', () => {
  it('el dueño va primero, con chip "Dueño", "—" en "Hay que pagarle" y todo en "Le queda al salón"', () => {
    // El dueño llega segundo: la tabla igual lo pone arriba (normalizarDetalle ya
    // ordena, pero el componente recibe lo que le den)
    render(<GastosPorProfesional detalle={detalle([DANI, ANA])} isLoading={false} />);

    const filas = within(tabla()).getAllByTestId(/^prof-fila-/);
    expect(filas[0].getAttribute('data-testid')).toBe('prof-fila-p-dani');
    const dani = filas[0];
    expect(within(dani).getByText('Dueño')).toBeTruthy();
    expect(col(dani, 'pagarle')).toBe('—');
    expect(col(dani, 'facturo')).toBe(moneda(630000));
    expect(col(dani, 'salon')).toBe(moneda(630000));

    const ana = filas[1];
    expect(within(ana).queryByText('Dueño')).toBeNull();
    expect(col(ana, 'facturo')).toBe(moneda(450000));
    expect(col(ana, 'pagarle')).toBe(moneda(162000));
    expect(col(ana, 'salon')).toBe(moneda(288000));
  });

  it('fila de total: facturó = pagarle + salón, y "de eso, $X lo atendiste vos"', () => {
    render(<GastosPorProfesional detalle={detalle([DANI, ANA])} isLoading={false} />);

    const total = within(tabla()).getByTestId('prof-total');
    expect(col(total, 'facturo')).toBe(moneda(1080000));
    expect(col(total, 'pagarle')).toBe(moneda(162000));
    expect(col(total, 'salon')).toContain(moneda(918000));
    expect(texto(within(total).getByTestId('prof-linea-duenio'))).toBe(`de eso, ${moneda(630000)} lo atendiste vos`);
  });

  it('sin dueño en el mes no aparece la línea "lo atendiste vos"', () => {
    render(<GastosPorProfesional detalle={detalle([ANA])} isLoading={false} />);

    expect(screen.queryAllByTestId('prof-linea-duenio')).toHaveLength(0);
  });

  it('debajo del nombre: turnos cobrados, productos vendidos y, si hay, canjes y lo hecho sin cobrar', () => {
    render(<GastosPorProfesional detalle={detalle([DANI, ANA])} isLoading={false} />);

    const ana = within(tabla()).getByTestId('prof-fila-p-ana');
    expect(texto(within(ana).getByTestId('prof-detalle'))).toBe(
      `20 turnos cobrados · 5 productos vendidos · 1 canje · ${moneda(12000)} hecho sin cobrar`,
    );
    const dani = within(tabla()).getByTestId('prof-fila-p-dani');
    expect(texto(within(dani).getByTestId('prof-detalle'))).toBe('30 turnos cobrados · 3 productos vendidos');
  });

  it('un profesional dado de baja muestra la etiqueta', () => {
    render(<GastosPorProfesional detalle={detalle([ANA, BELU])} isLoading={false} />);

    expect(within(within(tabla()).getByTestId('prof-fila-p-belu')).getByText('dado de baja')).toBeTruthy();
    expect(within(within(tabla()).getByTestId('prof-fila-p-ana')).queryByText('dado de baja')).toBeNull();
  });

  it('en celular hay cards (no tabla) con el dueño primero, su chip y el "—"', () => {
    render(<GastosPorProfesional detalle={detalle([DANI, ANA])} isLoading={false} />);

    // La tabla se oculta en celular y las cards en escritorio (Tailwind)
    expect(tabla().className).toContain('hidden md:block');
    expect(cards().className).toContain('md:hidden');

    const lista = within(cards()).getAllByTestId(/^prof-card-/);
    expect(lista.map((c) => c.getAttribute('data-testid'))).toEqual(['prof-card-p-dani', 'prof-card-p-ana']);
    expect(within(lista[0]).getByText('Dueño')).toBeTruthy();
    expect(col(lista[0], 'pagarle')).toBe('—');
    expect(col(lista[1], 'pagarle')).toBe(moneda(162000));

    const total = within(cards()).getByTestId('prof-total-card');
    expect(col(total, 'salon')).toBe(moneda(918000));
    expect(texto(within(total).getByTestId('prof-linea-duenio'))).toContain(moneda(630000));
  });

  it('ganancia negativa (un % mal cargado) se muestra tal cual, con signo', () => {
    const raro = prof({ profesional_id: 'p-raro', nombre: 'Raro', facturado: 1000, a_pagar: 1200, ganancia_salon: -200 });
    render(<GastosPorProfesional detalle={detalle([raro])} isLoading={false} />);

    expect(col(within(tabla()).getByTestId('prof-fila-p-raro'), 'salon')).toBe(`−${moneda(200)}`);
  });

  it('usa los totales que manda el backend, no los recalcula', () => {
    render(<GastosPorProfesional detalle={{ ...detalle([DANI, ANA]), totales: { facturado: 1, a_pagar: 2, ganancia_salon: 3, facturado_duenio: 4 } }} isLoading={false} />);

    const total = within(tabla()).getByTestId('prof-total');
    expect(col(total, 'facturo')).toBe(moneda(1));
    expect(col(total, 'pagarle')).toBe(moneda(2));
    expect(texto(within(total).getByTestId('prof-linea-duenio'))).toBe(`de eso, ${moneda(4)} lo atendiste vos`);
  });

  it('ventas sin vendedor asignado (profesional_id null) se listan sin romper', () => {
    const sin = prof({ profesional_id: null, nombre: 'Sin asignar', facturado: 5000, ganancia_salon: 5000 });
    render(<GastosPorProfesional detalle={detalle([ANA, sin])} isLoading={false} />);

    expect(within(tabla()).getByTestId('prof-fila-sin-asignar')).toBeTruthy();
  });

  it('mes sin movimiento: "Todavía no se cobró nada este mes."', () => {
    render(<GastosPorProfesional detalle={detalle([])} isLoading={false} />);

    expect(screen.getByText('Todavía no se cobró nada este mes.')).toBeTruthy();
    expect(screen.queryByTestId('por-profesional-tabla')).toBeNull();
  });

  it('cargando: skeleton; con error: mensaje y Reintentar', () => {
    const { rerender } = render(<GastosPorProfesional detalle={null} isLoading />);
    expect(screen.getByTestId('gastos-por-profesional-cargando')).toBeTruthy();

    const onReintentar = vi.fn();
    rerender(<GastosPorProfesional detalle={null} isLoading={false} error={new Error('x')} onReintentar={onReintentar} />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el detalle por profesional');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });
});

describe('funciones puras de la tabla', () => {
  it('totalesDeProfesionales suma en centavos (sin arrastre de float) y no cuenta al dueño en "a pagar"', () => {
    const a = prof({ facturado: 0.1, a_pagar: 0.1, ganancia_salon: 0 });
    const b = prof({ facturado: 0.2, a_pagar: 0.2, ganancia_salon: 0 });
    // Un dueño con a_pagar distinto de 0 (no debería venir así) igual no suma
    const d = prof({ es_duenio: true, facturado: 100, a_pagar: 50, ganancia_salon: 100 });
    expect(totalesDeProfesionales([a, b, d])).toEqual({ facturado: 100.3, a_pagar: 0.3, ganancia_salon: 100, facturado_duenio: 100 });
  });

  it('detalleProfesional usa singular cuando corresponde', () => {
    expect(detalleProfesional(prof({ turnos_cobrados: 1, unidades_vendidas: 1 }))).toBe('1 turno cobrado · 1 producto vendido');
  });
});

describe('GastosQueEntro: costo de lo vendido como referencia', () => {
  it('muestra el costo de lo vendido aclarando que no se resta', () => {
    render(<MemoryRouter><GastosQueEntro detalle={detalle([ANA])} isLoading={false} /></MemoryRouter>);

    expect(texto(screen.getByTestId('costo-vendido'))).toBe(`costo de lo vendido ${moneda(48000)} (referencia, no se resta)`);
  });

  it('sin costo no muestra la línea', () => {
    render(<MemoryRouter><GastosQueEntro detalle={{ ...detalle([ANA]), productos: { costo_vendido: 0, costo_canjes: 0, unidades: 0 } }} isLoading={false} /></MemoryRouter>);

    expect(screen.queryByTestId('costo-vendido')).toBeNull();
  });
});
