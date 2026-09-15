import React, { useState } from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GastosTablaMes, agruparPorRubro, ordenarFilas, filasQueCambian } from '../../components/gastos/GastosTablaMes';
import type { GastoFormPreset } from '../../components/gastos/GastoFormInline';
import { formatMoneda } from '../../components/gastos/gastos.utils';
import { toastService } from '../../services/toast.service';
import type { GastoCategoria, GastoMesItem, GastosDetalleMes, GastosMes } from '../../types/gastos.types';

// Casos B1–B27 y B29 de docs/gastos-v3-casos-qa.md (backend/docs). B28 vive en
// tests/hooks/useCambioMontoFijo.test.ts. Las reglas de agrupación y orden se
// prueban sobre las funciones puras; lo que ve la dueña, con RTL.

const marcarPagados = vi.fn();
const actualizarGasto = vi.fn();
const actualizarRecurrente = vi.fn();
const guardarOverride = vi.fn();
const reemplazarRecurrente = vi.fn();
const crearGasto = vi.fn();
const crearRecurrente = vi.fn();

vi.mock('../../services/gastos.service', () => ({
  gastosService: {
    marcarPagados: (...args: unknown[]) => marcarPagados(...args),
    actualizarGasto: (...args: unknown[]) => actualizarGasto(...args),
    actualizarRecurrente: (...args: unknown[]) => actualizarRecurrente(...args),
    guardarOverride: (...args: unknown[]) => guardarOverride(...args),
    reemplazarRecurrente: (...args: unknown[]) => reemplazarRecurrente(...args),
    crearGasto: (...args: unknown[]) => crearGasto(...args),
    crearRecurrente: (...args: unknown[]) => crearRecurrente(...args),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// ------------------------------------------------------------ Fixture
// Período 2026-09, hoy = 15/09/2026. Un solo mes que cubre todos los estados.

const PERIODO = '2026-09';

const CAT = {
  alquiler: { id: 'cat-alq', nombre: 'Alquiler', color: '#1d4ed8' },
  servicios: { id: 'cat-serv', nombre: 'Servicios', color: '#f59e0b' },
  impuestos: { id: 'cat-imp', nombre: 'Impuestos', color: '#7c3aed' },
  otros: { id: 'cat-otros', nombre: 'Otros', color: '#64748b' },
};

const CATEGORIAS: GastoCategoria[] = [
  { ...CAT.alquiler, orden: 1, activa: true },
  { ...CAT.servicios, orden: 2, activa: true },
  { ...CAT.impuestos, orden: 3, activa: true },
  { ...CAT.otros, orden: 9, activa: true },
];

const base = {
  es_virtual: false, recurrente_id: null, descripcion: null, estado: 'pendiente' as const,
  omitido: false, fecha: null, fecha_pago: null, dia_vencimiento: null, metodo_pago: null, notas: null,
};

const fijoVirtual = (rec: string, categoria: typeof CAT.alquiler, nombre: string, monto: number, dia: number | null): GastoMesItem =>
  ({ ...base, id: `rec:${rec}:${PERIODO}`, es_virtual: true, recurrente_id: rec, categoria, nombre, monto, dia_vencimiento: dia });

const override = (id: string, rec: string, categoria: typeof CAT.alquiler, nombre: string, monto: number, montoDefault: number, dia: number | null, over: Partial<GastoMesItem> = {}): GastoMesItem =>
  ({ ...base, id, recurrente_id: rec, categoria, nombre, monto, monto_default: montoDefault, dia_vencimiento: dia, ...over });

const unico = (id: string, categoria: typeof CAT.alquiler, nombre: string, monto: number, over: Partial<GastoMesItem> = {}): GastoMesItem =>
  ({ ...base, id, categoria, nombre, monto, ...over });

const ALQ_ID = `rec:rec-alq:${PERIODO}`;
const GAS_ID = `rec:rec-gas:${PERIODO}`;

const ALQUILER = fijoVirtual('rec-alq', CAT.alquiler, 'Alquiler', 700000, 10);                 // vencido
const LUZ = override('ov-luz', 'rec-luz', CAT.servicios, 'Luz', 120000, 100000, 15, { estado: 'pagado', fecha_pago: '2026-09-14' });
const GAS = fijoVirtual('rec-gas', CAT.servicios, 'Gas', 30000, 20);                            // no vencido
const AGUA = override('ov-agua', 'rec-agua', CAT.servicios, 'Agua', 15000, 15000, 12, { omitido: true });
const MONOTRIBUTO = override('ov-mono', 'rec-mono', CAT.impuestos, 'Monotributo', 20000, 20000, 5, { estado: 'pagado' });
const AIRE = unico('u-aire', CAT.otros, 'Arreglo del aire', 85000, { estado: 'pagado', fecha: '2026-09-03' });
const SILLA = unico('u-silla', CAT.otros, 'Silla', 40000, { fecha: '2026-09-10' });

const COMISIONES = { clave: 'comisiones' as const, nombre: 'Comisiones', monto: 385000, detalle: '', color: '#0ea5e9' };
const MERCADERIA = { clave: 'mercaderia' as const, nombre: 'Mercadería', monto: 27300, detalle: '', color: '#10b981' };

const MES: GastosMes = {
  periodo: PERIODO,
  derivados: [COMISIONES, MERCADERIA],
  recurrentes: [ALQUILER, LUZ, GAS, AGUA, MONOTRIBUTO],
  unicos: [AIRE, SILLA],
  totales: { derivados: 412300, recurrentes: 870000, unicos: 125000, total: 1407300, pagado: 225000, pendiente: 770000 },
};

const DETALLE: GastosDetalleMes = {
  periodo: PERIODO,
  ingresos: { servicios: 780000, productos: 300000, total: 1080000, turnos_cobrados: 12, productos_vendidos: 14, pendiente_cobro: 0 },
  comisiones: [
    { profesional_id: 'p-ana', nombre: 'Ana', avatar_url: null, servicios: 200000, productos: 15000, total: 215000, turnos_cobrados: 5 },
    { profesional_id: 'p-belen', nombre: 'Belén', avatar_url: null, servicios: 170000, productos: 0, total: 170000, turnos_cobrados: 3 },
  ],
  comisiones_total: 385000,
  mercaderia_costo: 27300,
  mercaderia_unidades: 14,
};

// ------------------------------------------------------------ Helpers

const plano = (s: string) => s.replace(/\s+/g, ' ').trim();
const moneda = (n: number) => plano(formatMoneda(n));
const texto = (el: Element | null) => plano(el?.textContent ?? '');

const fila = (id: string) => screen.getByTestId(`fila-${id}`);
const rubro = (catId: string) => screen.getByTestId(`rubro-${catId}`);
const checkDeFila = (id: string) => within(fila(id)).getByTestId('fila-checkbox') as HTMLInputElement;
const checkDeRubro = (catId: string) => within(rubro(catId)).getByTestId('rubro-checkbox') as HTMLInputElement;
const celdas = (id: string) => within(fila(id)).getAllByTitle('Doble clic para editar');
const celdaNombre = (id: string, nombre: string) => celdas(id).find((el) => texto(el) === nombre)!;
const celdaMonto = (id: string, monto: number) => celdas(id).find((el) => texto(el) === moneda(monto))!;
const inputEdicion = (id: string) => within(fila(id)).getByLabelText(/^Editar (nombre|monto) de /) as HTMLInputElement;
const idsDeRubrosEnPantalla = () =>
  screen.getAllByTestId(/^rubro-(?!checkbox)/).map((el) => el.getAttribute('data-testid'));
const ningunServicioLlamado = () => {
  expect(marcarPagados).not.toHaveBeenCalled();
  expect(actualizarGasto).not.toHaveBeenCalled();
  expect(actualizarRecurrente).not.toHaveBeenCalled();
  expect(guardarOverride).not.toHaveBeenCalled();
  expect(reemplazarRecurrente).not.toHaveBeenCalled();
};

type Props = React.ComponentProps<typeof GastosTablaMes>;

function renderTabla(over: Partial<Props> = {}) {
  const props: Props = {
    mes: MES, detalle: DETALLE, periodo: PERIODO, categorias: CATEGORIAS, isLoading: false,
    panelAbierto: false, onTogglePanel: vi.fn(), onAbrirPanel: vi.fn(), preset: null, presetNonce: 0,
    onEditar: vi.fn(), onEliminarUnico: vi.fn(), onCambio: vi.fn(),
    ...over,
  };
  const utils = render(<GastosTablaMes {...props} />);
  return { ...utils, props };
}

// Imita lo que hace GastosPage con el panel y el preset, para probar el chip
// de arranque de punta a punta (tabla → página → panel)
function Harness({ mes }: { mes: GastosMes }) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [preset, setPreset] = useState<{ valor: GastoFormPreset | null; nonce: number }>({ valor: null, nonce: 0 });
  return (
    <GastosTablaMes
      mes={mes} detalle={DETALLE} periodo={PERIODO} categorias={CATEGORIAS} isLoading={false}
      panelAbierto={panelAbierto}
      onTogglePanel={() => setPanelAbierto((v) => !v)}
      onAbrirPanel={(valor) => { setPanelAbierto(true); setPreset((p) => ({ valor: valor ?? null, nonce: p.nonce + 1 })); }}
      preset={preset.valor} presetNonce={preset.nonce}
      onEditar={vi.fn()} onEliminarUnico={vi.fn()} onCambio={vi.fn()}
    />
  );
}

const campo = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input, select') as HTMLInputElement | HTMLSelectElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  vi.clearAllMocks();
  marcarPagados.mockResolvedValue({ actualizados: 1 });
  actualizarGasto.mockResolvedValue({});
  actualizarRecurrente.mockResolvedValue({});
  guardarOverride.mockResolvedValue({});
  reemplazarRecurrente.mockResolvedValue({ id: 'rec-alq-nuevo' });
});

afterEach(() => {
  vi.useRealTimers();
});

// ================================================================== B.1

describe('agrupación y orden (funciones puras)', () => {
  it('B1: cada gasto aparece una sola vez y bajo su rubro', () => {
    const rubros = agruparPorRubro(MES, PERIODO);

    const todosLosIds = rubros.flatMap((r) => r.filas.map((f) => f.item.id));
    expect(todosLosIds).toHaveLength(7);
    expect(new Set(todosLosIds).size).toBe(7);

    const porRubro = Object.fromEntries(rubros.map((r) => [r.id, r.filas.map((f) => f.item.id).sort()]));
    expect(porRubro['cat-serv']).toEqual(['ov-agua', 'ov-luz', GAS_ID].sort());
    expect(porRubro['cat-otros']).toEqual(['u-aire', 'u-silla']);
    expect(porRubro['cat-alq']).toEqual([ALQ_ID]);      // un solo gasto forma su propio rubro
    expect(porRubro['cat-imp']).toEqual(['ov-mono']);
  });

  it('B2: vencidos → pendientes por día → pendientes sin día → todo pagado', () => {
    const rubros = agruparPorRubro(MES, PERIODO);

    expect(rubros.map((r) => r.id)).toEqual(['cat-alq', 'cat-serv', 'cat-otros', 'cat-imp']);
  });

  it('B3: entre dos rubros con vencidos, primero el que venció antes (día 5 antes que día 10)', () => {
    const mes: GastosMes = {
      ...MES, unicos: [],
      recurrentes: [
        fijoVirtual('rec-alq', CAT.alquiler, 'Alquiler', 700000, 10),
        fijoVirtual('rec-mono', CAT.impuestos, 'Monotributo', 20000, 5),
      ],
    };

    expect(agruparPorRubro(mes, PERIODO).map((r) => r.id)).toEqual(['cat-imp', 'cat-alq']);
  });

  it('B4: un rubro pendiente sin día va después de los pendientes con día, aunque venga primero', () => {
    const mes: GastosMes = {
      ...MES, unicos: [],
      recurrentes: [
        fijoVirtual('rec-seguro', CAT.otros, 'Seguro', 50000, null),   // Otros entra primero al mapa
        fijoVirtual('rec-gas', CAT.servicios, 'Gas', 30000, 20),
      ],
    };

    expect(agruparPorRubro(mes, PERIODO).map((r) => r.id)).toEqual(['cat-serv', 'cat-otros']);
  });

  it('B5: dentro del rubro, pendientes → pagados → omitidos; el orden entre iguales es el del backend', () => {
    const servicios = agruparPorRubro(MES, PERIODO).find((r) => r.id === 'cat-serv')!;
    expect(servicios.filas.map((f) => f.item.nombre)).toEqual(['Gas', 'Luz', 'Agua']);

    const silla = { item: SILLA, esFijo: false, pendiente: true, vencido: false };
    const mesa = { item: unico('u-mesa', CAT.otros, 'Mesa', 10000), esFijo: false, pendiente: true, vencido: false };
    expect(ordenarFilas([silla, mesa]).map((f) => f.item.nombre)).toEqual(['Silla', 'Mesa']);
    expect(ordenarFilas([mesa, silla]).map((f) => f.item.nombre)).toEqual(['Mesa', 'Silla']);
  });

  it('B6: en un mes pasado todo pendiente con día está vencido; en uno futuro, nada', () => {
    const vencidosDe = (periodo: string) =>
      Object.fromEntries(agruparPorRubro(MES, periodo).flatMap((r) => r.filas.map((f) => [f.item.nombre, f.vencido])));

    expect(vencidosDe('2026-09')).toMatchObject({ Alquiler: true, Gas: false, Luz: false, Agua: false, Silla: false });
    expect(vencidosDe('2026-08')).toMatchObject({ Alquiler: true, Gas: true, Luz: false, Agua: false, Monotributo: false, Silla: false });
    expect(vencidosDe('2026-10')).toMatchObject({ Alquiler: false, Gas: false, Luz: false, Agua: false, Silla: false });

    // Agosto: los dos rubros vencidos se ordenan por día (10 antes que 20)
    expect(agruparPorRubro(MES, '2026-08').map((r) => r.id)).toEqual(['cat-alq', 'cat-serv', 'cat-otros', 'cat-imp']);
    // Octubre: nada vencido, pendientes por día, sin día al final, pagados últimos
    expect(agruparPorRubro(MES, '2026-10').map((r) => r.id)).toEqual(['cat-alq', 'cat-serv', 'cat-otros', 'cat-imp']);
  });

  it('Q4: un rubro con todas las filas omitidas no cuenta filas y va al bloque de completos', () => {
    const mes: GastosMes = { ...MES, unicos: [], recurrentes: [AGUA, ALQUILER] };   // Servicios entra primero

    const rubros = agruparPorRubro(mes, PERIODO);
    expect(rubros.map((r) => r.id)).toEqual(['cat-alq', 'cat-serv']);
    const servicios = rubros.find((r) => r.id === 'cat-serv')!;
    expect(servicios.contables).toBe(0);
    expect(servicios.subtotal).toBe(0);
    expect(filasQueCambian(servicios, 'pagado')).toEqual([]);
  });

  it('Q5: la tilde de rubro manda solo las filas que cambian de estado, nunca las omitidas', () => {
    const rubros = agruparPorRubro(MES, PERIODO);
    const servicios = rubros.find((r) => r.id === 'cat-serv')!;
    const impuestos = rubros.find((r) => r.id === 'cat-imp')!;

    expect(filasQueCambian(servicios, 'pagado').map((f) => f.item.nombre)).toEqual(['Gas']);
    expect(filasQueCambian(servicios, 'pendiente').map((f) => f.item.nombre)).toEqual(['Luz']);
    expect(filasQueCambian(impuestos, 'pendiente').map((f) => f.item.nombre)).toEqual(['Monotributo']);
    expect(filasQueCambian(impuestos, 'pagado')).toEqual([]);
  });
});

// ================================================================== render

describe('render: rubros y cabeceras', () => {
  it('B2: los rubros salen en pantalla en el orden esperado, automáticos al final', () => {
    renderTabla();

    expect(idsDeRubrosEnPantalla()).toEqual([
      'rubro-cat-alq', 'rubro-cat-serv', 'rubro-cat-otros', 'rubro-cat-imp',
      'rubro-auto-comisiones', 'rubro-auto-mercaderia',
    ]);
  });

  it('B1: cada nombre aparece una sola vez', () => {
    renderTabla();

    // Solo dentro de las filas de gasto: la cabecera del rubro "Alquiler" también dice "Alquiler"
    for (const nombre of ['Alquiler', 'Luz', 'Gas', 'Agua', 'Monotributo', 'Arreglo del aire', 'Silla']) {
      expect(screen.getAllByText(nombre).filter((el) => el.closest('[data-testid^="fila-"]'))).toHaveLength(1);
    }
  });

  it('B12: checkbox de rubro checked / indeterminate / vacío, y "n/m pagados" sin contar omitidos', () => {
    renderTabla();

    expect(checkDeRubro('cat-imp').checked).toBe(true);
    expect(checkDeRubro('cat-imp').indeterminate).toBe(false);
    expect(checkDeRubro('cat-serv').checked).toBe(false);
    expect(checkDeRubro('cat-serv').indeterminate).toBe(true);
    expect(checkDeRubro('cat-alq').checked).toBe(false);
    expect(checkDeRubro('cat-alq').indeterminate).toBe(false);

    expect(texto(rubro('cat-serv'))).toContain('1/2 pagados');    // Agua no cuenta
    expect(texto(rubro('cat-imp'))).toContain('1/1 pagados');
    expect(texto(rubro('cat-alq'))).toContain('0/1 pagados');
  });

  it('Q4: rubro con todo omitido → checkbox deshabilitado, "0/0 pagados"', () => {
    renderTabla({ mes: { ...MES, unicos: [], recurrentes: [AGUA, ALQUILER] } });

    expect(checkDeRubro('cat-serv').disabled).toBe(true);
    expect(texto(rubro('cat-serv'))).toContain('0/0 pagados');
    fireEvent.click(checkDeRubro('cat-serv'));
    expect(marcarPagados).not.toHaveBeenCalled();
  });
});

// ================================================================== B.2

describe('tilde: qué se manda al endpoint', () => {
  it('B7: tildar un único pendiente manda { id }, una sola llamada, y después refresca', async () => {
    const { props } = renderTabla();

    fireEvent.click(checkDeFila('u-silla'));

    await waitFor(() => expect(props.onCambio).toHaveBeenCalledTimes(1));
    expect(marcarPagados).toHaveBeenCalledTimes(1);
    expect(marcarPagados).toHaveBeenCalledWith(PERIODO, 'pagado', [{ id: 'u-silla' }]);
  });

  it('B8: tildar un fijo proyectado manda { recurrente_id }, nunca el id sintético', async () => {
    renderTabla();

    fireEvent.click(checkDeFila(ALQ_ID));

    await waitFor(() => expect(marcarPagados).toHaveBeenCalledTimes(1));
    expect(marcarPagados.mock.calls[0]).toEqual([PERIODO, 'pagado', [{ recurrente_id: 'rec-alq' }]]);
  });

  it('B9: destildar un override ya guardado va por recurrente_id aunque tenga id real', async () => {
    renderTabla();

    fireEvent.click(checkDeFila('ov-luz'));

    await waitFor(() => expect(marcarPagados).toHaveBeenCalledTimes(1));
    expect(marcarPagados.mock.calls[0]).toEqual([PERIODO, 'pendiente', [{ recurrente_id: 'rec-luz' }]]);
  });

  it('B10 (Q5): tildar un rubro mixto manda solo las pendientes: Gas sí, Luz (ya pagada) y Agua (omitida) no', async () => {
    renderTabla();

    fireEvent.click(checkDeRubro('cat-serv'));

    await waitFor(() => expect(marcarPagados).toHaveBeenCalledTimes(1));
    const [periodo, estado, items] = marcarPagados.mock.calls[0];
    expect(periodo).toBe(PERIODO);
    expect(estado).toBe('pagado');
    expect(items).toEqual([{ recurrente_id: 'rec-gas' }]);
  });

  it('B11: destildar un rubro completo vuelve todo a pendiente', async () => {
    renderTabla();

    fireEvent.click(checkDeRubro('cat-imp'));

    await waitFor(() => expect(marcarPagados).toHaveBeenCalledTimes(1));
    expect(marcarPagados).toHaveBeenCalledWith(PERIODO, 'pendiente', [{ recurrente_id: 'rec-mono' }]);
  });

  it('B13: la fila omitida no se puede tildar y se ve como "este mes no se paga"', () => {
    renderTabla();
    const agua = fila('ov-agua');

    expect(checkDeFila('ov-agua').disabled).toBe(true);
    expect(within(agua).getByText('este mes no se paga')).toBeTruthy();
    expect(within(agua).getByText('Agua').className).toContain('line-through');
    const monto = within(agua).getByText((_, el) => el?.tagName === 'SPAN' && texto(el) === moneda(15000));
    expect(monto.className).toContain('line-through');

    fireEvent.click(checkDeFila('ov-agua'));
    expect(marcarPagados).not.toHaveBeenCalled();
  });

  it('B14: si el backend falla, hay toast de error, la tilde no queda marcada y no se refresca', async () => {
    marcarPagados.mockRejectedValue({ response: { data: { message: 'Se cayó el servidor' } } });
    const { props } = renderTabla();

    fireEvent.click(checkDeFila('u-silla'));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Se cayó el servidor'));
    expect(checkDeFila('u-silla').checked).toBe(false);
    expect(props.onCambio).not.toHaveBeenCalled();
  });
});

// ================================================================== B.3

describe('rubros automáticos, badges y montos', () => {
  it('B15: comisiones y mercadería tienen candado, sin tilde ni editar ni borrar; mercadería dice las unidades', () => {
    renderTabla();

    for (const clave of ['comisiones', 'mercaderia']) {
      const auto = screen.getByTestId(`rubro-auto-${clave}`);
      expect(within(auto).queryAllByRole('checkbox')).toHaveLength(0);
      expect(within(auto).queryAllByRole('button', { name: /^(Editar|Eliminar) / })).toHaveLength(0);
      expect(within(auto).getByLabelText('Se calcula solo')).toBeTruthy();
    }
    expect(texto(screen.getByTestId('rubro-auto-comisiones'))).toContain(moneda(385000));
    expect(texto(screen.getByTestId('rubro-auto-mercaderia'))).toContain('14 unidades');
    expect(texto(screen.getByTestId('rubro-auto-mercaderia'))).toContain(moneda(27300));
  });

  it('B15: un derivado en 0 no muestra su rubro', () => {
    renderTabla({ mes: { ...MES, derivados: [{ ...COMISIONES, monto: 0 }, MERCADERIA] } });

    expect(screen.queryByTestId('rubro-auto-comisiones')).toBeNull();
    expect(screen.getByTestId('rubro-auto-mercaderia')).toBeTruthy();
  });

  it('B16: "ver por profesional" despliega a cada una con sus turnos, productos y total', () => {
    renderTabla();
    expect(screen.queryByTestId('comisiones-profesionales')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ver por profesional/ }));

    const panel = screen.getByTestId('comisiones-profesionales');
    const filaDe = (nombre: string) => within(panel).getByText(nombre).parentElement!.parentElement!;
    const ana = texto(filaDe('Ana'));
    expect(ana).toContain('5 turnos');
    expect(ana).toContain(`${moneda(15000)} por productos`);
    expect(ana).toContain(moneda(215000));
    const belen = texto(filaDe('Belén'));
    expect(belen).toContain('3 turnos');
    expect(belen).not.toContain('por productos');
    expect(belen).toContain(moneda(170000));
  });

  it('B17: badge "fijo" solo en recurrentes; "este mes distinto" solo cuando el monto difiere del normal', () => {
    renderTabla();

    for (const id of [ALQ_ID, 'ov-luz', GAS_ID, 'ov-agua', 'ov-mono']) {
      expect(within(fila(id)).getByText('fijo')).toBeTruthy();
    }
    for (const id of ['u-silla', 'u-aire']) {
      expect(within(fila(id)).queryByText('fijo')).toBeNull();
    }
    expect(texto(within(fila('ov-luz')).getByText(/este mes distinto/))).toBe(`este mes distinto · normalmente ${moneda(100000)}`);
    expect(within(fila('ov-mono')).queryByText(/este mes distinto/)).toBeNull();
  });

  it('B18: subtotales sin omitidos y total del mes con derivados', () => {
    renderTabla();

    const subtotalDe = (catId: string) => texto(within(rubro(catId)).getByTestId('subtotal'));
    expect(subtotalDe('cat-serv')).toContain(moneda(150000));   // Luz + Gas, Agua no
    expect(subtotalDe('cat-otros')).toContain(moneda(125000));
    expect(subtotalDe('cat-alq')).toContain(moneda(700000));
    expect(subtotalDe('cat-imp')).toContain(moneda(20000));
    expect(texto(screen.getByTestId('total-mes'))).toContain(moneda(1407300));
  });

  it('B19 (Q9): "venció" solo en pendientes vencidos y en rojo; "pagado el" gana sobre "vence el"', () => {
    renderTabla();

    const vencio = within(fila(ALQ_ID)).getAllByText(/venció el 10/);
    expect(vencio.length).toBeGreaterThan(0);
    vencio.forEach((el) => expect(el.className).toContain('text-red-600'));

    expect(within(fila(GAS_ID)).getAllByText(/vence el 20/).length).toBeGreaterThan(0);
    expect(within(fila(GAS_ID)).queryByText(/venció/)).toBeNull();

    expect(within(fila('ov-mono')).queryByText(/venció/)).toBeNull();

    expect(within(fila('ov-luz')).getAllByText(/pagado el 14\/09/).length).toBeGreaterThan(0);
    expect(within(fila('ov-luz')).queryByText(/vence el 15/)).toBeNull();

    expect(within(fila('u-aire')).getAllByText('03/09').length).toBeGreaterThan(0);
  });

  it('B20: la fila pagada va tachada y en gris; la pendiente no', () => {
    renderTabla();

    expect(celdaNombre('u-aire', 'Arreglo del aire').className).toContain('line-through');
    expect(fila('u-aire').className).toContain('text-gray-400');
    expect(celdaNombre('u-silla', 'Silla').className).not.toContain('line-through');
    expect(fila('u-silla').className).not.toContain('text-gray-400');
  });

  it('B21: borrar solo en únicos y pasa por confirmación; editar en todas las filas cargadas', () => {
    const { props } = renderTabla();

    const eliminar = screen.getAllByRole('button', { name: /^Eliminar / });
    expect(eliminar.map((b) => b.getAttribute('aria-label')).sort()).toEqual(['Eliminar Arreglo del aire', 'Eliminar Silla']);
    expect(screen.getAllByRole('button', { name: /^Editar / })).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Silla' }));
    expect(props.onEliminarUnico).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-silla' }));

    fireEvent.click(screen.getByRole('button', { name: 'Editar Alquiler' }));
    expect(props.onEditar).toHaveBeenCalledWith(expect.objectContaining({ id: ALQ_ID }), true);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Silla' }));
    expect(props.onEditar).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-silla' }), false);
  });

  it('B22: nada de jerga interna en pantalla', () => {
    renderTabla();
    fireEvent.click(screen.getByRole('button', { name: /ver por profesional/ }));

    expect(document.body.textContent).not.toMatch(/recurrente|override|plantilla|derivado|virtual|rec:/i);
  });
});

// ================================================================== B.4

describe('doble clic (edición inline)', () => {
  it('B23: nombre de un único: Enter guarda, Escape cancela, mismo valor no guarda', async () => {
    renderTabla();

    fireEvent.doubleClick(celdaNombre('u-silla', 'Silla'));
    const input = inputEdicion('u-silla');
    expect(input.value).toBe('Silla');
    fireEvent.change(input, { target: { value: 'Silla nueva' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(actualizarGasto).toHaveBeenCalledWith('u-silla', { nombre: 'Silla nueva' }));

    actualizarGasto.mockClear();
    fireEvent.doubleClick(celdaNombre('u-silla', 'Silla'));
    fireEvent.change(inputEdicion('u-silla'), { target: { value: 'Otra cosa' } });
    fireEvent.keyDown(inputEdicion('u-silla'), { key: 'Escape' });
    expect(actualizarGasto).not.toHaveBeenCalled();
    expect(celdaNombre('u-silla', 'Silla')).toBeTruthy();

    fireEvent.doubleClick(celdaNombre('u-silla', 'Silla'));
    fireEvent.keyDown(inputEdicion('u-silla'), { key: 'Enter' });
    expect(actualizarGasto).not.toHaveBeenCalled();
  });

  it('B24: monto de un único: se manda como número; Enter y blur guardan', async () => {
    renderTabla();

    fireEvent.doubleClick(celdaMonto('u-silla', 40000));
    expect(inputEdicion('u-silla').value).toBe('40000');
    fireEvent.change(inputEdicion('u-silla'), { target: { value: '45000' } });
    fireEvent.keyDown(inputEdicion('u-silla'), { key: 'Enter' });
    await waitFor(() => expect(actualizarGasto).toHaveBeenCalledWith('u-silla', { monto: 45000 }));

    actualizarGasto.mockClear();
    fireEvent.doubleClick(celdaMonto('u-silla', 40000));
    fireEvent.change(inputEdicion('u-silla'), { target: { value: '46000' } });
    fireEvent.blur(inputEdicion('u-silla'));
    await waitFor(() => expect(actualizarGasto).toHaveBeenCalledWith('u-silla', { monto: 46000 }));
  });

  it('B25: nombre de un fijo proyectado va a la plantilla, no al id sintético', async () => {
    renderTabla();

    fireEvent.doubleClick(celdaNombre(ALQ_ID, 'Alquiler'));
    fireEvent.change(inputEdicion(ALQ_ID), { target: { value: 'Alquiler local' } });
    fireEvent.keyDown(inputEdicion(ALQ_ID), { key: 'Enter' });

    await waitFor(() => expect(actualizarRecurrente).toHaveBeenCalledWith('rec-alq', { nombre: 'Alquiler local' }));
    expect(actualizarGasto).not.toHaveBeenCalled();
  });

  it('B26: monto de un fijo + Enter no guarda nada: abre la línea de alcance con "desde este mes" resaltado', () => {
    renderTabla();

    fireEvent.doubleClick(celdaMonto(ALQ_ID, 700000));
    fireEvent.change(inputEdicion(ALQ_ID), { target: { value: '750000' } });
    fireEvent.keyDown(inputEdicion(ALQ_ID), { key: 'Enter' });

    ningunServicioLlamado();
    const alcance = screen.getByTestId('alcance-monto');
    expect(texto(alcance)).toContain(`${moneda(750000)} para septiembre:`);
    const opcion = (nombre: string) => within(alcance).getByRole('button', { name: nombre });
    expect(opcion('desde este mes en adelante').className).toContain('bg-blue-600');
    expect(opcion('solo este mes').className).not.toContain('bg-blue-600');
    expect(opcion('siempre fue así').className).not.toContain('bg-blue-600');
    expect(opcion('cancelar')).toBeTruthy();
  });

  it('B26: en un mes pasado el default es "solo este mes"', () => {
    renderTabla({ periodo: '2026-08', mes: { ...MES, periodo: '2026-08' } });

    fireEvent.doubleClick(celdaMonto(ALQ_ID, 700000));
    fireEvent.change(inputEdicion(ALQ_ID), { target: { value: '750000' } });
    fireEvent.keyDown(inputEdicion(ALQ_ID), { key: 'Enter' });

    const alcance = screen.getByTestId('alcance-monto');
    expect(texto(alcance)).toContain('para agosto:');
    expect(within(alcance).getByRole('button', { name: 'solo este mes' }).className).toContain('bg-blue-600');
    expect(within(alcance).getByRole('button', { name: 'desde este mes en adelante' }).className).not.toContain('bg-blue-600');
  });

  it('B26 (Q10): en el monto de un fijo, salir del input sin Enter cancela: ni alcance ni guardado', () => {
    renderTabla();

    fireEvent.doubleClick(celdaMonto(ALQ_ID, 700000));
    fireEvent.change(inputEdicion(ALQ_ID), { target: { value: '750000' } });
    fireEvent.blur(inputEdicion(ALQ_ID));

    ningunServicioLlamado();
    expect(screen.queryByTestId('alcance-monto')).toBeNull();
    expect(celdaMonto(ALQ_ID, 700000)).toBeTruthy();
  });

  const abrirAlcance = () => {
    fireEvent.doubleClick(celdaMonto(ALQ_ID, 700000));
    fireEvent.change(inputEdicion(ALQ_ID), { target: { value: '750000' } });
    fireEvent.keyDown(inputEdicion(ALQ_ID), { key: 'Enter' });
    return screen.getByTestId('alcance-monto');
  };

  it('B27: "solo este mes" guarda el override de este mes y nada más', async () => {
    const { props } = renderTabla();
    fireEvent.click(within(abrirAlcance()).getByRole('button', { name: 'solo este mes' }));

    await waitFor(() => expect(props.onCambio).toHaveBeenCalledTimes(1));
    expect(guardarOverride).toHaveBeenCalledWith('rec-alq', PERIODO, { monto: 750000 });
    expect(reemplazarRecurrente).not.toHaveBeenCalled();
    expect(actualizarRecurrente).not.toHaveBeenCalled();
    expect(screen.queryByTestId('alcance-monto')).toBeNull();
  });

  it('B27: "desde este mes en adelante" reemplaza la plantilla desde este mes y nada más', async () => {
    const { props } = renderTabla();
    fireEvent.click(within(abrirAlcance()).getByRole('button', { name: 'desde este mes en adelante' }));

    await waitFor(() => expect(props.onCambio).toHaveBeenCalledTimes(1));
    expect(reemplazarRecurrente).toHaveBeenCalledWith('rec-alq', PERIODO, 750000);
    expect(guardarOverride).not.toHaveBeenCalled();
    expect(actualizarRecurrente).not.toHaveBeenCalled();
  });

  it('B27: "siempre fue así" corrige el monto base de la plantilla y nada más', async () => {
    const { props } = renderTabla();
    fireEvent.click(within(abrirAlcance()).getByRole('button', { name: 'siempre fue así' }));

    await waitFor(() => expect(props.onCambio).toHaveBeenCalledTimes(1));
    expect(actualizarRecurrente).toHaveBeenCalledWith('rec-alq', { monto_default: 750000 });
    expect(guardarOverride).not.toHaveBeenCalled();
    expect(reemplazarRecurrente).not.toHaveBeenCalled();
  });

  it('B27: "cancelar" no llama a nada y el monto vuelve al original', () => {
    const { props } = renderTabla();
    fireEvent.click(within(abrirAlcance()).getByRole('button', { name: 'cancelar' }));

    ningunServicioLlamado();
    expect(props.onCambio).not.toHaveBeenCalled();
    expect(screen.queryByTestId('alcance-monto')).toBeNull();
    expect(celdaMonto(ALQ_ID, 700000)).toBeTruthy();
  });
});

// ================================================================== B.5

describe('mes vacío', () => {
  const VACIO: GastosMes = {
    ...MES, recurrentes: [], unicos: [],
    totales: { derivados: 412300, recurrentes: 0, unicos: 0, total: 412300, pagado: 0, pendiente: 0 },
  };

  it('B29 (Q8): sin fijos ni únicos aparece el arranque guiado con el panel abierto, más los rubros automáticos y el total', () => {
    render(<Harness mes={VACIO} />);

    expect(screen.getByTestId('arranque-guiado')).toBeTruthy();
    expect(screen.getByTestId('gasto-form-inline')).toBeTruthy();
    expect(screen.queryAllByTestId(/^rubro-cat-/)).toHaveLength(0);
    expect(screen.getByTestId('rubro-auto-comisiones')).toBeTruthy();
    expect(screen.getByTestId('rubro-auto-mercaderia')).toBeTruthy();
    expect(texto(screen.getByTestId('total-mes'))).toContain(moneda(412300));
  });

  it('B29: el chip "Alquiler" deja el panel en Sí, con nombre y categoría puestos y el foco en el monto', async () => {
    render(<Harness mes={VACIO} />);

    fireEvent.click(screen.getByRole('button', { name: 'Alquiler' }));

    expect(screen.getByRole('radio', { name: 'Sí' }).getAttribute('aria-checked')).toBe('true');
    expect(campo('Gasto').value).toBe('Alquiler');
    expect(campo('Categoría').value).toBe('cat-alq');
    expect(screen.getByText('Vence el día')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo('Monto')));
  });
});
