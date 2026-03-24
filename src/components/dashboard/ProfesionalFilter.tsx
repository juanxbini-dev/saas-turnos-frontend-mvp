import React from 'react';
import { Profesional } from '../../types/turno.types';

interface ProfesionalFilterProps {
  profesionales: Profesional[]
  selectedId: string | null
  onSelect: (id: string) => void
  colores: Record<string, string>
  authUserId: string
}

export function ProfesionalFilter({ 
  profesionales, 
  selectedId, 
  onSelect, 
  colores,
  authUserId 
}: ProfesionalFilterProps) {
  // Ordenar: usuario autenticado primero, luego resto alfabéticamente
  const sortedProfesionales = [...profesionales].sort((a, b) => {
    if (a.id === authUserId) return -1;
    if (b.id === authUserId) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <>
      {/* Mobile: select */}
      <select
        className="sm:hidden w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>Seleccionar profesional...</option>
        {sortedProfesionales.map((profesional) => (
          <option key={profesional.id} value={profesional.id}>
            {profesional.nombre}{profesional.id === authUserId ? ' (Tú)' : ''}
          </option>
        ))}
      </select>

      {/* Desktop: botones */}
      <div className="hidden sm:block overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {sortedProfesionales.map((profesional) => {
            const isActive = selectedId === profesional.id;
            const color = colores[profesional.id] || '#3B82F6';
            return (
              <button
                key={profesional.id}
                onClick={() => onSelect(profesional.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive ? 'text-white shadow-lg transform scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={isActive ? { backgroundColor: color } : {}}
              >
                {profesional.nombre}
                {profesional.id === authUserId && (
                  <span className="ml-1 text-xs opacity-75">(Tú)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
