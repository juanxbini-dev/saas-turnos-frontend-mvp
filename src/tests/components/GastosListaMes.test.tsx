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
  mes: MES, periodo: '2026-08', isLoading: false,
  onAgregar: vi.fn(), onEditar: vi.fn(), onEliminarUnico: vi.fn(),
  onTogglePagado: vi.fn(), onVerRecurrentes: vi.fn(),
});

const renderLista = (p = props()) => {
  render(<MemoryRouter><GastosListaMes {...p} /></MemoryRouter>);
  return p;
};

describe('GastosListaMes', () => {
  it('separa por lo que importa: "Te falta pagar" y "Ya pagaste"', () => {
    renderLista();
    expect(screen.getByText('Te falta pagar')).toBeTruthy();
    expect(screen.getByText('Ya pagaste')).toBeTruthy();
    expect(screen.queryByText(/derivado|override|plantilla|virtual|recurrente/i)).toBeNull();
  });

  it('lo pendiente va arriba y lo pagado abajo', () => {
    renderLista();
    const textos = [...document.querySelectorAll('span.text-sm.font-medium')].map((e) => e.textContent);
    const iAlquiler = textos.indexOf('Alquiler');   // pendiente
    const iLuz = textos.indexOf('Luz');             // pagado
    expect(iAlquiler).toBeGreaterThanOrEqual(0);
    expect(iLuz).toBeGreaterThan(iAlquiler);
  });

  it('que se repita es una etiqueta en la fila, no una sección', () => {
    renderLista();
    const etiquetas = screen.getAllByText('todos los meses');
    expect(etiquetas).toHaveLength(3);   // Alquiler, Luz e Internet: los tres se repiten
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

  it('el recurrente que este mes es distinto lo dice en criollo', () => {
    renderLista();
    expect(screen.getByText(/este mes distinto \(normalmente/)).toBeTruthy();
  });

  it('el omitido va aparte, tachado, y no tiene botón de pagar', () => {
    renderLista();
    expect(screen.getByText('Este mes no se pagan')).toBeTruthy();
    expect(screen.getByText('Internet').className).toContain('line-through');
    expect(screen.getAllByTitle(/marcar como/i)).toHaveLength(3);   // Alquiler, Luz, Arreglo — no Internet
  });

  it('lo automático es una frase al pie con link a Finanzas', () => {
    renderLista();
    expect(screen.getByText(/se calcula solo/i)).toBeTruthy();
    expect(screen.getByText(/ver en Finanzas/i)).toBeTruthy();
  });

  it('el gasto único se borra; el que se repite no', () => {
    const p = renderLista();
    const eliminar = screen.getAllByLabelText('Eliminar');
    expect(eliminar).toHaveLength(1);
    fireEvent.click(eliminar[0]);
    expect(p.onEliminarUnico).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
  });

  it('con la lista vacía muestra el arranque guiado con chips', () => {
    const p = props();
    render(<MemoryRouter><GastosListaMes {...p} mes={{ ...MES, recurrentes: [], unicos: [] }} /></MemoryRouter>);
    expect(screen.getByText(/empezá con tus gastos fijos/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^alquiler$/i }));
    expect(p.onAgregar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Alquiler', categoria: 'Alquiler' }));
  });

  it('cuando está todo pagado lo dice', () => {
    const todoPagado = { ...MES, recurrentes: [MES.recurrentes[1]], unicos: MES.unicos };   // Luz y Arreglo, ambos pagados
    render(<MemoryRouter><GastosListaMes {...props()} mes={todoPagado} /></MemoryRouter>);
    expect(screen.getByText(/todo pagado/i)).toBeTruthy();
  });
});
