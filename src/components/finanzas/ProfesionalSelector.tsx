import React from 'react';
import type { Usuario } from '../../types/usuario.types';
import { Card, Badge, Spinner } from '../ui';

interface ProfesionalSelectorProps {
  profesionales: Usuario[];
  selectedProfesionalId: string | null;
  onSelectProfesional: (id: string) => void;
  isLoading: boolean;
}

export const ProfesionalSelector: React.FC<ProfesionalSelectorProps> = ({
  profesionales,
  selectedProfesionalId,
  onSelectProfesional,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card className="mb-6">
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
          <span className="ml-2 text-gray-600">Cargando profesionales...</span>
        </div>
      </Card>
    );
  }

  const selectedProfesional = profesionales.find(p => p.id === selectedProfesionalId);

  return (
    <Card className="mb-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-2">
          <span className="text-lg font-semibold text-gray-800">👥</span>
          <h3 className="text-lg font-semibold text-gray-800">Ver finanzas de:</h3>
        </div>

        {/* Selector Dropdown */}
        <div className="relative">
          <select
            value={selectedProfesionalId || ''}
            onChange={(e) => onSelectProfesional(e.target.value)}
            className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer"
          >
            <option value="">Seleccionar profesional...</option>
            {profesionales.map((profesional) => (
              <option key={profesional.id} value={profesional.id}>
                {profesional.nombre}
              </option>
            ))}
          </select>
          
          {/* Dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Profesional seleccionado - Simplificado */}
        {selectedProfesional && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">
                  {selectedProfesional.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{selectedProfesional.nombre}</h4>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={selectedProfesional.roles.includes('admin') ? 'blue' : 'green'} 
                    className="text-xs"
                  >
                    {selectedProfesional.roles.includes('admin') ? 'Admin' : 'Staff'}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {selectedProfesional.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje si no hay profesionales */}
        {profesionales.length === 0 && !isLoading && (
          <div className="text-center py-4 text-gray-500">
            <span className="text-2xl mb-2 block">👥</span>
            <p>No hay profesionales disponibles</p>
          </div>
        )}
      </div>
    </Card>
  );
};
