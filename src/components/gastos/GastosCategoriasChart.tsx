import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card } from '../ui';
import { formatMoneda } from './gastos.utils';
import type { GastosPorCategoriaItem } from '../../types/gastos.types';

interface GastosCategoriasChartProps {
  datos: GastosPorCategoriaItem[];
  isLoading: boolean;
}

// Donut del reparto por categoría del mes. Los derivados entran como categorías
// propias, así el círculo suma el total real del mes.
export const GastosCategoriasChart: React.FC<GastosCategoriasChartProps> = ({ datos, isLoading }) => {
  const conMonto = useMemo(() => datos.filter((d) => d.monto > 0), [datos]);
  const total = useMemo(() => conMonto.reduce((t, d) => t + d.monto, 0), [conMonto]);

  return (
    <Card title="Gastos por categoría" subtitle="Reparto del mes seleccionado">
      {isLoading ? (
        <div className="animate-pulse h-72 bg-gray-100 rounded" />
      ) : conMonto.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-500">
          Sin gastos cargados este mes
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="h-64 w-full md:w-1/2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conMonto}
                  dataKey="monto"
                  nameKey="nombre"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {conMonto.map((d) => <Cell key={d.categoria_id} fill={d.color} />)}
                </Pie>
                <Tooltip
                  formatter={(valor, nombre) => {
                    const v = Number(valor) || 0;
                    return [`${formatMoneda(v)} (${((v / total) * 100).toFixed(0)}%)`, String(nombre)];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">{formatMoneda(total)}</span>
            </div>
          </div>

          <ul className="w-full md:w-1/2 space-y-1.5 text-sm">
            {conMonto.map((d) => (
              <li key={d.categoria_id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="flex-1 truncate text-gray-700">
                  {d.nombre}
                  {d.es_derivado && <span className="ml-1 text-xs text-gray-400">(sistema)</span>}
                </span>
                <span className="text-gray-500 tabular-nums text-xs w-10 text-right">
                  {((d.monto / total) * 100).toFixed(0)}%
                </span>
                <span className="font-medium text-gray-900 tabular-nums w-24 text-right">
                  {formatMoneda(d.monto)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
