import React from 'react';
import { FinanzasSummary } from '../../types/finanzas.types';
import { formatCurrency } from '../../utils/calculos.utils';
import { Card } from '../ui';
import { Scissors, Package, TrendingUp, CheckSquare, Clock } from 'lucide-react';

interface FinanzasSummaryCardsProps {
  summary: FinanzasSummary;
  isLoading: boolean;
  comisionProfesional?: { comision_turno: number; comision_producto: number } | null;
}

interface SummaryCardProps {
  title: string;
  total?: string;
  rows: { label: string; value: string }[];
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  className?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, total, rows, icon, iconColor, bgColor, className = '' }) => (
  <Card className={`hover:shadow-lg transition-shadow ${className}`}>
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${bgColor}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        {total && (
          <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{total}</p>
        )}
        {rows.length > 0 && (
          <div className={`space-y-0.5 ${total ? 'mt-1.5 border-t border-gray-100 pt-1.5' : 'mt-1'}`}>
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

export const FinanzasSummaryCards: React.FC<FinanzasSummaryCardsProps> = ({ summary, isLoading, comisionProfesional }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 mb-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className={`animate-pulse ${i === 5 ? 'sm:col-span-2 lg:col-span-2 2xl:col-span-1' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-5 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 mb-8">
      {/* Total Vendido */}
      <SummaryCard
        title="Total Vendido"
        total={formatCurrency(summary.total_venta)}
        icon={<TrendingUp className="w-4 h-4" />}
        iconColor="text-blue-600"
        bgColor="bg-blue-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(summary.total_venta_servicios) },
          { label: 'Productos', value: formatCurrency(summary.total_venta_productos) },
        ]}
      />

      {/* Neto Profesional */}
      <SummaryCard
        title="Neto Profesional"
        total={formatCurrency(summary.total_neto_profesional)}
        icon={<Scissors className="w-4 h-4" />}
        iconColor="text-green-600"
        bgColor="bg-green-50"
        rows={[
          ...(comisionProfesional != null ? [
            { label: 'Comisión servicios', value: `${comisionProfesional.comision_turno}%` },
            { label: 'Comisión productos', value: `${comisionProfesional.comision_producto}%` },
          ] : []),
          { label: `Servicios (${summary.cantidad_turnos})`, value: formatCurrency(summary.total_neto_profesional_servicios) },
          { label: `Productos (${summary.cantidad_productos_vendidos})`, value: formatCurrency(summary.total_neto_profesional_productos) },
        ]}
      />

      {/* Comisión Empresa */}
      <SummaryCard
        title="Comisión Empresa"
        total={formatCurrency(summary.total_comision_empresa)}
        icon={<Package className="w-4 h-4" />}
        iconColor="text-purple-600"
        bgColor="bg-purple-50"
        rows={[
          { label: 'Servicios', value: formatCurrency(summary.total_comision_empresa_servicios) },
          { label: 'Productos', value: formatCurrency(summary.total_comision_empresa_productos) },
        ]}
      />

      {/* Actividad */}
      <SummaryCard
        title="Actividad"
        icon={<CheckSquare className="w-4 h-4" />}
        iconColor="text-orange-600"
        bgColor="bg-orange-50"
        rows={[
          { label: 'Turnos finalizados', value: summary.cantidad_turnos.toString() },
          { label: 'Productos vendidos', value: summary.cantidad_productos_vendidos.toString() },
        ]}
      />

      {/* Pendientes — ocupa ambas columnas en sm, una en xl */}
      <SummaryCard
        title="Pendiente de cobro"
        total={formatCurrency(summary.total_pendiente || 0)}
        icon={<Clock className="w-4 h-4" />}
        iconColor="text-yellow-600"
        bgColor="bg-yellow-50"
        rows={[]}
        className="sm:col-span-2 lg:col-span-2 2xl:col-span-1"
      />
    </div>
  );
};
