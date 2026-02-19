import React from 'react';
import { useAuth } from '../context/AuthContext';

function TurnosPage() {
  const { state } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Turnos
            </h2>
            <p className="text-gray-600 mb-6">
              Gestión de turnos y agendamientos
            </p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">
                Calendario de Turnos
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-orange-800">
                  Aquí podrás administrar todos los turnos agendados
                </p>
                <p className="text-sm text-orange-800">
                  Funcionalidades: Crear, editar, cancelar y ver turnos
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Nuevo Turno
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TurnosPage;
