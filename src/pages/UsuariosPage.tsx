import React from 'react';
import { useAuth } from '../context/AuthContext';

function UsuariosPage() {
  const { state } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Usuarios
            </h2>
            <p className="text-gray-600 mb-6">
              Gestión de usuarios del sistema
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Lista de Usuarios
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-green-800">
                  Aquí podrás administrar todos los usuarios del sistema
                </p>
                <p className="text-sm text-green-800">
                  Funcionalidades: Crear, editar, eliminar y buscar usuarios
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Nuevo Usuario
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UsuariosPage;
