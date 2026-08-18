import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { formatMoneda } from './gastos.utils';
import type { GastosResumen } from '../../types/gastos.types';

interface GastosResumenSimpleProps {
  resumen: GastosResumen | null;
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
export const GastosResumenSimple: React.FC<GastosResumenSimpleProps> = ({ resumen, isLoading }) => {
  if (isLoading || !resumen) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  const ant = resumen.anterior;
  const quedo = resumen.neto;
  const positivo = quedo >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowDownToLine size={16} className="text-green-600" /> Entró
        </div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatMoneda(resumen.ingresos)}</div>
        <Delta actual={resumen.ingresos} anterior={ant?.ingresos} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowUpFromLine size={16} className="text-orange-600" /> Salió
        </div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatMoneda(resumen.total_gastos)}</div>
        <Delta actual={resumen.total_gastos} anterior={ant?.total_gastos} invertir />
      </div>

      <div className={`rounded-xl p-5 flex flex-col gap-1 border ${positivo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`flex items-center gap-2 text-sm ${positivo ? 'text-green-800' : 'text-red-800'}`}>
          <Scale size={16} /> Te quedó
        </div>
        <div className={`text-2xl font-bold tabular-nums ${positivo ? 'text-green-800' : 'text-red-800'}`}>
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
