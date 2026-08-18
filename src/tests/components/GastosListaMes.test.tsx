import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { GastosListaMes } from '../../components/gastos/GastosListaMes';
import type { GastosMes, GastoMesItem } from '../../types/gastos.types';

const CAT = { id: 'cat-1', nombre: 'Varios', color: '#0ea5e9' };

const item = (over: Partial<GastoMesItem> = {}): GastoMesItem => ({
  id: 'g-1', es_virtual: false, recurrente_id: null, categoria: CAT, nombre: 'Gasto',
  descripcion: null, monto: 1000, estado: 'pendiente', omitido: false, fecha: null,
  fecha_pago: null, dia_vencimiento: null, metodo_pago: null, notas: null, ...over,
});

const MES: GastosMes = {
  periodo: '2026-08',
  derivados: [
    { clave: 'comisiones', nombre: 'Comisiones', monto: 385000, detalle: '', color: '#ec4899' },
    { clave: 'mercaderia', nombre: 'Mercadería', monto: 27300, detalle: '', color: '#14b8a6' },
  ],
  recurrentes: [
    item({ id: 'rec:r1:2026-08', es_virtual: true, recurrente_id: 'r1', nombre: 'Alquiler', monto: 700000, dia_vencimiento: 10, monto_default: 700000 }),
    item({ id: 'ov-1', recurrente_id: 'r2', nombre: 'Luz', monto: 120000, estado: 'pagado', monto_default: 100000 }),
    item({ id: 'ov-2', recurrente_id: 'r3', nombre: 'Internet', monto: 40000, omitido: true }),
  ],
  unicos: [item({ id: 'u-1', nombre: 'Arreglo del aire', monto: 85000, estado: 'pagado', fecha: '2026-08-12' })],
  totales: { derivados: 412300, recurrentes: 820000, unicos: 85000, total: 1317300, pagado: 205000, pendiente: 700000 },
};

const props = () => ({
  mes: MES, isLoading: false,
  onAgregar: vi.fn(), onEditar: vi.fn(), onEliminarUnico: vi.fn(),
  onTogglePagado: vi.fn(), onVerRecurrentes: vi.fn(),
});

const renderLista = (p = props()) => {
  render(<MemoryRouter><GastosListaMes {...p} /></MemoryRouter>);
  return p;
};

describe('GastosListaMes', () => {
  it('habla en el idioma del dueño: "Todos los meses" y "Solo este mes"', () => {
    renderLista();
    expect(screen.getByText('Todos los meses')).toBeTruthy();
    expect(screen.getByText('Solo este mes')).toBeTruthy();
    expect(screen.queryByText(/derivado|override|plantilla|virtual/i)).toBeNull();
  });

  it('un solo botón para agregar', () => {
    const p = renderLista();
    const botones = screen.getAllByRole('button', { name: /agregar gasto/i });
    expect(botones).toHaveLength(1);
    fireEvent.click(botones[0]);
    expect(p.onAgregar).toHaveBeenCalled();
  });

  it('el estado se tilda con un click, sin abrir nada', () => {
    const p = renderLista();
    fireEvent.click(screen.getByTitle('Marcar como pagado'));   // el Alquiler, pendiente
    expect(p.onTogglePagado).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Alquiler' }), true);
  });

  it('muestra "Pagado" y "Falta pagar" según el estado', () => {
    renderLista();
    expect(screen.getAllByText('Pagado').length).toBeGreaterThanOrEqual(2);   // Luz y Arreglo
    expect(screen.getAllByText('Falta pagar').length).toBeGreaterThanOrEqual(1);   // Alquiler
  });

  it('el recurrente que este mes es distinto lo dice en criollo', () => {
    renderLista();
    expect(screen.getByText(/este mes distinto \(normalmente/)).toBeTruthy();
  });

  it('el omitido dice "no aplica este mes" y va tachado', () => {
    renderLista();
    expect(screen.getByText('no aplica este mes')).toBeTruthy();
    expect(screen.getByText('Internet').className).toContain('line-through');
  });

  it('lo automático va al pie, con link a Finanzas, sin botones', () => {
    renderLista();
    expect(screen.getByText(/calculado automáticamente/i)).toBeTruthy();
    expect(screen.getByText(/ver detalle en Finanzas/i)).toBeTruthy();
    expect(screen.queryByText('Comisiones')).toBeNull();   // no es una fila editable
  });

  it('el gasto único se edita y se borra; el recurrente solo se edita', () => {
    const p = renderLista();
    const editar = screen.getAllByLabelText('Editar');
    const eliminar = screen.getAllByLabelText('Eliminar');
    expect(editar).toHaveLength(4);      // 3 recurrentes + 1 único
    expect(eliminar).toHaveLength(1);    // solo el único
    fireEvent.click(eliminar[0]);
    expect(p.onEliminarUnico).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
  });

  it('el pie muestra lo cargado a mano, lo que falta pagar y el total', () => {
    renderLista();
    expect(screen.getByText(/cargado a mano/i)).toBeTruthy();
    // "Falta pagar" también es el texto de los botones de estado: el del pie va con el monto
    expect(screen.getByText(/cargado a mano/i).textContent).toMatch(/falta pagar/i);
    expect(screen.getByText(/total del mes/i)).toBeTruthy();
  });

  it('con la lista vacía explica qué hacer', () => {
    render(<MemoryRouter><GastosListaMes {...props()} mes={{ ...MES, recurrentes: [], unicos: [] }} /></MemoryRouter>);
    expect(screen.getByText(/todavía no cargaste ningún gasto que se repita/i)).toBeTruthy();
    expect(screen.getByText(/nada cargado para este mes/i)).toBeTruthy();
  });
});
