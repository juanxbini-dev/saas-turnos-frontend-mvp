import type { MetricasPeriodo } from '../../types/metricas.types';

export type ModoPeriodo = 'mes' | 'anio';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const toLocalStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Último día del mes (0-based) de ese año: 28/29/30/31
const diasDelMes = (anio: number, mes: number) => new Date(anio, mes + 1, 0).getDate();

export const periodoDe = (base: Date, modo: ModoPeriodo): MetricasPeriodo =>
  modo === 'mes'
    ? {
        fecha_desde: toLocalStr(new Date(base.getFullYear(), base.getMonth(), 1)),
        fecha_hasta: toLocalStr(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
      }
    : {
        fecha_desde: `${base.getFullYear()}-01-01`,
        fecha_hasta: `${base.getFullYear()}-12-31`,
      };

export const esPeriodoEnCurso = (base: Date, modo: ModoPeriodo, hoy: Date) =>
  modo === 'mes'
    ? base.getFullYear() === hoy.getFullYear() && base.getMonth() === hoy.getMonth()
    : base.getFullYear() === hoy.getFullYear();

/**
 * Contra qué se comparan las tarjetas de Métricas.
 * Un período cerrado se compara completo con el anterior completo. El período EN CURSO se compara
 * con el anterior cortado en la misma fecha (12 oct → 1–12 sep; año → 1 ene–12 oct del año pasado):
 * si no, a principio de mes todo da negativo contra un mes entero (pedido de Juan, 12 oct 2026).
 * Si el día no existe en el mes anterior (31 → septiembre), se corta en su último día.
 */
export function comparacionDe(
  base: Date,
  modo: ModoPeriodo,
  hoy: Date
): { periodo: MetricasPeriodo; etiqueta: string } {
  const anterior =
    modo === 'mes'
      ? new Date(base.getFullYear(), base.getMonth() - 1, 1)
      : new Date(base.getFullYear() - 1, 0, 1);
  const completo = periodoDe(anterior, modo);

  if (!esPeriodoEnCurso(base, modo, hoy)) {
    return { periodo: completo, etiqueta: modo === 'mes' ? 'vs mes anterior' : 'vs año anterior' };
  }

  const anio = anterior.getFullYear();
  const mes = modo === 'mes' ? anterior.getMonth() : hoy.getMonth();
  const dia = Math.min(hoy.getDate(), diasDelMes(anio, mes));
  const corte = new Date(anio, mes, dia);
  const etiqueta =
    modo === 'mes'
      ? `vs 1–${dia} ${MESES_CORTOS[mes]}`
      : `vs ${anio} al ${dia} ${MESES_CORTOS[mes]}`;

  return { periodo: { fecha_desde: completo.fecha_desde, fecha_hasta: toLocalStr(corte) }, etiqueta };
}
