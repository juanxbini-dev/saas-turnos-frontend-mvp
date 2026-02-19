import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    console.log('🏗️ [Layout] Componente Layout montado');
    console.log('📱 [Layout] Estructura: Navbar + Sidebar + Main con Outlet');
  }, []);

  const toggleMobileMenu = () => {
    console.log('📱 [Layout] Toggle mobile menu:', !mobileMenuOpen);
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="flex flex-col h-screen relative">
      <Navbar mobileMenuOpen={mobileMenuOpen} onToggleMobileMenu={toggleMobileMenu} />
      <Sidebar mobileOpen={mobileMenuOpen} onToggleMobile={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 lg:ml-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
