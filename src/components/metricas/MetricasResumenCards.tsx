import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Receipt,
  Users,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card } from '../ui';
import { formatCurrency } from '../../utils/calculos.utils';
import { MetricasResumen } from '../../types/metricas.types';

interface MetricasResumenCardsProps {
  resumen: MetricasResumen;
  resumenAnterior: MetricasResumen | null;
  etiquetaComparacion: string; // "vs mes anterior" | "vs año anterior"
  isLoading: boolean;
}

// Variación porcentual contra el período anterior.
// invertir=true para métricas donde subir es malo (ej: cancelaciones)
const Delta: React.FC<{
  actual: number;
  anterior?: number | null;
  etiqueta: string;
  invertir?: boolean;
}> = ({ actual, anterior, etiqueta, invertir = false }) => {
  if (anterior == null || anterior === 0) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  if (!isFinite(pct)) return null;
  const sube = pct >= 0;
  const esBueno = invertir ? !sube : sube;
  const Icon = sube ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${esBueno ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" />
      {sube ? '+' : ''}{pct.toFixed(0)}% {etiqueta}
    </span>
  );
};

interface KpiCardProps {
  title: string;
  total: string;
  delta?: React.ReactNode;
  rows: { label: string; value: string }[];
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, total, delta, rows, icon, iconColor, bgColor }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${bgColor}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{total}</p>
        {delta}
        {rows.length > 0 && (
          <div className="space-y-0.5 mt-1.5 border-t border-gray-100 pt-1.5">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 truncate">{row.label}</span>
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </Card>
);

export const MetricasResumenCards: React.FC<MetricasResumenCardsProps> = ({
  resumen,
  resumenAnterior,
  etiquetaComparacion,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-5 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        title="Total Facturado"
        total={formatCurrency(resumen.total_venta)}
        delta={<Delta actual={resumen.total_venta} anterior={resumenAnterior?.total_venta} etiqueta={etiquetaComparacion} />}
        icon={<TrendingUp className="w-4 h-4" />}
        iconColor="text-blue-600"
        bgColor="bg-blue-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(resumen.total_venta_servicios) },
          { label: 'Productos', value: formatCurrency(resumen.total_venta_productos) },
        ]}
      />

      <KpiCard
        title="Turnos Completados"
        total={resumen.turnos_completados.toString()}
        delta={<Delta actual={resumen.turnos_completados} anterior={resumenAnterior?.turnos_completados} etiqueta={etiquetaComparacion} />}
        icon={<CheckSquare className="w-4 h-4" />}
        iconColor="text-orange-600"
        bgColor="bg-orange-50"
        rows={[
          { label: 'Productos vendidos', value: resumen.cantidad_productos_vendidos.toString() },
        ]}
      />

      <KpiCard
        title="Ticket Promedio"
        total={formatCurrency(resumen.ticket_promedio)}
        delta={<Delta actual={resumen.ticket_promedio} anterior={resumenAnterior?.ticket_promedio} etiqueta={etiquetaComparacion} />}
        icon={<Receipt className="w-4 h-4" />}
        iconColor="text-green-600"
        bgColor="bg-green-50"
        rows={[]}
      />

      <KpiCard
        title="Clientes Activos"
        total={resumen.clientes_activos.toString()}
        delta={<Delta actual={resumen.clientes_activos} anterior={resumenAnterior?.clientes_activos} etiqueta={etiquetaComparacion} />}
        icon={<Users className="w-4 h-4" />}
        iconColor="text-sky-600"
        bgColor="bg-sky-50"
        rows={[
          { label: 'Nuevos en el período', value: resumen.clientes_nuevos.toString() },
        ]}
      />

      <KpiCard
        title="Tasa de Cancelación"
        total={`${resumen.tasa_cancelacion.toFixed(1)}%`}
        delta={
          <Delta
            actual={resumen.tasa_cancelacion}
            anterior={resumenAnterior?.tasa_cancelacion}
            etiqueta={etiquetaComparacion}
            invertir
          />
        }
        icon={<XCircle className="w-4 h-4" />}
        iconColor="text-red-600"
        bgColor="bg-red-50"
        rows={[
          { label: 'Turnos cancelados', value: resumen.turnos_cancelados.toString() },
        ]}
      />

      <KpiCard
        title="Pendiente de Cobro"
        total={formatCurrency(resumen.total_pendiente)}
        icon={<Clock className="w-4 h-4" />}
        iconColor="text-yellow-600"
        bgColor="bg-yellow-50"
        rows={[]}
      />
    </div>
  );
};
