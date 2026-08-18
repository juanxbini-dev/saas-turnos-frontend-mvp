import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { GastosTablaMes } from '../../components/gastos/GastosTablaMes';
import type { GastosMes, GastoMesItem } from '../../types/gastos.types';

const CAT = { id: 'cat-1', nombre: 'Alquiler', color: '#0ea5e9' };

const item = (over: Partial<GastoMesItem> = {}): GastoMesItem => ({
  id: 'g-1',
  es_virtual: false,
  recurrente_id: null,
  categoria: CAT,
  nombre: 'Gasto',
  descripcion: null,
  monto: 1000,
  estado: 'pendiente',
  omitido: false,
  fecha: null,
  fecha_pago: null,
  dia_vencimiento: null,
  metodo_pago: null,
  notas: null,
  ...over,
});

const MES: GastosMes = {
  periodo: '2026-08',
  derivados: [
    { clave: 'comisiones', nombre: 'Comisiones a profesionales', monto: 385000, detalle: 'neto', color: '#ec4899' },
    { clave: 'mercaderia', nombre: 'Costo de mercadería vendida', monto: 27300, detalle: 'costo', color: '#14b8a6' },
  ],
  recurrentes: [
    item({ id: 'rec:rec-1:2026-08', es_virtual: true, recurrente_id: 'rec-1', nombre: 'Alquiler', monto: 700000, dia_vencimiento: 10 }),
    item({ id: 'ov-1', es_virtual: false, recurrente_id: 'rec-2', nombre: 'Luz', monto: 120000, estado: 'pagado', monto_default: 100000 }),
    item({ id: 'ov-2', es_virtual: false, recurrente_id: 'rec-3', nombre: 'Internet', monto: 40000, omitido: true }),
  ],
  unicos: [
    item({ id: 'u-1', nombre: 'Arreglo del aire', monto: 85000, estado: 'pagado', fecha: '2026-08-12' }),
  ],
  totales: { derivados: 412300, recurrentes: 820000, unicos: 85000, total: 1317300, pagado: 205000, pendiente: 700000 },
};

const props = () => ({
  mes: MES,
  isLoading: false,
  onNuevoUnico: vi.fn(),
  onEditarUnico: vi.fn(),
  onEliminarUnico: vi.fn(),
  onNuevoRecurrente: vi.fn(),
  onEditarMesRecurrente: vi.fn(),
  onGestionarRecurrentes: vi.fn(),
});

const renderTabla = (p = props()) => {
  render(<MemoryRouter><GastosTablaMes {...p} /></MemoryRouter>);
  return p;
};

describe('GastosTablaMes', () => {
  it('muestra los tres bloques con sus totales', () => {
    renderTabla();

    expect(screen.getByText('Del sistema')).toBeTruthy();
    expect(screen.getByText('Recurrentes')).toBeTruthy();
    expect(screen.getByText('Únicos')).toBeTruthy();
    expect(screen.getByText('Comisiones a profesionales')).toBeTruthy();
    expect(screen.getAllByText('Alquiler').length).toBeGreaterThan(0);
    expect(screen.getByText('Arreglo del aire')).toBeTruthy();
  });

  it('marca el recurrente con override como editado, y el proyectado no', () => {
    renderTabla();

    const badges = screen.getAllByText('editado este mes');
    expect(badges).toHaveLength(1);
    // El badge cuelga de la fila de Luz (el override), no de Alquiler (virtual)
    expect(badges[0].closest('div')?.textContent).toContain('Luz');
  });

  it('el recurrente omitido se ve tachado y con "No aplica"', () => {
    renderTabla();

    expect(screen.getByText('No aplica')).toBeTruthy();
    const nombre = screen.getByText('Internet');
    expect(nombre.className).toContain('line-through');
  });

  it('el derivado no tiene botones de editar ni borrar', () => {
    renderTabla();

    const filaComisiones = screen.getByText('Comisiones a profesionales').closest('div')!.parentElement!;
    expect(filaComisiones.querySelector('[aria-label="Editar"]')).toBeNull();
    expect(filaComisiones.querySelector('[aria-label="Eliminar"]')).toBeNull();
    expect(screen.getAllByText(/ver en finanzas/i)).toHaveLength(2);
  });

  it('el recurrente se edita pero no se borra desde la tabla', () => {
    const p = renderTabla();

    // Hay varios "Alquiler" (nombre + categoría de cada fila): la fila del recurrente
    // se identifica por su tooltip "Editar solo este mes", que los únicos no tienen
    const editar = document.querySelector('button[title="Editar solo este mes"]') as HTMLButtonElement;
    const filaAlquiler = editar.closest('.flex.items-center.gap-3') as HTMLElement;
    expect(editar).toBeTruthy();
    expect(filaAlquiler.querySelector('[aria-label="Eliminar"]')).toBeNull();

    fireEvent.click(editar);
    expect(p.onEditarMesRecurrente).toHaveBeenCalledWith(expect.objectContaining({ recurrente_id: 'rec-1' }));
  });

  it('el gasto único se edita y se borra', () => {
    const p = renderTabla();

    const fila = screen.getByText('Arreglo del aire').closest('div')!.parentElement!.parentElement!;
    fireEvent.click(fila.querySelector('[aria-label="Editar"]')!);
    fireEvent.click(fila.querySelector('[aria-label="Eliminar"]')!);

    expect(p.onEditarUnico).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
    expect(p.onEliminarUnico).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
  });

  it('dispara las acciones de alta', () => {
    const p = renderTabla();

    fireEvent.click(screen.getByText('Agregar gasto').closest('button')!);
    fireEvent.click(screen.getByText('Nuevo').closest('button')!);
    fireEvent.click(screen.getByText('Plantillas').closest('button')!);

    expect(p.onNuevoUnico).toHaveBeenCalled();
    expect(p.onNuevoRecurrente).toHaveBeenCalled();
    expect(p.onGestionarRecurrentes).toHaveBeenCalled();
  });

  it('muestra el pie con pagado, pendiente y total', () => {
    renderTabla();

    expect(screen.getByText(/total del mes/i)).toBeTruthy();
    // "Pagado"/"Pendiente" también son badges de estado: el pie los tiene con el monto
    expect(screen.getByText(/^pagado\s*$/i, { selector: 'span.text-gray-500' })).toBeTruthy();
    expect(screen.getByText(/^pendiente\s*$/i, { selector: 'span.text-gray-500' })).toBeTruthy();
  });

  it('muestra un skeleton mientras carga', () => {
    render(<MemoryRouter><GastosTablaMes {...props()} mes={null} isLoading /></MemoryRouter>);

    expect(screen.queryByText('Del sistema')).toBeNull();
  });
});
