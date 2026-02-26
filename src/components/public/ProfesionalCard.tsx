import React from 'react';
import { Card, Button } from '../ui';
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
    <Card className="hover:shadow-lg transition-all duration-200 border-2 border-gray-200 hover:border-blue-300">
      <div className="p-6">
        {/* Header con foto y nombre */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {profesional.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {profesional.nombre}
            </h3>
            <p className="text-sm text-gray-500">@{profesional.username}</p>
          </div>
        </div>

        {/* Roles/Especialidad */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {profesional.roles.map((rol) => (
              <span
                key={rol}
                className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
              >
                {rol === 'admin' ? 'Administrador' : 'Profesional'}
              </span>
            ))}
          </div>
        </div>

        {/* Email */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Email:</span> {profesional.email}
          </p>
        </div>

        {/* Estado */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            profesional.activo 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1 ${
              profesional.activo ? 'bg-green-400' : 'bg-red-400'
            }`}></span>
            {profesional.activo ? 'Disponible' : 'No disponible'}
          </span>
        </div>

        {/* Botones de acción */}
        <div className="flex space-x-3">
          <Button
            onClick={() => onSacarTurno(profesional)}
            disabled={!profesional.activo}
            className="flex-1"
          >
            Sacar turno
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
