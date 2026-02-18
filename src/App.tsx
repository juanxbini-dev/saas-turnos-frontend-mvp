import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import { PrivateRoute } from './components/PrivateRoute';

// Placeholder Dashboard
function DashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Dashboard
        </h1>
        <p className="text-gray-600 mb-8">
          Bienvenido al sistema de gestión de turnos
        </p>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition duration-200"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <DashboardPage />
                  </PrivateRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </AppProvider>
  );
}

export default App;
