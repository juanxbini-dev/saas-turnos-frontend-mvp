import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface TestComponentProps {
  // Props para componentes de prueba
  [key: string]: any;
}

function TestComponentPage() {
  const { state } = useAuth();
  const [testData, setTestData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Test Components
            </h2>
            <p className="text-gray-600 mb-6">
              Área de pruebas para componentes UI y funcionalidades
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Zona de Testing
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-yellow-800">
                  Aquí puedes inyectar y probar cualquier componente
                </p>
                <p className="text-sm text-yellow-800">
                  Usuario actual: {state.authUser?.email || 'No autenticado'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 mb-6">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Test Button 1
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Test Button 2
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Test Button 3
              </button>
            </div>
          </div>

          {/* Test Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Component Test Area 1 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Component Test Area 1
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="mb-2">🧪 Área de prueba para componentes</p>
                  <p className="text-sm">Inserta aquí tu componente para testing</p>
                </div>
              </div>
            </div>

            {/* Component Test Area 2 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Component Test Area 2
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="mb-2">🧪 Área de prueba para componentes</p>
                  <p className="text-sm">Inserta aquí tu componente para testing</p>
                </div>
              </div>
            </div>

            {/* Form Test Area */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Form Test Area
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="mb-2">📝 Área de prueba para formularios</p>
                  <p className="text-sm">Inserta aquí tu formulario para testing</p>
                </div>
              </div>
            </div>

            {/* API Test Area */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                API Test Area
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="mb-2">🌐 Área de prueba para APIs</p>
                  <p className="text-sm">Inserta aquí tus llamadas API para testing</p>
                </div>
              </div>
            </div>

          </div>

          {/* Debug Information */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Debug Information
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 overflow-x-auto">
{`Auth Status: ${state.status}
User Email: ${state.authUser?.email || 'N/A'}
User Tenant: ${state.authUser?.tenant || 'N/A'}
Test Data: ${JSON.stringify(testData, null, 2)}`}
              </pre>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default TestComponentPage;
