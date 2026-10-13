import React from 'react';
import { Info } from 'lucide-react';

interface SeguimientoTurnoBotonProps {
  onClick: () => void;
  className?: string;
}

export const ETIQUETA_SEGUIMIENTO = 'Cómo se sacó el turno';

/**
 * Ícono chico de info que abre el seguimiento del turno.
 * Pensado para NO ocupar lugar: ícono de 14px y área de toque ampliada con
 * padding + margen negativo (p-1 -m-1), así no agranda la fila ni la tarjeta.
 * Frena la propagación para no expandir filas ni disparar el click del contenedor.
 */
export const SeguimientoTurnoBoton: React.FC<SeguimientoTurnoBotonProps> = ({ onClick, className = '' }) => (
  <button
    type="button"
    aria-label={ETIQUETA_SEGUIMIENTO}
    title={ETIQUETA_SEGUIMIENTO}
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    }}
    onMouseDown={(e) => e.stopPropagation()}
    onTouchStart={(e) => e.stopPropagation()}
    className={`inline-flex items-center justify-center shrink-0 p-1 -m-1 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className}`}
  >
    <Info className="w-3.5 h-3.5" aria-hidden="true" />
  </button>
);
