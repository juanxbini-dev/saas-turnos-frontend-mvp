import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { GastosEvolucionChart } from './GastosEvolucionChart';
import { GastosCategoriasChart } from './GastosCategoriasChart';
import { GastosComparativaChart } from './GastosComparativaChart';
import type { GastosEvolucionPunto, GastosPorCategoriaItem } from '../../types/gastos.types';

interface GastosAnalisisProps {
  periodo: string;
  evolucion: GastosEvolucionPunto[];
  porCategoria: GastosPorCategoriaItem[];
  loadingEvolucion: boolean;
  loadingCategorias: boolean;
}

// Los gráficos existen pero no tapan el trabajo diario: arrancan plegados y se
// abren con un click cuando el dueño quiere mirar cómo viene el año.
export const GastosAnalisis: React.FC<GastosAnalisisProps> = ({
  periodo, evolucion, porCategoria, loadingEvolucion, loadingCategorias,
}) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <BarChart3 size={18} className="text-gray-400" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">Ver cómo viene el año</div>
          <div className="text-xs text-gray-500">Gráficos de los últimos 12 meses y comparación con el mes pasado</div>
        </div>
        {abierto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {abierto && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          <GastosEvolucionChart datos={evolucion} periodoActual={periodo} isLoading={loadingEvolucion} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GastosCategoriasChart datos={porCategoria} isLoading={loadingCategorias} />
            <GastosComparativaChart datos={porCategoria} periodo={periodo} isLoading={loadingCategorias} />
          </div>
        </div>
      )}
    </div>
  );
};
