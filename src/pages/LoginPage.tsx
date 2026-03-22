import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/forms/LoginForm';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Obtener la ruta intentada del estado de navegación
  const from = location.state?.from || '/dashboard';

  const handleSubmit = async () => {
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Redirigir si ya está autenticado
  React.useEffect(() => {
    if (state.authUser) {
      navigate(from, { replace: true });
    }
  }, [state.authUser, navigate, from]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Iniciar Sesión
          </h1>
          <p className="text-gray-600 mb-4">
            Sistema de gestión de turnos
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Formato de usuario:</strong> usuario@empresa
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Ejemplo: dani@debsalon
            </p>
          </div>
        </div>

        <LoginForm
          email={email}
          password={password}
          loading={state.status === 'loading'}
          error={state.error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
        />

      </div>
    </div>
  );
}

export default LoginPage;
