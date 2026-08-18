import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '../ui';
import { etiquetaPeriodo, periodoActual, sumarMeses } from './gastos.utils';

interface GastosSelectorMesProps {
  periodo: string;
  onChange: (periodo: string) => void;
}

// A diferencia de Métricas, acá NO hay tope hacia adelante: el cliente pidió
// poder cargar gastos de meses futuros (alquiler ya pactado, seña de un evento).
export function GastosSelectorMes({ periodo, onChange }: GastosSelectorMesProps) {
  const actual = periodoActual();
  const esActual = periodo === actual;

  // Salto directo: los 12 meses previos + los 6 siguientes, en un select
  const opciones = useMemo(() => {
    const lista: string[] = [];
    for (let i = -12; i <= 6; i++) lista.push(sumarMeses(actual, i));
    if (!lista.includes(periodo)) lista.push(periodo);
    return lista.sort();
  }, [actual, periodo]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" leftIcon={ChevronLeft} onClick={() => onChange(sumarMeses(periodo, -1))}>
          Anterior
        </Button>
        <h2 className="text-lg font-semibold text-gray-900 min-w-40 text-center">
          {etiquetaPeriodo(periodo)}
        </h2>
        <Button variant="ghost" size="sm" rightIcon={ChevronRight} onClick={() => onChange(sumarMeses(periodo, 1))}>
          Siguiente
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={periodo}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Ir a un mes"
        >
          {opciones.map((p) => (
            <option key={p} value={p}>{etiquetaPeriodo(p)}</option>
          ))}
        </select>
        {!esActual && (
          <Button variant="secondary" size="sm" leftIcon={CalendarDays} onClick={() => onChange(actual)}>
            Hoy
          </Button>
        )}
      </div>
    </div>
  );
}
