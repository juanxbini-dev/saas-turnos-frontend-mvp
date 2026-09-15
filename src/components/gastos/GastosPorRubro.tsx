import React from 'react';
import { formatNumero } from './gastos.utils';
import type { GastosPorCategoriaItem } from '../../types/gastos.types';

interface GastosPorRubroProps {
  porCategoria: GastosPorCategoriaItem[];
  isLoading: boolean;
}

// Barras horizontales: cuánto se fue en cada rubro este mes, de mayor a menor.
// Incluye lo que se calcula solo (comisiones, mercadería).
export const GastosPorRubro: React.FC<GastosPorRubroProps> = ({ porCategoria, isLoading }) => {
  const filas = porCategoria.filter((c) => c.monto > 0).sort((a, b) => b.monto - a.monto);
  const max = filas[0]?.monto ?? 0;

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4" data-testid="gastos-por-rubro">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Por rubro</h3>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : filas.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay gastos este mes.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((c) => (
            <li key={c.categoria_id} className="text-xs">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-gray-700 truncate">{c.nombre}</span>
                <span className="text-gray-900 font-medium tabular-nums shrink-0">{formatNumero(c.monto)}</span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${max > 0 ? Math.max(2, (c.monto / max) * 100) : 0}%`, backgroundColor: c.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
