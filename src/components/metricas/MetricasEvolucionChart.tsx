import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '../ui';
import { formatCurrency } from '../../utils/calculos.utils';
import { MetricasEvolucionPunto, MetricasAgrupacion } from '../../types/metricas.types';

interface MetricasEvolucionChartProps {
  datos: MetricasEvolucionPunto[];
  agrupar: MetricasAgrupacion;
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  isLoading: boolean;
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Genera todos los buckets del rango para que los días/meses sin ventas aparezcan en 0
const completarBuckets = (
  datos: MetricasEvolucionPunto[],
  agrupar: MetricasAgrupacion,
  fechaDesde: string,
  fechaHasta: string
): MetricasEvolucionPunto[] => {
  const porFecha = new Map(datos.map(d => [d.fecha, d]));
  const buckets: MetricasEvolucionPunto[] = [];

  if (agrupar === 'dia') {
    const [y1, m1, d1] = fechaDesde.split('-').map(Number);
    const [y2, m2, d2] = fechaHasta.split('-').map(Number);
    const cursor = new Date(y1, m1 - 1, d1);
    const fin = new Date(y2, m2 - 1, d2);
    while (cursor <= fin) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      buckets.push(porFecha.get(key) ?? { fecha: key, total: 0, servicios: 0, productos: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const [y1, m1] = fechaDesde.split('-').map(Number);
    const [y2, m2] = fechaHasta.split('-').map(Number);
    let anio = y1;
    let mes = m1;
    while (anio < y2 || (anio === y2 && mes <= m2)) {
      const key = `${anio}-${String(mes).padStart(2, '0')}`;
      buckets.push(porFecha.get(key) ?? { fecha: key, total: 0, servicios: 0, productos: 0 });
      mes++;
      if (mes > 12) { mes = 1; anio++; }
    }
  }
  return buckets;
};

const formatEje = (fecha: string, agrupar: MetricasAgrupacion): string => {
  if (agrupar === 'dia') return fecha.slice(8); // día del mes
  const mes = parseInt(fecha.slice(5), 10);
  return MESES_CORTOS[mes - 1] ?? fecha;
};

const formatMonedaCompacta = (valor: number): string =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);

export const MetricasEvolucionChart: React.FC<MetricasEvolucionChartProps> = ({
  datos,
  agrupar,
  fechaDesde,
  fechaHasta,
  isLoading,
}) => {
  const serie = useMemo(
    () => completarBuckets(datos, agrupar, fechaDesde, fechaHasta),
    [datos, agrupar, fechaDesde, fechaHasta]
  );

  const hayDatos = serie.some(p => p.total > 0);

  return (
    <Card title="Evolución de facturación" subtitle={agrupar === 'dia' ? 'Por día' : 'Por mes'}>
      {isLoading ? (
        <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
      ) : !hayDatos ? (
        <div className="h-72 flex items-center justify-center text-sm text-gray-500">
          Sin facturación registrada en este período
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradServicios" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradProductos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="fecha"
                tickFormatter={(f: string) => formatEje(f, agrupar)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatMonedaCompacta}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(Number(value) || 0),
                  name === 'servicios' ? 'Servicios' : 'Productos',
                ]}
                labelFormatter={(f: string) =>
                  agrupar === 'dia' ? `Día ${f.slice(8)}/${f.slice(5, 7)}` : formatEje(f, agrupar)
                }
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-gray-600">
                    {value === 'servicios' ? 'Servicios' : 'Productos'}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="servicios"
                stackId="ventas"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#gradServicios)"
              />
              <Area
                type="monotone"
                dataKey="productos"
                stackId="ventas"
                stroke="#9333ea"
                strokeWidth={2}
                fill="url(#gradProductos)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
