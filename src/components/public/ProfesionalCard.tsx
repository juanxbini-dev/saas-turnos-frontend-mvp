import React from 'react';
import { Card, Button, Avatar } from '../ui';
import { ProfesionalPublic } from '../../services/public';

interface ProfesionalCardProps {
  profesional: ProfesionalPublic;
  onSacarTurno: (profesional: ProfesionalPublic) => void;
  onVerPerfil: (profesional: ProfesionalPublic) => void;
}

export const ProfesionalCard: React.FC<ProfesionalCardProps> = ({
  profesional,
  onSacarTurno,
  onVerPerfil
}) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-2 border-gray-200 hover:border-blue-300 flex flex-col">
      <div className="p-6 flex flex-col flex-1">
        {/* Avatar y nombre */}
        <div className="flex flex-col items-center text-center mb-4">
          <Avatar
            src={profesional.avatar_url || undefined}
            name={profesional.nombre}
            size="lg"
            className="!w-20 !h-20 !text-2xl mb-3"
          />
          <h3 className="text-lg font-semibold text-gray-900">{profesional.nombre}</h3>
          {profesional.descripcion && (
            <p className="text-sm text-gray-500 mt-1">{profesional.descripcion}</p>
          )}
        </div>

        {/* Estado */}
        <div className="flex justify-center mb-4">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            profesional.activo
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${
              profesional.activo ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {profesional.activo ? 'Disponible' : 'No disponible'}
          </span>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-2 mt-auto">
          <Button
            onClick={() => onSacarTurno(profesional)}
            disabled={!profesional.activo}
            className="flex-1"
          >
            Reservar turno
          </Button>
          <Button
            variant="secondary"
            onClick={() => onVerPerfil(profesional)}
            className="flex-1"
          >
            Ver perfil
          </Button>
        </div>
      </div>
    </Card>
  );
};
