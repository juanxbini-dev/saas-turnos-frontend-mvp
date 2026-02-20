import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { useErrorHandler } from '../hooks/useErrorHandler';

interface TestComponentProps {
  // Props para componentes de prueba
  [key: string]: any;
}

// Componente que lanza error intencionalmente
function BuggyComponent() {
  const [shouldThrow, setShouldThrow] = useState(false);
  
  console.log('🐛 BuggyComponent render - shouldThrow:', shouldThrow);
  
  if (shouldThrow) {
    console.log('🐛 BuggyComponent - Lanzando error ahora');
    throw new Error('Este es un error de render intencional para probar ErrorBoundary');
  }
  
  return (
    <div className="p-4 bg-green-100 border border-green-400 rounded">
      <p className="text-green-800">Componente funcionando correctamente</p>
      <button 
        onClick={() => {
          console.log('🐛 BuggyComponent - Botón clickeado, setShouldThrow(true)');
          setShouldThrow(true);
        }}
        className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
      >
        Lanzar Error de Render
      </button>
    </div>
  );
}

// Componente con error async
function AsyncErrorComponent() {
  const { throwError } = useErrorHandler();
  
  const handleAsyncError = () => {
    console.log('🔥 AsyncErrorComponent - Botón clickeado');
    // Simular error de red o async de forma síncrona
    // para que lo capture el ErrorBoundary inmediatamente
    try {
      console.log('🔥 AsyncErrorComponent - Lanzando error en try/catch');
      throw new Error('Error async simulado desde componente');
    } catch (error) {
      console.log('🔥 AsyncErrorComponent - Error capturado, llamando a throwError');
      throwError(error instanceof Error ? error : new Error('Error desconocido'));
    }
  };
  
  return (
    <div className="p-4 bg-blue-100 border border-blue-400 rounded">
      <p className="text-blue-800">Componente con manejo de errores async</p>
      <button 
        onClick={handleAsyncError}
        className="mt-2 bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
      >
        Lanzar Error Async
      </button>
    </div>
  );
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
                🧪 Zona de Testing - Error Boundary
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-yellow-800">
                  Prueba el sistema de Error Boundary con los botones abajo
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
            
            {/* Error Boundary Test Area 1 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🛡️ Error Boundary - Render
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
                <ErrorBoundary>
                  <BuggyComponent />
                </ErrorBoundary>
              </div>
            </div>

            {/* Error Boundary Test Area 2 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🛡️ Error Boundary - Async
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
                <ErrorBoundary>
                  <AsyncErrorComponent />
                </ErrorBoundary>
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
