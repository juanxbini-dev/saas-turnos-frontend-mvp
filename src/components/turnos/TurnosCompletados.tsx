import React, { useEffect, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
import { turnoService } from '../../services/turno.service';
import { TurnoConDetalle } from '../../types/turno.types';

export const TurnosCompletados: React.FC = () => {
  const {
    data: turnos,
    loading,
    error,
    revalidate
  } = useFetch(
    buildKey(ENTITIES.TURNOS),
    () => turnoService.getTurnos(),
    { ttl: 60 } // Cache de 1 minuto
  );

  // Filtrar solo turnos completados
  const turnosCompletados = turnos ? turnos.filter(turno => 
    turno.estado === 'completado'
  ) : [];

  useEffect(() => {
    console.log('🧪 [TurnosCompletados] Datos actualizados:', {
      total: turnos?.length || 0,
      completados: turnosCompletados.length,
      loading,
      error
    });
  }, [turnos, turnosCompletados, loading, error]);

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-3">
          🧪 Componente de Pruebas - Turnos Completados
        </h3>
        <div className="text-yellow-600">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-3">
          🧪 Componente de Pruebas - Error
        </h3>
        <div className="text-red-600">Error al cargar turnos completados</div>
        <button 
          onClick={revalidate}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-yellow-800">
          🧪 Componente de Pruebas - Turnos Completados
        </h3>
        <button 
          onClick={revalidate}
          className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
        >
          🔄 Refresh
        </button>
      </div>
      
      {turnosCompletados.length === 0 ? (
        <p className="text-yellow-600">No hay turnos completados</p>
      ) : (
        <div className="space-y-2">
          {turnosCompletados.map(turno => (
            <div 
              key={turno.id} 
              className="p-3 bg-white border border-yellow-300 rounded-md"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{turno.cliente_nombre}</span>
                  <span className="mx-2">•</span>
                  <span className="text-gray-600">{turno.servicio}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {turno.fecha} {turno.hora}
                  </div>
                  <div className="text-xs text-green-600 font-medium">
                    {turno.estado}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-3 text-xs text-yellow-700">
        Total turnos: {turnos?.length || 0} | Completados: {turnosCompletados.length}
      </div>
    </div>
  );
};
