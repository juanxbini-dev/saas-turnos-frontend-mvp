import { describe, it, expect, vi } from 'vitest';
import { normalizarDetalle, ordenarProfesionales } from '../../services/gastos.service';
import { limpiarPorCategoria, sumarMontos } from '../../components/gastos/gastos.utils';
import type { GastosPorCategoriaItem, GastosProfesionalMes } from '../../types/gastos.types';

vi.mock('../../api/axiosInstance', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

// Contrato de GET /api/gastos/detalle (gastos-ganancias-spec §4.4) y limpieza del
// reparto por rubro (§4.5)

const INGRESOS = { servicios: 100, productos: 20, total: 120, turnos_cobrados: 2, productos_vendidos: 3, pendiente_cobro: 0 };

const prof = (id: string, es_duenio: boolean, facturado: number): GastosProfesionalMes => ({
  profesional_id: id, nombre: id, avatar_url: null, es_duenio, activo: true,
  facturado_servicios: facturado, facturado_productos: 0, facturado,
  a_pagar_servicios: 0, a_pagar_productos: 0, a_pagar: 0, ganancia_salon: facturado,
  turnos_cobrados: 0, canjes: 0, unidades_vendidas: 0, pendiente_cobro: 0,
});

describe('normalizarDetalle', () => {
  it('contrato nuevo: pasa profesionales (dueño primero), productos y a_pagar_total', () => {
    const d = normalizarDetalle({
      periodo: '2026-09', ingresos: INGRESOS,
      profesionales: [prof('ana', false, 50), prof('beto', false, 80), prof('dani', true, 10)],
      productos: { costo_vendido: 7, costo_canjes: 1, unidades: 3 },
      a_pagar_total: 40, comisiones_total: 40,
    });
    expect(d.profesionales.map((p) => p.profesional_id)).toEqual(['dani', 'beto', 'ana']);
    expect(d.productos).toEqual({ costo_vendido: 7, costo_canjes: 1, unidades: 3 });
    expect(d.a_pagar_total).toBe(40);
    // Sin totales del backend, se arman sumando las filas
    expect(d.totales).toEqual({ facturado: 140, a_pagar: 0, ganancia_salon: 140, facturado_duenio: 10 });
  });

  it('si el backend manda totales, se respetan', () => {
    const totales = { facturado: 1, a_pagar: 2, ganancia_salon: 3, facturado_duenio: 4 };
    const d = normalizarDetalle({ periodo: '2026-09', ingresos: INGRESOS, profesionales: [prof('ana', false, 50)], totales });
    expect(d.totales).toEqual(totales);
  });

  it('contrato viejo: usa los alias (comisiones_total, mercaderia_*) y deja profesionales vacío', () => {
    const d = normalizarDetalle({
      periodo: '2026-09', ingresos: INGRESOS,
      comisiones_total: 33, mercaderia_costo: 9, mercaderia_unidades: 4,
    });
    expect(d.profesionales).toEqual([]);
    expect(d.a_pagar_total).toBe(33);
    expect(d.productos).toEqual({ costo_vendido: 9, costo_canjes: 0, unidades: 4 });
  });

  it('ordenarProfesionales no muta la lista original', () => {
    const lista = [prof('ana', false, 1), prof('dani', true, 0)];
    ordenarProfesionales(lista);
    expect(lista[0].profesional_id).toBe('ana');
  });
});

describe('limpiarPorCategoria', () => {
  const item = (categoria_id: string, nombre: string, monto: number): GastosPorCategoriaItem => ({
    categoria_id, nombre, color: '#000', monto, monto_anterior: 0, delta: 0, delta_pct: null, es_derivado: categoria_id.startsWith('derivado:'),
  });

  it('saca la mercadería vendida y renombra el rubro de comisiones', () => {
    const limpio = limpiarPorCategoria([
      item('cat-alq', 'Alquiler', 700),
      item('derivado:comisiones', 'Comisiones a profesionales', 385),
      item('derivado:mercaderia', 'Costo de mercadería vendida', 27),
      item('cat-merc', 'Mercadería', 50),   // compras de stock cargadas a mano: se quedan
    ]);
    expect(limpio.map((c) => c.nombre)).toEqual(['Alquiler', 'A pagar a profesionales', 'Mercadería']);
  });
});

describe('sumarMontos', () => {
  it('suma en centavos', () => {
    expect(sumarMontos([0.1, 0.2])).toBe(0.3);
    expect(sumarMontos([])).toBe(0);
  });
});
