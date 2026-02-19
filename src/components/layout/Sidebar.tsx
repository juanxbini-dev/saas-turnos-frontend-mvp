import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Menu, 
  X,
  Calendar,
  Users,
  Settings
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

const Sidebar = ({ mobileOpen, onToggleMobile }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const sidebarRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    // Forzar actualización del estilo
    if (sidebarRef.current) {
      const transform = mobileOpen ? 'translateX(0)' : 'translateX(-100%)';
      sidebarRef.current.style.transform = transform;
    }
  }, [collapsed, location.pathname, mobileOpen]);

  const toggleCollapsed = () => {
    console.log('🔄 [Sidebar] Toggle collapsed:', !collapsed);
    setCollapsed(!collapsed);
  };

  // Cerrar sidebar en mobile cuando cambia la ruta (pero no en la carga inicial)
  useEffect(() => {
    if (window.innerWidth < 1024 && mobileOpen && location.pathname !== '/dashboard') {
      onToggleMobile();
    }
  }, [location.pathname, mobileOpen, onToggleMobile]);

  // Cerrar sidebar en mobile cuando se redimensiona a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileOpen) {
        onToggleMobile();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileOpen, onToggleMobile]);

  const menuItems = [
    {
      path: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/appointments',
      icon: Calendar,
      label: 'Turnos'
    },
    {
      path: '/users',
      icon: Users,
      label: 'Usuarios'
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'Configuración'
    }
  ];

  const sidebarClasses = `
        fixed lg:static inset-y-0 left-0 z-[60]
        bg-gray-800 text-white
        transform transition-transform duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen 
          ? 'translate-x-0' 
          : '-translate-x-full'
        }
        lg:translate-x-0
      `;
      
      console.log('🎨 [Sidebar] Clases CSS aplicadas:', sidebarClasses.trim());
      console.log('📱 [Sidebar] mobileOpen:', mobileOpen, 'collapsed:', collapsed);

  const transformStyle = mobileOpen ? 'translateX(0)' : 'translateX(-100%)';
      console.log('🎯 [Sidebar] Estilo transform:', transformStyle, 'mobileOpen:', mobileOpen);

  return (
    <>
      {/* Overlay para mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[50] lg:hidden"
          onClick={onToggleMobile}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={sidebarClasses}
        style={{
          transform: transformStyle
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!collapsed && (
            <h2 className="text-lg font-semibold">Menú</h2>
          )}
          <button
            onClick={collapsed ? toggleCollapsed : onToggleMobile}
            className="p-2 rounded-md hover:bg-gray-700 transition-colors"
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `
                      flex items-center space-x-3 px-3 py-2 rounded-md transition-colors
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon size={20} />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Botón de toggle para desktop (siempre visible cuando está colapsado) */}
        {collapsed && (
          <div className="absolute bottom-4 left-0 right-0 px-2">
            <button
              onClick={toggleCollapsed}
              className="w-full p-2 rounded-md hover:bg-gray-700 transition-colors flex justify-center"
              aria-label="Expandir sidebar"
            >
              <Menu size={20} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
