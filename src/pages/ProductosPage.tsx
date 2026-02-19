import React from 'react';
import { useAuth } from '../context/AuthContext';

function ProductosPage() {
  const { state } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Productos
            </h2>
            <p className="text-gray-600 mb-6">
              Gestión de productos del inventario
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Inventario de Productos
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-red-800">
                  Aquí podrás administrar todos los productos disponibles
                </p>
                <p className="text-sm text-red-800">
                  Funcionalidades: Crear, editar, eliminar y gestionar stock
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Nuevo Producto
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProductosPage;
