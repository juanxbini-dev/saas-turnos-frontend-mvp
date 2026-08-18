// Helpers de período y formato de la sección de gastos.

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

// 'Ago' | 'Ago 26' cuando el año no coincide con el de referencia
export function etiquetaCorta(periodo: string, anioReferencia?: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const corto = MESES_CORTOS[mes - 1] ?? periodo;
  return anioReferencia !== undefined && anio !== anioReferencia ? `${corto} ${String(anio).slice(2)}` : corto;
}

export const formatMoneda = (valor: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);

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
export const GASTOS_SUGERIDOS: { nombre: string; categoria: string; dia?: number }[] = [
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

// ¿Ya pasó el día de vencimiento de este mes? Solo aplica al mes en curso: en un
// mes futuro nada venció todavía, y en uno pasado todo lo pendiente venció.
export function estaVencido(periodo: string, diaVencimiento: number | null): boolean {
  if (!diaVencimiento) return false;
  const actual = periodoActual();
  if (periodo < actual) return true;
  if (periodo > actual) return false;
  return new Date().getDate() > diaVencimiento;
}
