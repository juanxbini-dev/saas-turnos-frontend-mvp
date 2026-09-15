import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { etiquetaPeriodo, formatMoneda } from './gastos.utils';
import type { GastoRecurrente } from '../../types/gastos.types';

interface GastosFijosCardProps {
  recurrentes: GastoRecurrente[];
  isLoading: boolean;
  onNuevo: () => void;
  onEditar: (r: GastoRecurrente) => void;
  onVerTodos: () => void;
}

const MAX_VISIBLES = 6;

// Los gastos fijos vigentes, los más grandes primero. Desde acá se edita el
// gasto "para todos los meses"; lo de un mes puntual se toca en la tabla.
export const GastosFijosCard: React.FC<GastosFijosCardProps> = ({ recurrentes, isLoading, onNuevo, onEditar, onVerTodos }) => {
  const activos = recurrentes.filter((r) => r.activo).sort((a, b) => b.monto_default - a.monto_default);
  const visibles = activos.slice(0, MAX_VISIBLES);
  const restantes = activos.length - visibles.length;

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-fijos-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Mis gastos fijos</h3>
        <button
          type="button"
          onClick={onNuevo}
          className="p-1 rounded text-blue-600 hover:bg-blue-50"
          aria-label="Nuevo gasto fijo"
          title="Nuevo gasto fijo"
        >
          <Plus size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 py-3 space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : activos.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500 text-center">Todavía no cargaste gastos fijos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibles.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.categoria?.color ?? '#a3a3a3' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">{r.nombre}</div>
                <div className="text-xs text-gray-500 truncate">
                  {r.categoria?.nombre ?? 'Sin categoría'}
                  {r.dia_vencimiento && ` · vence el ${r.dia_vencimiento}`}
                  {' · '}desde {etiquetaPeriodo(r.periodo_desde)}
                </div>
              </div>
              <span className="text-sm text-gray-900 tabular-nums shrink-0">
                {formatMoneda(r.monto_default)}<span className="text-xs text-gray-400">/mes</span>
              </span>
              <button
                type="button"
                onClick={() => onEditar(r)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label={`Editar ${r.nombre} para todos los meses`}
                title="Editar para todos los meses"
              >
                <Pencil size={14} />
              </button>
            </li>
          ))}
          {restantes > 0 && <li className="px-4 py-2 text-xs text-gray-500">y {restantes} más…</li>}
        </ul>
      )}

      <div className="px-4 py-2 border-t border-gray-100 space-y-1">
        <button type="button" onClick={onVerTodos} className="text-xs text-blue-600 hover:underline">
          Ver todos, incluidos los cerrados
        </button>
        <p className="text-xs text-gray-400">
          Acá se cambia el gasto para todos los meses. Para un mes puntual, editalo en la tabla.
        </p>
      </div>
    </section>
  );
};
