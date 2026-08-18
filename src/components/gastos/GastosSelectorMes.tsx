import { ChevronLeft, ChevronRight } from 'lucide-react';
import { etiquetaPeriodo, periodoActual, sumarMeses } from './gastos.utils';

interface GastosSelectorMesProps {
  periodo: string;
  onChange: (periodo: string) => void;
}

// Un mes grande, dos flechas y "volver a hoy". Sin tope hacia adelante: el
// cliente pidió poder cargar gastos de meses futuros (alquiler ya pactado, seña).
export function GastosSelectorMes({ periodo, onChange }: GastosSelectorMesProps) {
  const actual = periodoActual();
  const esActual = periodo === actual;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(sumarMeses(periodo, -1))}
        className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-xl font-semibold text-gray-900 min-w-44 text-center">{etiquetaPeriodo(periodo)}</h2>
      <button
        onClick={() => onChange(sumarMeses(periodo, 1))}
        className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={20} />
      </button>
      {!esActual && (
        <button onClick={() => onChange(actual)} className="ml-1 text-sm text-blue-600 hover:underline">
          volver a hoy
        </button>
      )}
    </div>
  );
}
