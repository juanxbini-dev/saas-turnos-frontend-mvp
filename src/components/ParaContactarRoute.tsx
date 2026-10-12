import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { puedeVerParaContactar } from '../services/avisos.service';

interface ParaContactarRouteProps {
  children: React.ReactNode;
}

// Guard de "Para contactar": recepción, admin y super admin (los mismos roles que acepta el
// backend en /api/avisos). Los profesionales no lo ven, por ahora (spec de productos §11.1).
export const ParaContactarRoute: React.FC<ParaContactarRouteProps> = ({ children }) => {
  const { state } = useAuth();

  if (!state.authUser) {
    return <Navigate to="/login" replace />;
  }

  if (!puedeVerParaContactar(state.authUser.roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
