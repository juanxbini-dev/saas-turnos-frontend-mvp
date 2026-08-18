import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card } from '../ui';
import { etiquetaCorta, formatMoneda, formatMonedaCompacta, formatPct, sumarMeses } from './gastos.utils';
import type { GastosPorCategoriaItem } from '../../types/gastos.types';

interface GastosComparativaChartProps {
  datos: GastosPorCategoriaItem[];
  periodo: string;
  isLoading: boolean;
}

// Barras horizontales por categoría, mes contra mes anterior, ordenadas por
// variación absoluta. Lo que se desmadró queda arriba de todo.
export const GastosComparativaChart: React.FC<GastosComparativaChartProps> = ({ datos, periodo, isLoading }) => {
  const anterior = sumarMeses(periodo, -1);
  const anioRef = parseInt(periodo.slice(0, 4), 10);
  const labelActual = etiquetaCorta(periodo, anioRef);
  const labelAnterior = etiquetaCorta(anterior, anioRef);

  const serie = useMemo(
    () => [...datos]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 10)
      .map((d) => ({ ...d, nombreCorto: d.nombre.length > 22 ? `${d.nombre.slice(0, 20)}…` : d.nombre })),
    [datos]
  );

  const alto = Math.max(200, serie.length * 40 + 40);

  return (
    <Card title="Mes vs mes anterior" subtitle="Por categoría, ordenado por variación">
      {isLoading ? (
        <div className="animate-pulse h-72 bg-gray-100 rounded" />
      ) : serie.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-500">
          Sin datos para comparar
        </div>
      ) : (
        <>
          <div style={{ height: alto }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tickFormatter={formatMonedaCompacta} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nombreCorto" width={130} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(valor, nombre) => [formatMoneda(Number(valor) || 0), String(nombre)]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="monto_anterior" name={labelAnterior} fill="#cbd5e1" radius={[0, 3, 3, 0]} maxBarSize={14} />
                <Bar dataKey="monto" name={labelActual} fill="#f97316" radius={[0, 3, 3, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {serie.map((d) => (
              <li key={d.categoria_id} className="flex items-center gap-2 py-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="flex-1 truncate text-gray-700">{d.nombre}</span>
                <span
                  className={`text-xs font-medium tabular-nums w-28 text-right ${
                    d.delta > 0 ? 'text-red-600' : d.delta < 0 ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {d.delta > 0 ? '+' : ''}{formatMoneda(d.delta)}
                  {d.delta_pct !== null && ` (${formatPct(d.delta_pct)})`}
                  {d.delta_pct === null && d.monto > 0 && ' (nuevo)'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};
