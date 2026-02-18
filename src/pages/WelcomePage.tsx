import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

function WelcomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Incluso si falla, redirigir a login
      navigate('/login');
    }
  };

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
            <Button 
              onClick={() => navigate('/dashboard')}
              className="bg-green-600 hover:bg-green-700"
            >
              Ir al Dashboard
            </Button>
            <Button 
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Cerrar Sesión
            </Button>
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
