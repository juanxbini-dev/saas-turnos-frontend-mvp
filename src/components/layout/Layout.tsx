import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* Navbar: fijo arriba, nunca se mueve */}
      <Navbar
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
      />

      {/* Área debajo del navbar: sidebar + main como hermanos en flex row */}
      <div className="flex flex-1 overflow-hidden">

        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Main: ocupa todo el espacio restante horizontalmente */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default Layout;