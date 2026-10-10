import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ProductosPage from '../../pages/ProductosPage';
import { Producto } from '../../types/producto.types';

// Catálogo de productos: toggle "Sin duración cargada" (filtro en el cliente)
// y la duración visible en la tabla.

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles: ['admin'] }, roles: ['admin'] }, logout: vi.fn() }),
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const base = {
  empresa_id: 'e1',
  descripcion: null,
  precio_efectivo: 1000,
  precio_transferencia: 1100,
  precio_tarjeta: 1200,
  costo: 500,
  stock: 10,
  activo: true,
  marca_id: null,
  marca_nombre: null,
  seguimiento_dias: null,
  nombre_mensaje: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};
const productos: Producto[] = [
  { ...base, id: 'p1', nombre: 'Shampoo con duración', duracion_estimada_dias: 60 },
  { ...base, id: 'p2', nombre: 'Acondicionador sin duración', duracion_estimada_dias: null },
  { ...base, id: 'p3', nombre: 'Máscara sin duración', duracion_estimada_dias: null },
  // Inactivo sin duración: no cuenta ni aparece en el filtro
  { ...base, id: 'p4', nombre: 'Gel discontinuado', duracion_estimada_dias: null, activo: false },
];

vi.mock('../../services/productos.service', () => ({
  productosService: {
    getProductos: vi.fn(() => Promise.resolve(productos)),
    getStats: vi.fn(() => Promise.resolve({ top_productos: [], top_vendedores: [], bajo_stock_count: 0 })),
    getConfiguracion: vi.fn(() =>
      Promise.resolve({ empresa_id: 'e1', pct_efectivo: 50, pct_transferencia: 60, pct_tarjeta: 70, stock_minimo: 3 })
    ),
  },
  getRegistroVentas: vi.fn(() => Promise.resolve({ rows: [], total: 0 })),
  getResumenVentas: vi.fn(),
  updateVentaProducto: vi.fn(),
  deleteVentaProducto: vi.fn(),
}));
vi.mock('../../services/marcas.service', () => ({
  marcasService: { getMarcas: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('../../services/usuario.service', () => ({
  usuarioService: { getUsuarios: vi.fn(() => Promise.resolve([])) },
}));

const tabla = () => screen.getByRole('table');

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ProductosPage · Sin duración cargada', () => {
  it('muestra la duración en la tabla y guion si falta', async () => {
    render(<ProductosPage />);
    await screen.findAllByText('Shampoo con duración');
    expect(within(tabla()).getByText('Dura 60 días')).toBeTruthy();
    expect(within(tabla()).getByRole('columnheader', { name: 'Duración' })).toBeTruthy();
  });

  it('el toggle deja solo los productos activos sin duración, con el contador', async () => {
    render(<ProductosPage />);
    await screen.findAllByText('Shampoo con duración');

    // 3 sin duración, pero uno está inactivo: el contador dice 2
    const toggle = screen.getByLabelText('Sin duración cargada (2)') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(within(tabla()).getAllByRole('row')).toHaveLength(5); // encabezado + 4
    expect(within(tabla()).getByText('Gel discontinuado')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    expect(within(tabla()).getAllByRole('row')).toHaveLength(3); // encabezado + 2
    expect(within(tabla()).queryByText('Shampoo con duración')).toBeNull();
    expect(within(tabla()).queryByText('Gel discontinuado')).toBeNull();
    expect(within(tabla()).getByText('Acondicionador sin duración')).toBeTruthy();
    expect(within(tabla()).getByText('Máscara sin duración')).toBeTruthy();

    fireEvent.click(toggle);
    expect(within(tabla()).getByText('Shampoo con duración')).toBeTruthy();
  });
});
