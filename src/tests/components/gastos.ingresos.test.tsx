import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GastosTablaMes, agruparPorRubro } from '../../components/gastos/GastosTablaMes';
import { GastoFormInline } from '../../components/gastos/GastoFormInline';
import { GastosResumenSimple } from '../../components/gastos/GastosResumenSimple';
import { GastosQueEntro } from '../../components/gastos/GastosQueEntro';
import { GastosPorProfesional } from '../../components/gastos/GastosPorProfesional';
import { GastosCategoriasModal } from '../../components/gastos/GastosCategoriasModal';
import { formatMoneda } from '../../components/gastos/gastos.utils';
import type {
  GastoCategoria, GastoMesItem, GastosDetalleMes, GastosMes, GastosProfesionalMes, GastosResumen,
} from '../../types/gastos.types';

// Ingresos a mano y "No cuenta" en la pantalla de Gastos
// (backend/docs/gastos-ingresos-plan.md). Hoy = 15/11/2026.

const marcarPagados = vi.fn();
const crearGasto = vi.fn();
const crearRecurrente = vi.fn();
const crearCategoria = vi.fn();

vi.mock('../../services/gastos.service', () => ({
  gastosService: {
    marcarPagados: (...a: unknown[]) => marcarPagados(...a),
    crearGasto: (...a: unknown[]) => crearGasto(...a),
    crearRecurrente: (...a: unknown[]) => crearRecurrente(...a),
    crearCategoria: (...a: unknown[]) => crearCategoria(...a),
    actualizarGasto: vi.fn(), actualizarRecurrente: vi.fn(), guardarOverride: vi.fn(), reemplazarRecurrente: vi.fn(),
    actualizarCategoria: vi.fn(), eliminarCategoria: vi.fn(),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const plano = (s: string) => s.replace(/\s+/g, ' ').trim();
const moneda = (n: number) => plano(formatMoneda(n));
const texto = (el: Element | null) => plano(el?.textContent ?? '');

const PERIODO = '2026-11';

const CAT = {
  alquiler: { id: 'cat-alq', nombre: 'Alquiler', color: '#1d4ed8', tipo: 'gasto' as const },
  otros: { id: 'cat-otros', nombre: 'Otros', color: '#64748b', tipo: 'gasto' as const },
  empleados: { id: 'cat-emp', nombre: 'Empleados', color: '#16a34a', tipo: 'ingreso' as const },
  otrosIng: { id: 'cat-oi', nombre: 'Otros ingresos', color: '#0ea5e9', tipo: 'ingreso' as const },
};

const CATEGORIAS: GastoCategoria[] = [
  { ...CAT.alquiler, orden: 1, activa: true },
  { ...CAT.otros, orden: 9, activa: true },
  { ...CAT.empleados, orden: 20, activa: true },
  { ...CAT.otrosIng, orden: 21, activa: true },
];

const base = {
  es_virtual: false, recurrente_id: null, descripcion: null, estado: 'pendiente' as const,
  omitido: false, fecha: null, fecha_pago: null, dia_vencimiento: null, metodo_pago: null, notas: null,
};

const ALQUILER: GastoMesItem = { ...base, id: `rec:rec-alq:${PERIODO}`, es_virtual: true, recurrente_id: 'rec-alq', categoria: CAT.alquiler, nombre: 'Alquiler', monto: 700000, dia_vencimiento: 10 };
const JULI: GastoMesItem = { ...base, id: `rec:rec-juli:${PERIODO}`, es_virtual: true, recurrente_id: 'rec-juli', categoria: CAT.empleados, nombre: 'Juli — sillón', monto: 150000, dia_vencimiento: 5 };
const SENIA: GastoMesItem = { ...base, id: 'u-senia', categoria: CAT.otrosIng, nombre: 'Alquiler del salón un domingo', monto: 40000, estado: 'pagado', fecha_pago: '2026-11-03' };

const MES: GastosMes = {
  periodo: PERIODO,
  derivados: [{ clave: 'comisiones', nombre: 'Comisiones', monto: 200000, detalle: '', color: '#0ea5e9' }],
  recurrentes: [ALQUILER],
  unicos: [],
  ingresos_fijos: [JULI],
  ingresos_unicos: [SENIA],
  totales: {
    derivados: 200000, recurrentes: 700000, unicos: 0, total: 900000, pagado: 0, pendiente: 700000,
    ingresos_fijos: 150000, ingresos_unicos: 40000, ingresos: 190000, cobrado: 40000, por_cobrar: 150000,
  },
};

type TablaProps = React.ComponentProps<typeof GastosTablaMes>;

function renderTabla(over: Partial<TablaProps> = {}) {
  const props: TablaProps = {
    mes: MES, periodo: PERIODO, categorias: CATEGORIAS, isLoading: false,
    panelAbierto: false, onTogglePanel: vi.fn(), onAbrirPanel: vi.fn(), preset: null, presetNonce: 0,
    onEditar: vi.fn(), onEliminarUnico: vi.fn(), onCambio: vi.fn(),
    ...over,
  };
  return { ...render(<GastosTablaMes {...props} />), props };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
  vi.clearAllMocks();
  marcarPagados.mockResolvedValue({ actualizados: 1 });
  crearGasto.mockResolvedValue({});
  crearRecurrente.mockResolvedValue({});
  crearCategoria.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

// ================================================================ Tabla

describe('GastosTablaMes en modo ingreso', () => {
  it('agrupa solo los ingresos; en modo gasto, solo los gastos', () => {
    expect(agruparPorRubro(MES, PERIODO, 'ingreso').map((r) => r.id)).toEqual(['cat-emp', 'cat-oi']);
    expect(agruparPorRubro(MES, PERIODO).map((r) => r.id)).toEqual(['cat-alq']);
  });

  it('muestra "Ingresos de …", las filas de ingresos, la tilde como "cobrado" y el total de ingresos', () => {
    renderTabla({ modo: 'ingreso' });
    const tabla = screen.getByTestId('ingresos-tabla-mes');

    expect(within(tabla).getByText('Ingresos de noviembre')).toBeInTheDocument();
    expect(within(tabla).getByRole('button', { name: /Nuevo ingreso/ })).toBeInTheDocument();
    expect(within(tabla).queryByText('Alquiler')).not.toBeInTheDocument();
    expect(within(tabla).queryByText('A pagar a profesionales')).not.toBeInTheDocument();

    const juli = screen.getByTestId(`fila-${JULI.id}`);
    expect(within(juli).getByLabelText('Juli — sillón: marcar cobrado')).toBeInTheDocument();
    expect(texto(juli)).toContain('se cobraba el 5');   // día 5 ya pasó: atrasado
    expect(texto(screen.getByTestId(`fila-${SENIA.id}`))).toContain('cobrado el 03/11');
    expect(texto(screen.getByTestId('rubro-cat-emp'))).toContain('0/1 cobrados');
    expect(texto(screen.getByTestId('total-mes'))).toContain(moneda(190000));
  });

  it('tildar un ingreso usa el mismo PATCH /pagado que los gastos', async () => {
    renderTabla({ modo: 'ingreso' });
    fireEvent.click(within(screen.getByTestId(`fila-${JULI.id}`)).getByTestId('fila-checkbox'));

    await waitFor(() => expect(marcarPagados).toHaveBeenCalledWith(PERIODO, 'pagado', [{ recurrente_id: 'rec-juli' }]));
  });

  it('sin ingresos no abre el formulario solo (a diferencia de un mes sin gastos): un texto y el botón', () => {
    renderTabla({ modo: 'ingreso', mes: { ...MES, ingresos_fijos: [], ingresos_unicos: [] } });

    expect(screen.getByTestId('ingresos-vacio')).toBeInTheDocument();
    expect(screen.queryByTestId('ingreso-form-inline')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nuevo ingreso/ })).toBeInTheDocument();
    expect(screen.queryByTestId('total-mes')).not.toBeInTheDocument();
  });

  it('la tabla de gastos no cambia: sus textos siguen siendo de pago', () => {
    renderTabla();
    expect(screen.getByText('Gastos de noviembre')).toBeInTheDocument();
    expect(screen.getByLabelText('Alquiler: marcar pagado')).toBeInTheDocument();
    expect(screen.queryByText('Juli — sillón')).not.toBeInTheDocument();
  });
});

// ======================================================= Formulario de alta

describe('GastoFormInline: cada formulario ofrece solo las categorías de su tipo', () => {
  // El Select del kit no vincula label y select: se busca por el texto del label
  const selectCategoria = () => screen.getByText('Categoría').parentElement!.querySelector('select') as HTMLSelectElement;
  const opciones = () => Array.from(selectCategoria().options).map((o) => o.text);
  const renderForm = (modo?: 'gasto' | 'ingreso') => render(
    <GastoFormInline abierto periodo={PERIODO} categorias={CATEGORIAS} preset={null} presetNonce={0} onGuardado={vi.fn()} modo={modo} />
  );

  it('gastos: solo categorías de gasto, con "Otros" por defecto', () => {
    renderForm();
    expect(opciones()).toEqual(['Alquiler', 'Otros']);
    expect(selectCategoria().value).toBe('cat-otros');
  });

  it('ingresos: solo categorías de ingreso, textos de cobro, y guarda un fijo "Juli — sillón" en Empleados', async () => {
    renderForm('ingreso');
    expect(opciones()).toEqual(['Empleados', 'Otros ingresos']);
    expect(screen.getByText('Ya lo cobré')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ingreso'), { target: { value: 'Juli — sillón' } });
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
    expect(screen.getByLabelText('Se cobra el día')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(crearRecurrente).toHaveBeenCalledWith({
      categoria_id: 'cat-emp', nombre: 'Juli — sillón', monto_default: 150000, dia_vencimiento: null, periodo_desde: PERIODO,
    }));
  });

  it('ingresos sin categorías de ingreso: avisa que hay que crear una y no llama a la API', () => {
    render(
      <GastoFormInline abierto periodo={PERIODO} categorias={CATEGORIAS.filter((c) => c.tipo === 'gasto')} preset={null} presetNonce={0} onGuardado={vi.fn()} modo="ingreso" />
    );
    fireEvent.change(screen.getByLabelText('Ingreso'), { target: { value: 'Juli' } });
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('No hay categorías de ingreso: creá una en Categorías');
    expect(crearGasto).not.toHaveBeenCalled();
  });
});

// =========================================================== Resumen

const RESUMEN: GastosResumen = {
  periodo: PERIODO,
  total_gastos: 900000, fijos: 700000, variables: 0, derivados: 200000,
  ingresos: 1190000, neto: 290000, margen_pct: 24.4,
  pagado: 0, pendiente: 700000, ratio_gastos_ingresos: 0.76, acumulado_anio: 0, promedio_mensual_anio: 0,
  anterior: null,
  ingresos_facturado: 1000000, ingresos_cargados: 190000, facturado_excluido: 630000,
};

const prof = (over: Partial<GastosProfesionalMes>): GastosProfesionalMes => ({
  profesional_id: 'p', nombre: 'X', avatar_url: null, es_duenio: false, activo: true,
  facturado_servicios: 0, facturado_productos: 0, facturado: 0,
  a_pagar_servicios: 0, a_pagar_productos: 0, a_pagar: 0, ganancia_salon: 0,
  turnos_cobrados: 0, canjes: 0, unidades_vendidas: 0, pendiente_cobro: 0, cuenta_en_gastos: true,
  ...over,
});

const DANI = prof({ profesional_id: 'p-dani', nombre: 'Dani', es_duenio: true, facturado: 630000, ganancia_salon: 630000, cuenta_en_gastos: false });
const ANA = prof({ profesional_id: 'p-ana', nombre: 'Ana', facturado: 1000000, a_pagar: 200000, ganancia_salon: 800000 });

const DETALLE: GastosDetalleMes = {
  periodo: PERIODO,
  ingresos: { servicios: 900000, productos: 100000, total: 1000000, turnos_cobrados: 40, productos_vendidos: 5, pendiente_cobro: 0, cargados: 190000 },
  profesionales: [DANI, ANA],
  // Los totales vienen del backend sin Dani
  totales: { facturado: 1000000, a_pagar: 200000, ganancia_salon: 800000, facturado_duenio: 0, facturado_excluido: 630000 },
  productos: { costo_vendido: 0, costo_canjes: 0, unidades: 5 },
  a_pagar_total: 200000,
};

describe('GastosResumenSimple con ingresos cargados y gente que no cuenta', () => {
  it('"Entró" muestra el total del backend y el desglose facturado + ingresos cargados', () => {
    render(<GastosResumenSimple resumen={RESUMEN} detalle={DETALLE} isLoading={false} />);

    const entro = screen.getByText('Entró').closest('div.rounded-xl')!;
    expect(texto(entro)).toContain(moneda(1190000));
    expect(texto(screen.getByTestId('entro-desglose'))).toBe(`${moneda(1000000)} facturado + ${moneda(190000)} de ingresos cargados`);
  });

  it('con facturado_excluido > 0 aparece la nota "No cuenta"', () => {
    render(<GastosResumenSimple resumen={RESUMEN} detalle={DETALLE} isLoading={false} />);
    expect(texto(screen.getByTestId('nota-excluido'))).toMatch(new RegExp(`^No cuenta: ${moneda(630000).replace(/[$.]/g, '\\$&')} facturado por quienes no cuentan en Gastos`));
  });

  it('sin ingresos cargados ni excluidos queda como siempre', () => {
    render(<GastosResumenSimple resumen={{ ...RESUMEN, ingresos_cargados: 0, facturado_excluido: 0 }} detalle={{ ...DETALLE, ingresos: { ...DETALLE.ingresos, cargados: 0 } }} isLoading={false} />);
    expect(screen.queryByTestId('entro-desglose')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nota-excluido')).not.toBeInTheDocument();
    expect(screen.getByText(/40 turnos cobrados/)).toBeInTheDocument();
  });
});

describe('GastosQueEntro', () => {
  it('suma la línea "Ingresos cargados" y el total es servicios + productos + cargados', () => {
    render(<MemoryRouter><GastosQueEntro detalle={DETALLE} isLoading={false} /></MemoryRouter>);
    const card = screen.getByTestId('gastos-que-entro');

    expect(texto(screen.getByTestId('ingresos-cargados'))).toContain('Ingresos cargados');
    expect(texto(screen.getByTestId('ingresos-cargados'))).toContain(moneda(190000));
    expect(texto(card.firstElementChild)).toContain(moneda(1190000));
  });

  it('sin ingresos cargados no aparece la línea', () => {
    render(<MemoryRouter><GastosQueEntro detalle={{ ...DETALLE, ingresos: { ...DETALLE.ingresos, cargados: 0 } }} isLoading={false} /></MemoryRouter>);
    expect(screen.queryByTestId('ingresos-cargados')).not.toBeInTheDocument();
  });
});

describe('GastosPorProfesional con "No cuenta"', () => {
  it('quien no cuenta sigue en la tabla, en gris y con la etiqueta; el total es el del backend', () => {
    render(<GastosPorProfesional detalle={DETALLE} isLoading={false} />);
    const tabla = screen.getByTestId('por-profesional-tabla');

    const filaDani = within(tabla).getByTestId('prof-fila-p-dani');
    expect(filaDani).toHaveAttribute('data-cuenta', 'no');
    expect(within(filaDani).getByTestId('chip-no-cuenta')).toHaveTextContent('No cuenta');
    expect(within(filaDani).getByTestId('col-facturo').firstElementChild).toHaveClass('text-gray-400');

    const filaAna = within(tabla).getByTestId('prof-fila-p-ana');
    expect(within(filaAna).queryByTestId('chip-no-cuenta')).not.toBeInTheDocument();

    expect(texto(within(within(tabla).getByTestId('prof-total')).getByTestId('col-facturo'))).toBe(moneda(1000000));
    expect(screen.getByTestId('prof-nota-no-cuenta')).toBeInTheDocument();
  });

  it('en celular también lleva la etiqueta', () => {
    render(<GastosPorProfesional detalle={DETALLE} isLoading={false} />);
    expect(within(screen.getByTestId('prof-card-p-dani')).getByTestId('chip-no-cuenta')).toBeInTheDocument();
  });
});

// ======================================================== Categorías

describe('GastosCategoriasModal', () => {
  it('muestra dos grupos y crea una categoría del tipo elegido', async () => {
    const onCambio = vi.fn();
    render(<GastosCategoriasModal isOpen onClose={vi.fn()} categorias={CATEGORIAS} onCambio={onCambio} />);

    expect(within(screen.getByTestId('categorias-grupo-gasto')).getByText('Alquiler')).toBeInTheDocument();
    expect(within(screen.getByTestId('categorias-grupo-gasto')).queryByText('Empleados')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('categorias-grupo-ingreso')).getByText('Empleados')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Ingresos' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Alquiler de sillón' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(crearCategoria).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Alquiler de sillón', tipo: 'ingreso' })));
    expect(onCambio).toHaveBeenCalled();
  });

  it('por defecto crea de gasto', async () => {
    render(<GastosCategoriasModal isOpen onClose={vi.fn()} categorias={CATEGORIAS} onCambio={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Seguros' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(crearCategoria).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Seguros', tipo: 'gasto' })));
  });
});
