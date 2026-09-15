import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Card } from '../ui';
import { etiquetaCorta, etiquetaPeriodo, formatMoneda, formatMonedaCompacta } from './gastos.utils';
import type { GastosEvolucionPunto } from '../../types/gastos.types';

interface GastosEvolucionChartProps {
  datos: GastosEvolucionPunto[];
  periodoActual: string;
  isLoading: boolean;
}

// Barras de ingresos vs gastos por mes con la línea del neto encima. La vista que
// responde "¿cómo venimos?" de un vistazo.
export const GastosEvolucionChart: React.FC<GastosEvolucionChartProps> = ({ datos, periodoActual, isLoading }) => {
  const anioRef = parseInt(periodoActual.slice(0, 4), 10);

  const serie = useMemo(
    () => datos.map((p) => ({ ...p, etiqueta: etiquetaCorta(p.periodo, anioRef) })),
    [datos, anioRef]
  );

  const promedioGastos = useMemo(() => {
    const conDatos = datos.filter((p) => p.gastos > 0);
    if (conDatos.length === 0) return 0;
    return conDatos.reduce((t, p) => t + p.gastos, 0) / conDatos.length;
  }, [datos]);

  const vacio = !isLoading && serie.every((p) => p.ingresos === 0 && p.gastos === 0);

  return (
    <Card title="Ingresos vs gastos" subtitle="Últimos 12 meses, con el resultado neto por encima">
      {isLoading ? (
        <div className="animate-pulse h-72 bg-gray-100 rounded" />
      ) : vacio ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-500">
          Todavía no hay movimientos en este rango
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatMonedaCompacta} tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                formatter={(valor, nombre) => [formatMoneda(Number(valor) || 0), String(nombre)]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as GastosEvolucionPunto | undefined;
                  return p ? etiquetaPeriodo(p.periodo) : '';
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {promedioGastos > 0 && (
                <ReferenceLine
                  y={promedioGastos}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  label={{ value: 'Prom. gastos', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }}
                />
              )}
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="gastos" name="Gastos" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line
                type="monotone"
                dataKey="neto"
                name="Neto"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
