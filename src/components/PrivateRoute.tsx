import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PrivateRoute() {
  const { state } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('🔐 [PrivateRoute] Verificando autenticación...');
    console.log('📊 [PrivateRoute] Estado:', state.status);
    console.log('👤 [PrivateRoute] Usuario:', state.authUser?.email || 'No autenticado');
  }, [state.status, state.authUser]);

  // Mostrar spinner mientras se hidrata la sesión
  if (state.status === 'loading') {
    console.log('⏳ [PrivateRoute] Mostrando spinner de carga...');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Redirigir a login si no está autenticado
  if (state.status === 'unauthenticated') {
    console.log('🚫 [PrivateRoute] No autenticado, redirigiendo a /login');
    console.log('📍 [PrivateRoute] Guardando ruta actual:', location.pathname);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Renderizar Outlet si está autenticado
  console.log('✅ [PrivateRoute] Autenticado, renderizando Outlet');
  return <Outlet />;
}
