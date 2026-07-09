import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { FinanzasTable } from '../../components/finanzas/FinanzasTable';
import type { ComisionProfesional, VentaGrupadaFinanzas } from '../../types/finanzas.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const comisionBase: ComisionProfesional = {
  id: 'com-1',
  turno_id: 'turno-1',
  profesional_id: 'prof-1',
  empresa_id: 'emp-1',
  servicio_monto: 1000,
  servicio_comision_porcentaje: 30,
  servicio_comision_monto: 300,
  servicio_neto_profesional: 700,
  estado: 'pendiente',
  fecha_pago: null,
  notas: null,
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z',
  tipo: 'turno',
  turno_fecha: '2026-07-01',
  turno_hora: '10:00',
  turno_estado: 'completado',
  metodo_pago: 'pendiente',
  precio_original: 1000,
  descuento_porcentaje: 0,
  descuento_monto: 0,
  total_final: 1000,
  cliente_nombre: 'Cliente Test',
  servicio_nombre: 'Corte',
};

const ventaDesdeTurno: VentaGrupadaFinanzas = {
  tipo: 'venta_producto',
  id: 'grupo-1',
  venta_grupo_id: 'grupo-1',
  turno_id: 'turno-1',
  fecha: '2026-07-01',
  metodo_pago: 'pendiente',
  total: 500,
  comision_monto: 100,
  neto_vendedor: 400,
  cliente_nombre: 'Cliente Test',
  vendedor_nombre: 'Profesional Test',
  empresa_id: 'emp-1',
  items: [{
    id: 'vp-1', nombre_producto: 'Shampoo', cantidad: 1,
    precio_total: 500, comision_porcentaje: 80, comision_monto: 100, neto_vendedor: 400,
  }],
};

const ventaDirecta: VentaGrupadaFinanzas = {
  ...ventaDesdeTurno,
  id: 'grupo-2',
  venta_grupo_id: 'grupo-2',
  turno_id: null,
};

function renderTable(overrides: Partial<React.ComponentProps<typeof FinanzasTable>> = {}) {
  const props: React.ComponentProps<typeof FinanzasTable> = {
    items: [],
    isLoading: false,
    isAdmin: false,
    onSort: vi.fn(),
    sortField: 'fecha',
    sortOrder: 'desc',
    onRowClick: vi.fn(),
    onCobrarPago: vi.fn().mockResolvedValue(undefined),
    tipoFiltro: 'todos',
    onTipoChange: vi.fn(),
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
    onPageChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<FinanzasTable {...props} />), props };
}

// Desktop y mobile se renderizan a la vez (ocultos por CSS): tomar el primer botón
async function cobrarPrimeraFila(metodo: 'Efectivo' | 'Transf.') {
  fireEvent.click(screen.getAllByText('Cobrar')[0]);
  fireEvent.click(screen.getAllByText(metodo)[0]);
}

describe('FinanzasTable', () => {
  // ─── Tabs controlados por el padre (filtrado server-side) ───────────────────

  describe('tabs', () => {
    it('clickear un tab notifica al padre en lugar de filtrar localmente', () => {
      const { props } = renderTable({ items: [comisionBase] });
      fireEvent.click(screen.getByText('Productos'));
      expect(props.onTipoChange).toHaveBeenCalledWith('productos');
    });

    it('no filtra los items en el cliente: renderiza todo lo que llega', () => {
      // Si el filtrado local siguiera existiendo, un turno no se vería en el tab productos
      renderTable({ items: [comisionBase], tipoFiltro: 'productos' });
      expect(screen.getAllByText('Cliente Test').length).toBeGreaterThan(0);
    });
  });

  // ─── Cobro desde el tab Pendientes ──────────────────────────────────────────

  describe('cobro de servicio según tiene_producto_pendiente', () => {
    it('sin productos pendientes: cobra el turno completo', async () => {
      const { props } = renderTable({
        items: [{ ...comisionBase, tiene_producto_pendiente: false }],
        tipoFiltro: 'pendientes',
      });
      await cobrarPrimeraFila('Efectivo');
      await waitFor(() =>
        expect(props.onCobrarPago).toHaveBeenCalledWith('turno', 'turno-1', 'efectivo')
      );
    });

    it('con productos pendientes (aunque no estén en la página): cobra solo el servicio', async () => {
      const { props } = renderTable({
        // Solo la fila del servicio: los productos quedaron en otra página
        items: [{ ...comisionBase, tiene_producto_pendiente: true }],
        tipoFiltro: 'pendientes',
      });
      await cobrarPrimeraFila('Transf.');
      await waitFor(() =>
        expect(props.onCobrarPago).toHaveBeenCalledWith('turno_solo_servicio', 'turno-1', 'transferencia')
      );
    });

    it('venta desde turno: cobra con tipo venta_turno y el id del turno', async () => {
      const { props } = renderTable({ items: [ventaDesdeTurno], tipoFiltro: 'pendientes' });
      await cobrarPrimeraFila('Efectivo');
      await waitFor(() =>
        expect(props.onCobrarPago).toHaveBeenCalledWith('venta_turno', 'turno-1', 'efectivo')
      );
    });

    it('venta directa: cobra con tipo venta y el id del grupo', async () => {
      const { props } = renderTable({ items: [ventaDirecta], tipoFiltro: 'pendientes' });
      await cobrarPrimeraFila('Efectivo');
      await waitFor(() =>
        expect(props.onCobrarPago).toHaveBeenCalledWith('venta', 'grupo-2', 'efectivo')
      );
    });
  });

  // ─── Paginación en todos los tabs ───────────────────────────────────────────

  describe('paginación', () => {
    it.each(['todos', 'turnos', 'productos', 'pendientes'] as const)(
      'se muestra en el tab %s cuando hay más de una página',
      (tab) => {
        renderTable({
          items: [comisionBase],
          tipoFiltro: tab,
          totalPages: 3,
          total: 50,
        });
        expect(screen.getByText(/Mostrando .* de 50 resultados/)).toBeTruthy();
      }
    );

    it('no se muestra cuando hay una sola página', () => {
      renderTable({ items: [comisionBase], totalPages: 1, total: 1 });
      expect(screen.queryByText(/resultados/)).toBeNull();
    });
  });
});
