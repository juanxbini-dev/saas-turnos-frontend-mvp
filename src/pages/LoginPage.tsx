import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/forms/LoginForm';

function LoginPage() {
  const navigate = useNavigate();
  const { state, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      // El error ya se maneja en el AuthContext
      console.error('Login failed:', error);
    }
  };

  // Redirigir si ya está autenticado
  React.useEffect(() => {
    if (state.authUser) {
      navigate('/dashboard');
    }
  }, [state.authUser, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Iniciar Sesión
          </h1>
          <p className="text-gray-600">
            Sistema de gestión de turnos
          </p>
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

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿No tienes cuenta?{' '}
            <button 
              className="text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => navigate('/register')}
            >
              Regístrate
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
