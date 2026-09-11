import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { formatMoneda } from './gastos.utils';
import type { GastosDetalleMes, GastosResumen } from '../../types/gastos.types';

interface GastosResumenSimpleProps {
  resumen: GastosResumen | null;
  detalle: GastosDetalleMes | null;   // si todavía carga, "Entró" muestra la variación
  isLoading: boolean;
}

// Variación contra el mes anterior, en una línea corta.
// invertir=true para "Salió": que suba es malo.
const Delta: React.FC<{ actual: number; anterior?: number | null; invertir?: boolean }> = ({ actual, anterior, invertir = false }) => {
  if (anterior == null || anterior === 0) return <span className="text-xs text-gray-400">sin mes anterior para comparar</span>;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (!isFinite(pct)) return null;
  const sube = pct >= 0;
  const esBueno = invertir ? !sube : sube;
  const Icon = sube ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${esBueno ? 'text-green-700' : 'text-red-700'}`}>
      <Icon className="w-3.5 h-3.5" />
      {sube ? 'subió' : 'bajó'} {Math.abs(pct).toFixed(0)}% respecto al mes pasado
    </span>
  );
};

// Tres números en el idioma del dueño: cuánto entró, cuánto salió y cuánto quedó.
// Todo lo demás (fijos, variables, comisiones) vive en la lista, no acá.
export const GastosResumenSimple: React.FC<GastosResumenSimpleProps> = ({ resumen, detalle, isLoading }) => {
  if (isLoading || !resumen) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-28 ${i === 2 ? 'col-span-2 md:col-span-1' : ''}`} />
        ))}
      </div>
    );
  }

  const ant = resumen.anterior;
  const quedo = resumen.neto;
  const positivo = quedo >= 0;
  const ingresos = detalle?.ingresos;

  // "Salió" desglosado: lo que pagaste a mano, lo que salió solo y lo que falta.
  // Sin nada cargado ni calculado, "todo pagado · $ 0 salió solo" confunde.
  const sinGastos = resumen.total_gastos === 0 && resumen.pagado === 0 && resumen.pendiente === 0;
  const salioDetalle = sinGastos
    ? 'todavía no hay gastos este mes'
    : resumen.pendiente > 0
      ? `${formatMoneda(resumen.pagado)} pagado · ${formatMoneda(resumen.derivados)} salió solo · falta ${formatMoneda(resumen.pendiente)}`
      : `todo pagado · ${formatMoneda(resumen.derivados)} salió solo`;
  const turnosCobrados = ingresos
    ? `${ingresos.turnos_cobrados} ${ingresos.turnos_cobrados === 1 ? 'turno cobrado' : 'turnos cobrados'}`
    : '';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowDownToLine size={16} className="text-green-600" /> Entró
        </div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums truncate">{formatMoneda(resumen.ingresos)}</div>
        {ingresos
          ? <span className="text-xs text-gray-500">{turnosCobrados} · {formatMoneda(ingresos.productos)} en productos</span>
          : <Delta actual={resumen.ingresos} anterior={ant?.ingresos} />}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowUpFromLine size={16} className="text-orange-600" /> Salió
        </div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums truncate">{formatMoneda(resumen.total_gastos)}</div>
        <span className={`text-xs ${resumen.pendiente > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{salioDetalle}</span>
      </div>

      <div className={`rounded-xl p-4 sm:p-5 flex flex-col gap-1 border col-span-2 md:col-span-1 ${positivo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`flex items-center gap-2 text-sm ${positivo ? 'text-green-800' : 'text-red-800'}`}>
          <Scale size={16} /> Te quedó
        </div>
        <div className={`text-xl sm:text-2xl font-bold tabular-nums ${positivo ? 'text-green-800' : 'text-red-800'}`}>
          {positivo ? '' : '−'}{formatMoneda(Math.abs(quedo))}
        </div>
        <span className={`text-xs ${positivo ? 'text-green-700' : 'text-red-700'}`}>
          {resumen.ingresos > 0
            ? `${Math.abs(resumen.margen_pct).toFixed(0)}% de lo que entró${positivo ? '' : ', en negativo'}`
            : 'todavía no entró nada este mes'}
        </span>
      </div>
    </div>
  );
};
