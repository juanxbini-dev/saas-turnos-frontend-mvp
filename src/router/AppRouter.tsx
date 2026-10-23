import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import UsuariosPage from '../pages/UsuariosPage';
import ClientesPage from '../pages/ClientesPage';
import TurnosPage from '../pages/TurnosPage';
import PerfilPage from '../pages/PerfilPage';
import ProductosPage from '../pages/ProductosPage';
import ServiciosPage from '../pages/ServiciosPage';
import { FinanzasPage } from '../pages/FinanzasPage';
import MetricasPage from '../pages/MetricasPage';
import GastosPage from '../pages/GastosPage';
import CampaniasPage from '../pages/CampaniasPage';
import BeneficiosPage from '../pages/BeneficiosPage';
import { DebSalonLandingPage } from '../pages/public/DebSalonLandingPage';
import { PrivacidadPage } from '../pages/public/PrivacidadPage';
import { BeneficioPage } from '../pages/public/BeneficioPage';
import ConfiguracionPage from '../pages/ConfiguracionPage';
import { PrivateRoute } from '../components/PrivateRoute';
import { AdminRoute } from '../components/AdminRoute';
import { SuperAdminRoute } from '../components/SuperAdminRoute';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { RUTA_PARA_CONTACTAR } from '../services/avisos.service';
import { RUTA_BENEFICIO } from '../config/beneficio';

function PerfilRoute() {
  const { state } = useAuth();
  if (state.authUser?.roles.includes('super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <PerfilPage />;
}

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<DebSalonLandingPage />} />
      {/* Pública, sin login: la pide Meta y la enlaza el tilde de novedades de la reserva */}
      <Route path="/privacidad" element={<PrivacidadPage />} />
      {/* Pública, sin login: pedir el código de beneficio (llega desde el mail con ?m=) */}
      <Route path={RUTA_BENEFICIO} element={<BeneficioPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas privadas */}

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/finanzas" element={<FinanzasPage />} />
          <Route path="/metricas" element={
            <AdminRoute>
              <MetricasPage />
            </AdminRoute>
          } />
          <Route path="/gastos" element={
            <SuperAdminRoute>
              <GastosPage />
            </SuperAdminRoute>
          } />
          <Route path="/campanias" element={
            <SuperAdminRoute>
              <CampaniasPage />
            </SuperAdminRoute>
          } />
          <Route path="/beneficios" element={
            <AdminRoute>
              <BeneficiosPage />
            </AdminRoute>
          } />
          {/* "Para contactar" pasó a ser una pestaña de Productos: los links viejos siguen andando */}
          <Route path="/para-contactar" element={<Navigate to={RUTA_PARA_CONTACTAR} replace />} />
          <Route path="/usuarios" element={
            <AdminRoute>
              <UsuariosPage />
            </AdminRoute>
          } />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/turnos" element={<TurnosPage />} />
          <Route path="/perfil" element={<PerfilRoute />} />
          <Route path="/configuracion" element={
            <AdminRoute>
              <ConfiguracionPage />
            </AdminRoute>
          } />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/servicios" element={<ServiciosPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRouter;
