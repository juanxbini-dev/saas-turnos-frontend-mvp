import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { GASTOS_SUGERIDOS, type GastoSugerido } from './gastos.utils';

interface ArranqueGuiadoProps {
  onElegir: (sugerido?: GastoSugerido) => void;
}

// Arranque guiado: la primera vez no hay nada, y "$0" no le dice al dueño qué
// hacer. Los chips la llevan directo a cargar sus fijos con dos toques: abren el
// panel con "Sí, todos los meses", nombre y categoría puestos y el foco en el monto.
export const ArranqueGuiado: React.FC<ArranqueGuiadoProps> = ({ onElegir }) => (
  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center" data-testid="arranque-guiado">
    <h3 className="text-base font-semibold text-gray-900">Empezá con tus gastos fijos</h3>
    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
      Tocá los que pagás todos los meses. Solo te va a pedir el monto; después se repiten solos.
    </p>
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {GASTOS_SUGERIDOS.map((s) => (
        <button
          key={s.nombre}
          type="button"
          onClick={() => onElegir(s)}
          className="inline-flex items-center gap-1 text-sm border border-gray-300 bg-white rounded-full px-3 py-1.5 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 transition-colors"
        >
          <Plus size={14} /> {s.nombre}
        </button>
      ))}
    </div>
    <button type="button" onClick={() => onElegir()} className="text-sm text-blue-600 hover:underline mt-4 inline-flex items-center gap-1">
      Otro gasto <ChevronRight size={14} />
    </button>
  </div>
);
