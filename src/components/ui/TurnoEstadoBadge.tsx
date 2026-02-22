import React from 'react';
import { TurnoEstado } from '../../types/turno.types';

interface TurnoEstadoBadgeProps {
  estado: TurnoEstado;
}

export const TurnoEstadoBadge: React.FC<TurnoEstadoBadgeProps> = ({ estado }) => {
  const getEstadoConfig = (estado: TurnoEstado) => {
    switch (estado) {
      case 'pendiente':
        return {
          text: 'Pendiente',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      case 'confirmado':
        return {
          text: 'Confirmado',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'completado':
        return {
          text: 'Completado',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'cancelado':
        return {
          text: 'Cancelado',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          text: estado,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const config = getEstadoConfig(estado);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.text}
    </span>
  );
};
