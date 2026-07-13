import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, Avatar, Button } from '../ui';
import { formatCurrency } from '../../utils/calculos.utils';
import { MetricasEquipoItem } from '../../types/metricas.types';

interface MetricasEquipoTablaProps {
  equipo: MetricasEquipoItem[];
  isLoading: boolean;
  onVerDetalle: (profesionalId: string) => void;
}

export const MetricasEquipoTabla: React.FC<MetricasEquipoTablaProps> = ({
  equipo,
  isLoading,
  onVerDetalle,
}) => {
  if (isLoading) {
    return (
      <Card title="Rendimiento del equipo">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (equipo.length === 0) {
    return (
      <Card title="Rendimiento del equipo">
        <p className="text-sm text-gray-500 text-center py-6">No hay profesionales activos</p>
      </Card>
    );
  }

  const maxFacturado = Math.max(...equipo.map(e => e.facturado), 1);

  return (
    <Card title="Rendimiento del equipo" subtitle="Ordenado por facturación del período" noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Profesional</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturado</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Neto prof.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Turnos</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ticket prom.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Cancelados</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {equipo.map((item) => (
              <tr
                key={item.profesional_id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => onVerDetalle(item.profesional_id)}
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={item.nombre} src={item.avatar_url ?? undefined} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{item.nombre}</div>
                      {/* Barra de participación relativa al mejor del período */}
                      <div className="mt-1 h-1.5 w-28 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((item.facturado / maxFacturado) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 tabular-nums">
                  {formatCurrency(item.facturado)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-600 tabular-nums hidden md:table-cell">
                  {formatCurrency(item.neto_profesional)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums hidden sm:table-cell">
                  {item.turnos_completados}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums hidden lg:table-cell">
                  {formatCurrency(item.ticket_promedio)}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums hidden lg:table-cell">
                  <span className={item.turnos_cancelados > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                    {item.turnos_cancelados}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onVerDetalle(item.profesional_id); }}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
