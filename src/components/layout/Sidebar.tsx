import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  User,
  Package,
  Wrench,
  UserCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  TrendingUp,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const menuItems = [
  { path: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'     },
  { path: '/finanzas',     icon: TrendingUp,      label: 'Finanzas'      },
  { path: '/perfil',       icon: UserCircle,      label: 'Perfil'        },
  { path: '/usuarios',     icon: Users,           label: 'Usuarios'      },
  { path: '/turnos',       icon: Calendar,        label: 'Turnos'        },
  { path: '/servicios',    icon: Wrench,          label: 'Servicios'     },
  { path: '/clientes',     icon: User,            label: 'Clientes'      },
  { path: '/productos',    icon: Package,         label: 'Productos'     },
  { path: '/test-component', icon: FlaskConical,   label: 'Test Lab'     },
];

// Contenido reutilizable en desktop y mobile
const SidebarContent = ({
  collapsed,
  onToggleCollapsed,
  isMobile = false,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile?: boolean;
}) => {
  const { state } = useAuth();
  const roles = state.authUser?.roles || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 border-b border-gray-700 h-16 flex-shrink-0">
        {(!collapsed || isMobile) && (
          <span className="text-sm font-semibold text-gray-200 truncate">Menú</span>
        )}
        {/* Botón colapsar solo en desktop */}
        {!isMobile && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto p-1.5 rounded-md hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map(({ path, icon: Icon, label }) => {
          // Ocultar usuarios si no es admin
          if (path === '/usuarios' && !roles.includes('admin')) {
            return null;
          }

          return (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                [
                  'flex items-center rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
                  collapsed && !isMobile ? 'justify-center' : 'gap-3',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                ].join(' ')
              }
              title={collapsed && !isMobile ? label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

const Sidebar = ({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) => {
  const location = useLocation();

  useEffect(() => {
    onCloseMobile();
  }, [location.pathname]);

  return (
    <>
      {/* ── DESKTOP ───────────────────────────────────────────────────
          Elemento estático en el flujo flex.
          Su ancho empuja al main. Solo visible en lg+.
      ──────────────────────────────────────────────────────────────── */}
      <aside
        className={[
          'hidden lg:flex flex-col flex-shrink-0',
          'bg-gray-800 text-white',
          'transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        ].join(' ')}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>

      {/* ── MOBILE ────────────────────────────────────────────────────
          Fixed sobre el contenido. Solo visible en <lg.
          Overlay oscuro + panel que entra desde la izquierda.
      ──────────────────────────────────────────────────────────────── */}

      {/* Overlay */}
      <div
        className={[
          'fixed inset-0 bg-black/50 z-40 lg:hidden',
          'transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onCloseMobile}
      />

      {/* Panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-60',
          'flex flex-col lg:hidden',
          'bg-gray-800 text-white',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent collapsed={false} onToggleCollapsed={onToggleCollapsed} isMobile />
      </aside>
    </>
  );
};

export default Sidebar;