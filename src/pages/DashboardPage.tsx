import React from 'react';
import { useAuth } from '../context/AuthContext';

function DashboardPage() {
  const { state } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Dashboard
            </h2>
            <p className="text-gray-600 mb-6">
              Bienvenido al sistema de gestión de turnos
            </p>
            
            {/* Información del usuario */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Información de Usuario
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-blue-800">
                  <strong>Email:</strong> {state.authUser?.email}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Tenant:</strong> {state.authUser?.tenant}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Roles:</strong> {state.authUser?.roles?.join(', ') || 'Sin roles'}
                </p>
              </div>
            </div>

            {/* Estado de autenticación */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Estado de Autenticación
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-green-800">
                  <strong>Estado:</strong> {state.status}
                </p>
                <p className="text-sm text-green-800">
                  <strong>Token:</strong> {state.accessToken ? '✅ Válido' : '❌ No disponible'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
