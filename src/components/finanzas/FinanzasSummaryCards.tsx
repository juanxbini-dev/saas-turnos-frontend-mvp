import React from 'react';
import { FinanzasSummary } from '../../types/finanzas.types';
import { formatCurrency } from '../../utils/calculos.utils';
import { Card } from '../ui';
import { Scissors, Package, TrendingUp, CheckSquare, Clock } from 'lucide-react';

interface FinanzasSummaryCardsProps {
  summary: FinanzasSummary;
  isLoading: boolean;
}

interface SummaryCardProps {
  title: string;
  rows: { label: string; value: string; highlight?: boolean }[];
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, rows, icon, iconColor, bgColor }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <div className="flex items-start gap-3">
      <div className={`p-3 rounded-lg shrink-0 ${bgColor}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 truncate">{row.label}</span>
              <span className={`text-sm font-bold whitespace-nowrap ${row.highlight ? 'text-gray-900' : 'text-gray-700'}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Card>
);

export const FinanzasSummaryCards: React.FC<FinanzasSummaryCardsProps> = ({ summary, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* Total Vendido */}
      <SummaryCard
        title="Total Vendido"
        icon={<TrendingUp className="w-5 h-5" />}
        iconColor="text-blue-600"
        bgColor="bg-blue-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(summary.total_venta_servicios) },
          { label: 'Productos', value: formatCurrency(summary.total_venta_productos) },
          { label: 'Total', value: formatCurrency(summary.total_venta), highlight: true },
        ]}
      />

      {/* Neto Profesional */}
      <SummaryCard
        title="Neto Profesional"
        icon={<Scissors className="w-5 h-5" />}
        iconColor="text-green-600"
        bgColor="bg-green-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(summary.total_neto_profesional_servicios) },
          { label: 'Productos', value: formatCurrency(summary.total_neto_profesional_productos) },
          { label: 'Total', value: formatCurrency(summary.total_neto_profesional), highlight: true },
        ]}
      />

      {/* Comisión Empresa */}
      <SummaryCard
        title="Comisión Empresa"
        icon={<Package className="w-5 h-5" />}
        iconColor="text-purple-600"
        bgColor="bg-purple-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(summary.total_comision_empresa_servicios) },
          { label: 'Productos', value: formatCurrency(summary.total_comision_empresa_productos) },
          { label: 'Total', value: formatCurrency(summary.total_comision_empresa), highlight: true },
        ]}
      />

      {/* Cantidad */}
      <SummaryCard
        title="Actividad"
        icon={<CheckSquare className="w-5 h-5" />}
        iconColor="text-orange-600"
        bgColor="bg-orange-50"
        rows={[
          { label: 'Turnos finalizados', value: summary.cantidad_turnos.toString() },
          { label: 'Productos vendidos', value: summary.cantidad_productos_vendidos.toString() },
        ]}
      />

      {/* Pendientes */}
      <SummaryCard
        title="Pendientes de cobro"
        icon={<Clock className="w-5 h-5" />}
        iconColor="text-yellow-600"
        bgColor="bg-yellow-50"
        rows={[
          { label: 'Total pendiente', value: formatCurrency(summary.total_pendiente || 0), highlight: true },
        ]}
      />
    </div>
  );
};
