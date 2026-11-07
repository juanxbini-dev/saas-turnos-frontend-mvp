import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../../api/axiosInstance';
import { cacheService } from '../../cache/cache.service';
import {
  gastosService,
  normalizarDetalle,
  normalizarMes,
  totalesDeProfesionales,
} from '../../services/gastos.service';
import { filtrarPorTipo, tipoDeCategoria, tipoDeFijo } from '../../components/gastos/gastos.utils';
import type { GastoCategoria, GastoMesItem, GastosMesApi, GastosProfesionalMes } from '../../types/gastos.types';

vi.mock('../../api/axiosInstance', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

// Contrato de backend/docs/gastos-ingresos-plan.md: ingresos a mano en el mes,
// "No cuenta" por profesional y los endpoints de usuarios-cuenta.

const get = axiosInstance.get as unknown as ReturnType<typeof vi.fn>;
const post = axiosInstance.post as unknown as ReturnType<typeof vi.fn>;

const item = (id: string, monto: number, over: Partial<GastoMesItem> = {}): GastoMesItem => ({
  id, es_virtual: false, recurrente_id: null, categoria: { id: 'cat-emp', nombre: 'Empleados', color: '#000', tipo: 'ingreso' },
  nombre: id, descripcion: null, monto, estado: 'pendiente', omitido: false, fecha: null, fecha_pago: null,
  dia_vencimiento: null, metodo_pago: null, notas: null, ...over,
});

const prof = (id: string, facturado: number, over: Partial<GastosProfesionalMes> = {}): GastosProfesionalMes => ({
  profesional_id: id, nombre: id, avatar_url: null, es_duenio: false, activo: true,
  facturado_servicios: facturado, facturado_productos: 0, facturado,
  a_pagar_servicios: 0, a_pagar_productos: 0, a_pagar: 0, ganancia_salon: facturado,
  turnos_cobrados: 0, canjes: 0, unidades_vendidas: 0, pendiente_cobro: 0, ...over,
});

const INGRESOS = { servicios: 100, productos: 20, total: 120, turnos_cobrados: 2, productos_vendidos: 3, pendiente_cobro: 0 };
const TOTALES_GASTOS = { derivados: 0, recurrentes: 0, unicos: 0, total: 0, pagado: 0, pendiente: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('tipo de categoría', () => {
  it('sin tipo (backend viejo) es gasto; filtrarPorTipo separa los dos grupos', () => {
    const cats: GastoCategoria[] = [
      { id: 'a', nombre: 'Alquiler', color: '', orden: 1, activa: true },
      { id: 'b', nombre: 'Luz', color: '', orden: 2, activa: true, tipo: 'gasto' },
      { id: 'c', nombre: 'Empleados', color: '', orden: 3, activa: true, tipo: 'ingreso' },
    ];
    expect(tipoDeCategoria(cats[0])).toBe('gasto');
    expect(filtrarPorTipo(cats, 'gasto').map((c) => c.id)).toEqual(['a', 'b']);
    expect(filtrarPorTipo(cats, 'ingreso').map((c) => c.id)).toEqual(['c']);
  });

  it('un fijo sin tipo propio toma el de su categoría', () => {
    expect(tipoDeFijo({ categoria: { tipo: 'ingreso' } })).toBe('ingreso');
    expect(tipoDeFijo({ tipo: 'gasto', categoria: { tipo: 'ingreso' } })).toBe('gasto');
    expect(tipoDeFijo({})).toBe('gasto');
  });
});

describe('normalizarMes', () => {
  it('contrato nuevo: pasa ingresos_fijos/ingresos_unicos y sus totales tal cual', () => {
    const api: GastosMesApi = {
      periodo: '2026-11', derivados: [], recurrentes: [], unicos: [],
      ingresos_fijos: [item('juli', 50000)], ingresos_unicos: [],
      totales: { ...TOTALES_GASTOS, ingresos_fijos: 50000, ingresos_unicos: 0, ingresos: 50000, cobrado: 0, por_cobrar: 50000 },
    };
    const mes = normalizarMes(api);
    expect(mes.ingresos_fijos).toHaveLength(1);
    expect(mes.totales.ingresos).toBe(50000);
    expect(mes.totales.por_cobrar).toBe(50000);
  });

  it('backend sin los campos de ingresos: listas vacías y totales en cero', () => {
    const mes = normalizarMes({ periodo: '2026-11', derivados: [], recurrentes: [], unicos: [], totales: TOTALES_GASTOS });
    expect(mes.ingresos_fijos).toEqual([]);
    expect(mes.ingresos_unicos).toEqual([]);
    expect(mes.totales).toMatchObject({ ingresos_fijos: 0, ingresos_unicos: 0, ingresos: 0, cobrado: 0, por_cobrar: 0 });
  });

  it('si faltan los totales de ingresos se suman en centavos, sin los omitidos', () => {
    const mes = normalizarMes({
      periodo: '2026-11', derivados: [], recurrentes: [], unicos: [], totales: TOTALES_GASTOS,
      ingresos_fijos: [item('a', 0.1, { estado: 'pagado' }), item('b', 999, { omitido: true })],
      ingresos_unicos: [item('c', 0.2)],
    });
    expect(mes.totales.ingresos).toBe(0.3);
    expect(mes.totales.cobrado).toBe(0.1);
    expect(mes.totales.por_cobrar).toBe(0.2);
  });
});

describe('"No cuenta" en el detalle', () => {
  it('sin el campo, todos cuentan (backend viejo)', () => {
    const d = normalizarDetalle({ periodo: '2026-11', ingresos: INGRESOS, profesionales: [prof('ana', 50)] });
    expect(d.profesionales[0]!.cuenta_en_gastos).toBe(true);
    expect(d.ingresos.cargados).toBe(0);
    expect(d.totales.facturado_excluido).toBe(0);
  });

  it('los totales armados acá dejan afuera a quienes no cuentan y los suman en facturado_excluido', () => {
    const filas = [
      prof('dani', 300, { es_duenio: true, cuenta_en_gastos: false }),
      prof('ana', 100, { a_pagar: 40, ganancia_salon: 60 }),
      prof('beto', 50, { cuenta_en_gastos: false, a_pagar: 20, ganancia_salon: 30 }),
    ];
    expect(totalesDeProfesionales(filas)).toEqual({
      facturado: 100, a_pagar: 40, ganancia_salon: 60, facturado_duenio: 0, facturado_excluido: 350,
    });
  });

  it('los totales del backend se respetan; los que no cuentan siguen en la lista', () => {
    const totales = { facturado: 100, a_pagar: 40, ganancia_salon: 60, facturado_duenio: 0, facturado_excluido: 300 };
    const d = normalizarDetalle({
      periodo: '2026-11', ingresos: { ...INGRESOS, cargados: 50000 }, totales,
      profesionales: [prof('ana', 100), prof('dani', 300, { es_duenio: true, cuenta_en_gastos: false })],
    });
    expect(d.totales).toEqual(totales);
    expect(d.ingresos.cargados).toBe(50000);
    expect(d.profesionales.map((p) => [p.profesional_id, p.cuenta_en_gastos])).toEqual([['dani', false], ['ana', true]]);
  });
});

describe('endpoints', () => {
  it('getMes normaliza la respuesta y manda el token de la sección', async () => {
    sessionStorage.setItem('gastosToken', 'tok-gastos');
    get.mockResolvedValue({ data: { data: { periodo: '2026-11', derivados: [], recurrentes: [], unicos: [], totales: TOTALES_GASTOS } } });

    const mes = await gastosService.getMes('2026-11');

    expect(mes.ingresos_fijos).toEqual([]);
    expect(get.mock.calls[0]![1]).toEqual({ headers: { 'X-Gastos-Token': 'tok-gastos' } });
  });

  it('crearCategoria manda el tipo', async () => {
    post.mockResolvedValue({ data: { data: { id: 'c' } } });
    await gastosService.crearCategoria({ nombre: 'Empleados', tipo: 'ingreso' });
    expect(post.mock.calls[0]![1]).toEqual({ nombre: 'Empleados', tipo: 'ingreso' });
  });

  it('GET /usuarios-cuenta funciona sin la contraseña de Gastos y no manda el token de la sección aunque haya uno', async () => {
    sessionStorage.setItem('gastosToken', 'tok-gastos');
    const respuesta = { periodo_actual: '2026-11', usuarios: [] };
    get.mockResolvedValue({ data: { data: respuesta } });

    await expect(gastosService.getUsuariosCuenta()).resolves.toEqual(respuesta);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![0]).toBe('/api/gastos/usuarios-cuenta');
    expect(JSON.stringify(get.mock.calls[0]![1] ?? {})).not.toContain('X-Gastos-Token');
  });

  it('POST /usuarios-cuenta/:id manda {cuenta, alcance, periodo}, sin token de sección, e invalida el cache de gastos', async () => {
    sessionStorage.setItem('gastosToken', 'tok-gastos');
    const invalidar = vi.spyOn(cacheService, 'invalidateByPrefix');
    post.mockResolvedValue({ data: { data: { usuario_id: 'u-dani', nombre: 'Dani', cuenta_este_mes: false, tramos: [] } } });

    const r = await gastosService.cambiarCuentaUsuario('u-dani', false, 'desde', '2026-11');

    expect(r.cuenta_este_mes).toBe(false);
    expect(post.mock.calls[0]![0]).toBe('/api/gastos/usuarios-cuenta/u-dani');
    expect(post.mock.calls[0]![1]).toEqual({ cuenta: false, alcance: 'desde', periodo: '2026-11' });
    expect(JSON.stringify(post.mock.calls[0]![2] ?? {})).not.toContain('X-Gastos-Token');
    expect(invalidar).toHaveBeenCalledWith(expect.stringMatching(/:gastos$/));
  });

  it('con "siempre" no manda periodo; con "desde" sin mes no llama a la API', async () => {
    post.mockResolvedValue({ data: { data: {} } });
    await gastosService.cambiarCuentaUsuario('u-1', true, 'siempre', '2026-11');
    expect(post.mock.calls[0]![1]).toEqual({ cuenta: true, alcance: 'siempre' });

    post.mockClear();
    await expect(gastosService.cambiarCuentaUsuario('u-1', true, 'desde', '')).rejects.toThrow('Elegí un mes válido');
    expect(post).not.toHaveBeenCalled();
  });
});
