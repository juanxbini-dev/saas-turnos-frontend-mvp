import React from 'react';
import {
  Wallet, Repeat, Zap, Cog, TrendingUp, TrendingDown, Scale, PieChart, CheckCircle2,
} from 'lucide-react';
import { Card } from '../ui';
import { formatMoneda } from './gastos.utils';
import type { GastosResumen } from '../../types/gastos.types';

interface GastosResumenCardsProps {
  resumen: GastosResumen | null;
  isLoading: boolean;
}

// Variación contra el mes anterior. Para gastos, subir es malo (rojo); para
// ingresos y neto, subir es bueno (verde). invertir=true marca el primer caso.
const Delta: React.FC<{ actual: number; anterior?: number | null; invertir?: boolean }> = ({
  actual, anterior, invertir = false,
}) => {
  if (anterior == null || anterior === 0) return null;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (!isFinite(pct)) return null;
  const sube = pct >= 0;
  const esBueno = invertir ? !sube : sube;
  const Icon = sube ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${esBueno ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" />
      {sube ? '+' : ''}{pct.toFixed(0)}% vs mes anterior
    </span>
  );
};

interface KpiProps {
  title: string;
  total: string;
  delta?: React.ReactNode;
  rows?: { label: string; value: string }[];
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  totalColor?: string;
}

const Kpi: React.FC<KpiProps> = ({ title, total, delta, rows = [], icon, iconColor, bgColor, totalColor = 'text-gray-900' }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${bgColor}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className={`text-lg font-bold mt-0.5 tabular-nums ${totalColor}`}>{total}</p>
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

const Skeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <Card key={i}><div className="animate-pulse h-20 bg-gray-100 rounded" /></Card>
    ))}
  </div>
);

export const GastosResumenCards: React.FC<GastosResumenCardsProps> = ({ resumen, isLoading }) => {
  if (isLoading || !resumen) return <Skeleton />;

  const ant = resumen.anterior;
  const netoPositivo = resumen.neto >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <Kpi
        title="Gastos del mes"
        total={formatMoneda(resumen.total_gastos)}
        delta={<Delta actual={resumen.total_gastos} anterior={ant?.total_gastos} invertir />}
        rows={[
          { label: 'Fijos', value: formatMoneda(resumen.fijos) },
          { label: 'Variables', value: formatMoneda(resumen.variables) },
          { label: 'Del sistema', value: formatMoneda(resumen.derivados) },
        ]}
        icon={<Wallet size={20} />}
        iconColor="text-orange-600"
        bgColor="bg-orange-50"
      />
      <Kpi
        title="Fijos"
        total={formatMoneda(resumen.fijos)}
        delta={<Delta actual={resumen.fijos} anterior={ant?.fijos} invertir />}
        icon={<Repeat size={20} />}
        iconColor="text-sky-600"
        bgColor="bg-sky-50"
      />
      <Kpi
        title="Variables"
        total={formatMoneda(resumen.variables)}
        delta={<Delta actual={resumen.variables} anterior={ant?.variables} invertir />}
        icon={<Zap size={20} />}
        iconColor="text-amber-600"
        bgColor="bg-amber-50"
      />
      <Kpi
        title="Del sistema"
        total={formatMoneda(resumen.derivados)}
        delta={<Delta actual={resumen.derivados} anterior={ant?.derivados} invertir />}
        rows={[{ label: 'Comisiones + mercadería', value: '' }]}
        icon={<Cog size={20} />}
        iconColor="text-pink-600"
        bgColor="bg-pink-50"
      />
      <Kpi
        title="Ingresos"
        total={formatMoneda(resumen.ingresos)}
        delta={<Delta actual={resumen.ingresos} anterior={ant?.ingresos} />}
        rows={[{ label: 'Gastos / ingresos', value: `${resumen.ratio_gastos_ingresos.toFixed(0)}%` }]}
        icon={<PieChart size={20} />}
        iconColor="text-green-600"
        bgColor="bg-green-50"
      />
      <Kpi
        title="Resultado neto"
        total={formatMoneda(resumen.neto)}
        totalColor={netoPositivo ? 'text-green-700' : 'text-red-700'}
        delta={<Delta actual={resumen.neto} anterior={ant?.neto} />}
        rows={[
          { label: 'Margen', value: `${resumen.margen_pct.toFixed(1)}%` },
          { label: 'Pagado / pendiente', value: `${formatMoneda(resumen.pagado)} / ${formatMoneda(resumen.pendiente)}` },
        ]}
        icon={netoPositivo ? <Scale size={20} /> : <CheckCircle2 size={20} />}
        iconColor={netoPositivo ? 'text-emerald-600' : 'text-red-600'}
        bgColor={netoPositivo ? 'bg-emerald-50' : 'bg-red-50'}
      />
    </div>
  );
};
