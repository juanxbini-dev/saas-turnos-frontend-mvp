import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

// Guard de rutas exclusivas del super admin. A diferencia de AdminRoute, el rol
// 'admin' no alcanza: la sección de gastos es solo para super_admin.
export const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({ children }) => {
  const { state } = useAuth();

  if (!state.authUser) {
    return <Navigate to="/login" replace />;
  }

  if (!state.authUser.roles.includes('super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
