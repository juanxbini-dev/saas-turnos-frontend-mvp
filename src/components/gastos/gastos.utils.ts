// Helpers de período y formato de la sección de gastos.
import type { GastoMesItem, GastoTipo, GastosPorCategoriaItem, MarcarPagadoItem } from '../../types/gastos.types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// 'YYYY-MM' del mes en curso
export function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

export function sumarMeses(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

// 'Agosto 2026'
export function etiquetaPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

// 'noviembre 2026': siempre con año, en minúscula. Para frases donde el mes
// puede ser de otro año sin que se note ("No cuenta desde noviembre 2026").
export function mesConAnio(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${(MESES[mes - 1] ?? periodo).toLowerCase()} ${anio}`;
}

// 'Ago' | 'Ago 26' cuando el año no coincide con el de referencia
export function etiquetaCorta(periodo: string, anioReferencia?: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const corto = MESES_CORTOS[mes - 1] ?? periodo;
  return anioReferencia !== undefined && anio !== anioReferencia ? `${corto} ${String(anio).slice(2)}` : corto;
}

// 'septiembre' | 'septiembre 2025' si no es el año en curso. Para copys tipo
// "Gastos de septiembre" o "Un gasto de septiembre nada más".
export function nombreMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const nombre = (MESES[mes - 1] ?? periodo).toLowerCase();
  return anio === new Date().getFullYear() ? nombre : `${nombre} ${anio}`;
}

// Ítem del pagado en lote: un fijo va siempre por recurrente_id (proyectado o
// con override, el backend hace el upsert); lo demás por id.
export function itemPagado(item: GastoMesItem): MarcarPagadoItem {
  return item.recurrente_id ? { recurrente_id: item.recurrente_id } : { id: item.id };
}

export const formatMoneda = (valor: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);

// '1.234.567' sin símbolo, para las barras del costado
export const formatNumero = (valor: number): string =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);

export const formatMonedaCompacta = (valor: number): string =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);

export const formatPct = (valor: number, decimales = 0): string =>
  `${valor >= 0 ? '+' : ''}${valor.toFixed(decimales)}%`;

// 'YYYY-MM-DD' -> 'DD/MM'
export function formatDiaMes(fecha: string | null): string {
  if (!fecha) return '';
  const [, mes, dia] = fecha.split('-');
  return `${dia}/${mes}`;
}

// Chips del arranque guiado: nombre → categoría del seed. Tocar uno abre el alta
// con el nombre puesto y la categoría resuelta, así el dueño solo escribe el monto.
export type GastoSugerido = { nombre: string; categoria: string; dia?: number };

export const GASTOS_SUGERIDOS: GastoSugerido[] = [
  { nombre: 'Alquiler', categoria: 'Alquiler' },
  { nombre: 'Luz', categoria: 'Servicios' },
  { nombre: 'Gas', categoria: 'Servicios' },
  { nombre: 'Agua', categoria: 'Servicios' },
  { nombre: 'Internet', categoria: 'Internet y telefonía' },
  { nombre: 'Celular', categoria: 'Internet y telefonía' },
  { nombre: 'Sueldos', categoria: 'Sueldos' },
  { nombre: 'Contadora', categoria: 'Impuestos' },
  { nombre: 'Monotributo', categoria: 'Impuestos' },
  { nombre: 'Seguro', categoria: 'Otros' },
  { nombre: 'Limpieza', categoria: 'Mantenimiento' },
];

// Cantidad de días del mes 'YYYY-MM'
export function ultimoDiaDelMes(periodo: string): number {
  const [anio, mes] = periodo.split('-').map(Number);
  return new Date(anio, mes, 0).getDate();
}

// ¿Ya pasó el día de vencimiento de este mes? Solo aplica al mes en curso: en un
// mes futuro nada venció todavía, y en uno pasado todo lo pendiente venció.
// Un "vence el 31" en un mes de 30 días vence el 30: se compara contra el
// último día real del mes, si no nunca vencería.
export function estaVencido(periodo: string, diaVencimiento: number | null): boolean {
  if (!diaVencimiento) return false;
  const actual = periodoActual();
  if (periodo < actual) return true;
  if (periodo > actual) return false;
  return new Date().getDate() > Math.min(diaVencimiento, ultimoDiaDelMes(periodo));
}

// Suma montos en centavos enteros para no arrastrar errores de float al total
// (0.1 + 0.2). Devuelve pesos con dos decimales exactos.
export function sumarMontos(valores: number[]): number {
  return valores.reduce((t, v) => t + Math.round(v * 100), 0) / 100;
}

// Rubro automático único desde gastos-ganancias-spec §4.6
export const NOMBRE_RUBRO_PROFESIONALES = 'A pagar a profesionales';
const ID_DERIVADO_COMISIONES = 'derivado:comisiones';
const ID_DERIVADO_MERCADERIA = 'derivado:mercaderia';

// El costo de mercadería ya no es un gasto: se saca del reparto por rubro aunque
// un backend viejo lo siga mandando, y las comisiones se rotulan con el nombre nuevo.
export function limpiarPorCategoria(items: GastosPorCategoriaItem[]): GastosPorCategoriaItem[] {
  return items
    .filter((c) => c.categoria_id !== ID_DERIVADO_MERCADERIA)
    .map((c) => (c.categoria_id === ID_DERIVADO_COMISIONES ? { ...c, nombre: NOMBRE_RUBRO_PROFESIONALES } : c));
}

// ------------------------------------------------------- Gastos e ingresos
// gastos-ingresos-plan: el tipo vive en la categoría. Sin tipo (backend viejo)
// es gasto, así nada de lo que ya existía cambia de lado.

export function tipoDeCategoria(c: { tipo?: GastoTipo } | null | undefined): GastoTipo {
  return c?.tipo === 'ingreso' ? 'ingreso' : 'gasto';
}

// Categorías (o fijos) de un tipo: los formularios de gastos solo ofrecen
// categorías de gasto y los de ingresos solo de ingreso. Un fijo sin `tipo`
// propio toma el de su categoría.
export function filtrarPorTipo<T extends { tipo?: GastoTipo; categoria?: { tipo?: GastoTipo } }>(items: T[], tipo: GastoTipo): T[] {
  return items.filter((i) => tipoDeCategoria({ tipo: i.tipo ?? i.categoria?.tipo }) === tipo);
}

// Textos que cambian entre la sección de gastos y la de ingresos. En ingresos
// el estado 'pagado' se lee "Cobrado". Los de gastos son los de siempre: no
// cambiar sin revisar los tests de la tabla.
export interface TextosModo {
  singular: string;          // 'gasto'
  Singular: string;          // 'Gasto'
  plural: string;            // 'gastos'
  Plural: string;            // 'Gastos'
  nuevo: string;             // 'Nuevo gasto'
  pagado: string;            // 'pagado'
  pagados: string;           // 'pagados'
  yaLoPague: string;         // 'Ya lo pagué'
  yaEsta: string;            // 'Ya está pagado'
  comoSePago: string;        // '¿Cómo se pagó?'
  diaLabel: string;          // 'Vence el día'
  omitido: string;           // 'este mes no se paga'
  omitidoLargo: string;      // checkbox del modal de edición
  fijos: string;             // 'Mis gastos fijos'
  fijoNuevo: string;         // 'Nuevo gasto fijo'
  fijoEditar: string;        // 'Editar gasto fijo'
  sinFijos: string;
  placeholderFijo: string;
  placeholderUnico: string;
}

export const TEXTOS_MODO: Record<GastoTipo, TextosModo> = {
  gasto: {
    singular: 'gasto', Singular: 'Gasto', plural: 'gastos', Plural: 'Gastos',
    nuevo: 'Nuevo gasto', pagado: 'pagado', pagados: 'pagados',
    yaLoPague: 'Ya lo pagué', yaEsta: 'Ya está pagado', comoSePago: '¿Cómo se pagó?',
    diaLabel: 'Vence el día', omitido: 'este mes no se paga',
    omitidoLargo: 'Este mes no se paga (bonificado, suspendido…). No suma al total.',
    fijos: 'Mis gastos fijos', fijoNuevo: 'Nuevo gasto fijo', fijoEditar: 'Editar gasto fijo',
    sinFijos: 'Todavía no cargaste gastos fijos.',
    placeholderFijo: 'Alquiler del local', placeholderUnico: 'Arreglo del aire',
  },
  ingreso: {
    singular: 'ingreso', Singular: 'Ingreso', plural: 'ingresos', Plural: 'Ingresos',
    nuevo: 'Nuevo ingreso', pagado: 'cobrado', pagados: 'cobrados',
    yaLoPague: 'Ya lo cobré', yaEsta: 'Ya está cobrado', comoSePago: '¿Cómo se cobró?',
    diaLabel: 'Se cobra el día', omitido: 'este mes no entra',
    omitidoLargo: 'Este mes no entra (no lo pagó, se suspendió…). No suma al total.',
    fijos: 'Mis ingresos fijos', fijoNuevo: 'Nuevo ingreso fijo', fijoEditar: 'Editar ingreso fijo',
    sinFijos: 'Todavía no cargaste ingresos fijos.',
    placeholderFijo: 'Juli — sillón', placeholderUnico: 'Alquiler del salón por un día',
  },
};

// Tipo de un fijo: el suyo o, si no lo trae, el de su categoría
export function tipoDeFijo(r: { tipo?: GastoTipo; categoria?: { tipo?: GastoTipo } }): GastoTipo {
  return tipoDeCategoria({ tipo: r.tipo ?? r.categoria?.tipo });
}
