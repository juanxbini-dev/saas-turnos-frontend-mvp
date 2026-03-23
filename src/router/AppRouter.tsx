import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import UsuariosPage from '../pages/UsuariosPage';
import ClientesPage from '../pages/ClientesPage';
import TurnosPage from '../pages/TurnosPage';
import PerfilPage from '../pages/PerfilPage';
import ProductosPage from '../pages/ProductosPage';
import ServiciosPage from '../pages/ServiciosPage';
import { FinanzasPage } from '../pages/FinanzasPage';
import { EmpresaPublicPage } from '../pages/public/EmpresaPublicPage';
import { DebSalonLandingPage } from '../pages/public/DebSalonLandingPage';
import ConfiguracionPage from '../pages/ConfiguracionPage';
import { PrivateRoute } from '../components/PrivateRoute';
import { AdminRoute } from '../components/AdminRoute';
import Layout from '../components/layout/Layout';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<DebSalonLandingPage />} />
      <Route path="/login" element={<LoginPage />} />

{/* Rutas públicas */}
      <Route path="/:empresaSlug" element={<EmpresaPublicPage />} />

      {/* Rutas privadas */}

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/finanzas" element={<FinanzasPage />} />
          <Route path="/usuarios" element={
            <AdminRoute>
              <UsuariosPage />
            </AdminRoute>
          } />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/turnos" element={<TurnosPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
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
