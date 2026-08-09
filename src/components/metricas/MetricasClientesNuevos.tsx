import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Card, Avatar, Badge, Button } from '../ui';
import { MetricasClientesNuevos as MetricasClientesNuevosData } from '../../types/metricas.types';

interface MetricasClientesNuevosProps {
  data: MetricasClientesNuevosData | null;
  isLoading: boolean;
}

const LISTA_INICIAL = 8;

const formatFecha = (fecha: string): string => {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
};

export const MetricasClientesNuevos: React.FC<MetricasClientesNuevosProps> = ({
  data,
  isLoading,
}) => {
  const [verTodos, setVerTodos] = useState(false);

  if (isLoading) {
    return (
      <Card title="Clientes nuevos">
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

  if (!data || data.total === 0) {
    return (
      <Card title="Clientes nuevos" subtitle="Primera visita dentro del período">
        <p className="text-sm text-gray-500 text-center py-6">
          No hubo clientes nuevos en este período
        </p>
      </Card>
    );
  }

  const maxPorProfesional = Math.max(...data.por_profesional.map(p => p.clientes_nuevos), 1);
  const clientesVisibles = verTodos ? data.clientes : data.clientes.slice(0, LISTA_INICIAL);

  return (
    <Card
      title="Clientes nuevos"
      subtitle="Primera visita dentro del período y qué profesional eligieron"
      noPadding
    >
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Distribución por profesional */}
        <div className="lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 leading-none">{data.total}</div>
              <div className="text-xs text-gray-500 mt-1">
                {data.total === 1 ? 'cliente nuevo' : 'clientes nuevos'} en el período
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.por_profesional.map((p) => (
              <div key={p.profesional_id} className="flex items-center gap-3">
                <Avatar name={p.nombre} src={p.avatar_url ?? undefined} size="sm" className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{p.nombre}</span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {p.clientes_nuevos}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        ({Math.round((p.clientes_nuevos / data.total) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.round((p.clientes_nuevos / maxPorProfesional) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Listado de clientes nuevos */}
        <div className="lg:col-span-3 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">1ª visita</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Profesional</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Servicio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Origen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Volvió</th>
              </tr>
            </thead>
            <tbody>
              {clientesVisibles.map((c) => (
                <tr key={c.cliente_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-2.5">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-40">{c.cliente_nombre}</div>
                    {c.telefono && <div className="text-xs text-gray-400">{c.telefono}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 tabular-nums whitespace-nowrap">
                    {formatFecha(c.fecha_primera_visita)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 truncate max-w-32">
                    {c.profesional_nombre ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-500 truncate max-w-36 hidden md:table-cell">
                    {c.servicio}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    {c.origen ? (
                      <Badge variant={c.origen === 'web' ? 'blue' : 'gray'} size="sm">
                        {c.origen === 'web' ? 'Web' : 'Interno'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={c.volvio ? 'green' : 'yellow'} size="sm">
                      {c.volvio ? 'Sí' : 'Aún no'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.clientes.length > LISTA_INICIAL && (
            <div className="px-6 py-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setVerTodos(!verTodos)}>
                {verTodos ? 'Ver menos' : `Ver todos (${data.clientes.length})`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
