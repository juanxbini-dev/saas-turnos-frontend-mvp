import React from 'react';
import { useAuth } from '../context/AuthContext';

function PerfilPage() {
  const { state } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Mi Perfil
            </h2>
            <p className="text-gray-600 mb-6">
              Configuración de tu cuenta personal
            </p>
            
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                Información Personal
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-indigo-800">
                  <strong>Email:</strong> {state.authUser?.email}
                </p>
                <p className="text-sm text-indigo-800">
                  <strong>Tenant:</strong> {state.authUser?.tenant}
                </p>
                <p className="text-sm text-indigo-800">
                  Aquí podrás actualizar tu información personal y preferencias
                </p>
              </div>
            </div>

            <div className="mt-8 space-x-4">
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Editar Perfil
              </button>
              <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PerfilPage;
