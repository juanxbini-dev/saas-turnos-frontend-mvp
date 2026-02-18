import React from 'react';
import { useNavigate } from 'react-router-dom';

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            ¡Bienvenido!
          </h1>
          <p className="text-gray-600 mb-8">
            Sistema de gestión de turnos
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Iniciar Sesión
            </button>
            <button className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition duration-200">
              Registrarse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
