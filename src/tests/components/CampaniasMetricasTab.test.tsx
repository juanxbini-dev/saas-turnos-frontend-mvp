import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CampaniasMetricasTab } from '../../components/campanias/CampaniasMetricasTab';
import type { MetricasCampanias } from '../../types/campania.types';

// Casos M1–M7 de backend/docs/campanias-frontend-v1-casos-qa.md.
// Métricas no tiene spec propia: estos tests CARACTERIZAN el comportamiento actual que el
// coordinador definió como referencia (Q11). Si fijan algo raro, está anotado como hallazgo.

const getMetricas = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: { getMetricas: (...args: unknown[]) => getMetricas(...args) },
}));

const fila = (tipo: MetricasCampanias['por_tipo'][number]['tipo'], over: Partial<MetricasCampanias['por_tipo'][number]> = {}) => ({
  tipo, enviados: 0, fallidos: 0, simulados: 0, entregados: 0, leidos: 0, convertidos: 0, tasa_conversion: 0, ...over,
});

const METRICAS: MetricasCampanias = {
  desde: '2026-09-01',
  hasta: '2026-09-30',
  ventana_conversion_dias: 14,
  por_tipo: [
    fila('recencia', { enviados: 8, fallidos: 1, entregados: 7, leidos: 5, convertidos: 1, tasa_conversion: 0.125 }),
    fila('winback', { simulados: 4 }),                 // solo simulados: no va gris, pero Volvieron es "—"
    fila('post_servicio'),                             // nada: fila gris
  ],
  totales: { enviados: 8, fallidos: 1, simulados: 4, entregados: 7, leidos: 5, convertidos: 1, tasa_conversion: 0.125 },
  opt_outs_periodo: 2,
  opt_outs_total: 5,
  ultimos_mensajes: [
    { id: 'm1', tipo: 'recencia', cliente_nombre: 'Sofía López', estado: 'enviado', estado_entrega: 'read', created_at: '2026-09-14T13:00:00Z' },
  ],
};

const SIN_NADA: MetricasCampanias = {
  ...METRICAS,
  por_tipo: [fila('recencia'), fila('winback')],
  totales: { enviados: 0, fallidos: 0, simulados: 0, entregados: 0, leidos: 0, convertidos: 0, tasa_conversion: 0 },
  opt_outs_periodo: 0,
  opt_outs_total: 0,
  ultimos_mensajes: [],
};

// La etiqueta del KPI es un <p>; la tabla también tiene "Enviados"/"Volvieron" pero en <th>
const kpi = (label: string) => screen.getAllByText(label).find((el) => el.tagName === 'P')!.parentElement as HTMLElement;
const valorKpi = (label: string) => kpi(label).querySelectorAll('p')[1];
const pistaKpi = (label: string) => kpi(label).querySelectorAll('p')[2]?.textContent ?? null;
// La tabla por campaña es la que tiene encabezado "Campaña" (la de últimos mensajes también nombra campañas)
const tablaPorCampania = () =>
  screen.getByRole('columnheader', { name: 'Campaña' }).closest('table') as HTMLElement;
const filaTabla = (titulo: string) =>
  within(tablaPorCampania()).getByRole('cell', { name: titulo }).closest('tr') as HTMLElement;
const celdas = (titulo: string) => within(filaTabla(titulo)).getAllByRole('cell').map((c) => c.textContent);
const boton = (nombre: 'Anterior' | 'Siguiente') => screen.getByRole('button', { name: nombre }) as HTMLButtonElement;
const ultimoPeriodoPedido = () => getMetricas.mock.calls.at(-1);

const hoyEs = (fecha: Date) => vi.setSystemTime(fecha);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  hoyEs(new Date(2026, 8, 15, 12, 0, 0));    // 15/09/2026, mitad de mes (Q12)
  vi.clearAllMocks();
  getMetricas.mockResolvedValue(METRICAS);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Métricas: KPIs y tabla', () => {
  it('M1: los 4 KPIs muestran los valores del backend con sus aclaraciones y colores', async () => {
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    expect(valorKpi('Enviados').textContent).toBe('8');
    expect(pistaKpi('Enviados')).toBe('+ 4 simulados');
    expect(valorKpi('Entregados').textContent).toBe('7');
    expect(pistaKpi('Entregados')).toBe('5 leídos');
    expect(valorKpi('Volvieron').textContent).toBe('13%');                     // 12,5% se redondea para arriba
    expect(pistaKpi('Volvieron')).toBe('1 agendaron en 14 días');
    expect(valorKpi('Volvieron').className).toContain('text-green-700');
    expect(valorKpi('Bajas').textContent).toBe('2');
    expect(pistaKpi('Bajas')).toBe('5 en total');
    expect(valorKpi('Bajas').className).toContain('text-red-600');
  });

  it('M1: sin simulados ni leídos no hay aclaración; sin convertidos ni bajas no hay color', async () => {
    getMetricas.mockResolvedValue(SIN_NADA);
    render(<CampaniasMetricasTab />);
    await screen.findByText('Todavía no hay mensajes registrados.');

    expect(pistaKpi('Enviados')).toBeNull();
    expect(pistaKpi('Entregados')).toBeNull();
    expect(valorKpi('Volvieron').className).not.toContain('text-green-700');
    expect(valorKpi('Bajas').className).not.toContain('text-red-600');
    expect(pistaKpi('Bajas')).toBe('0 en total');
  });

  it('M2: la columna Volvieron dice "—" si la campaña no envió nada; si envió, "convertidos (%)"', async () => {
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    expect(celdas('Recordatorio por recencia').at(-1)).toBe('1 (13%)');
    expect(celdas('Win-back (cliente perdido)').at(-1)).toBe('—');            // solo simulados
    expect(celdas('Post-servicio').at(-1)).toBe('—');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('M2 (O1): en un mes sin envíos el KPI Volvieron dice "—", igual que la tabla (no "0%")', async () => {
    getMetricas.mockResolvedValue(SIN_NADA);
    render(<CampaniasMetricasTab />);
    await screen.findByText('Todavía no hay mensajes registrados.');

    expect(valorKpi('Volvieron').textContent).toBe('—');
    expect(celdas('Recordatorio por recencia').at(-1)).toBe('—');
  });

  it('M3: la fila es gris solo si la campaña no envió ni simuló nada', async () => {
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    expect(filaTabla('Post-servicio').className).toContain('text-gray-400');
    expect(filaTabla('Win-back (cliente perdido)').className).not.toContain('text-gray-400');
    expect(filaTabla('Recordatorio por recencia').className).not.toContain('text-gray-400');
  });

  it('M7: sin mensajes muestra "Todavía no hay mensajes registrados."', async () => {
    getMetricas.mockResolvedValue(SIN_NADA);
    render(<CampaniasMetricasTab />);

    expect(await screen.findByText('Todavía no hay mensajes registrados.')).toBeTruthy();
  });
});

describe('Métricas: navegación por mes', () => {
  it('M4: arranca en el mes actual con "Siguiente" deshabilitado; se puede ir atrás y volver, pero no pasar del actual', async () => {
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    expect(screen.getByRole('heading', { name: 'Septiembre de 2026' })).toBeTruthy();
    expect(ultimoPeriodoPedido()).toEqual(['2026-09-01', '2026-09-30']);
    expect(boton('Siguiente').disabled).toBe(true);

    fireEvent.click(boton('Anterior'));
    await waitFor(() => expect(ultimoPeriodoPedido()).toEqual(['2026-08-01', '2026-08-31']));
    expect(screen.getByRole('heading', { name: 'Agosto de 2026' })).toBeTruthy();
    expect(boton('Siguiente').disabled).toBe(false);

    fireEvent.click(boton('Siguiente'));
    await waitFor(() => expect(ultimoPeriodoPedido()).toEqual(['2026-09-01', '2026-09-30']));
    expect(boton('Siguiente').disabled).toBe(true);

    const pedidos = getMetricas.mock.calls.length;
    fireEvent.click(boton('Siguiente'));                                    // deshabilitado: no pide octubre
    expect(getMetricas.mock.calls.length).toBe(pedidos);
    expect(getMetricas.mock.calls.flat()).not.toContain('2026-10-01');
  });

  it('M5: cambio de año (enero → diciembre del año anterior) y febrero bisiesto', async () => {
    hoyEs(new Date(2027, 0, 15, 12, 0, 0));
    const { unmount } = render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    fireEvent.click(boton('Anterior'));
    await waitFor(() => expect(ultimoPeriodoPedido()).toEqual(['2026-12-01', '2026-12-31']));
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeTruthy();
    fireEvent.click(boton('Siguiente'));
    await waitFor(() => expect(ultimoPeriodoPedido()).toEqual(['2027-01-01', '2027-01-31']));
    unmount();

    hoyEs(new Date(2028, 2, 10, 12, 0, 0));
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');
    fireEvent.click(boton('Anterior'));
    await waitFor(() => expect(ultimoPeriodoPedido()).toEqual(['2028-02-01', '2028-02-29']));
  });
});

describe('Métricas: error', () => {
  it('M6: si falla la primera carga, se ve el error y ningún KPI', async () => {
    getMetricas.mockRejectedValue(new Error('500'));
    render(<CampaniasMetricasTab />);

    expect(await screen.findByText('No se pudieron cargar las métricas.')).toBeTruthy();
    expect(screen.queryAllByText('Enviados')).toHaveLength(0);                 // ni KPI ni tabla
    expect(screen.queryByText('Todavía no hay mensajes registrados.')).toBeNull();
  });

  it('M6: si falla un mes después de uno que anduvo, no quedan a la vista los números del mes anterior', async () => {
    render(<CampaniasMetricasTab />);
    await screen.findByText('Sofía López');

    getMetricas.mockRejectedValueOnce(new Error('500'));
    fireEvent.click(boton('Anterior'));

    await screen.findByText('No se pudieron cargar las métricas.');
    expect(screen.getByRole('heading', { name: 'Agosto de 2026' })).toBeTruthy();
    // Los KPIs y mensajes de septiembre no pueden seguir en pantalla bajo el título "Agosto"
    expect(screen.queryAllByText('Enviados')).toHaveLength(0);                 // ni KPI ni tabla
    expect(screen.queryByText('Sofía López')).toBeNull();
  });
});
