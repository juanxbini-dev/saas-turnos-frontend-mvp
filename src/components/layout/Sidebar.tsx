import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { productosService } from '../../services/productos.service';
import { useContadorParaRevisar } from '../../hooks/useContadorParaRevisar';
import { useContadorParaContactar } from '../../hooks/useContadorParaContactar';
import { puedeVerParaContactar } from '../../services/avisos.service';
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
  TrendingUp,
  BarChart3,
  Wallet,
  Megaphone,
  Ticket,
  X,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

// superAdminOnly: solo visible para super_admin (el rol 'admin' no alcanza)
// "Para contactar" no es ítem: es una pestaña de Productos; su contador se muestra en ese ítem.
const menuItems = [
  { path: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',     adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/finanzas',       icon: TrendingUp,      label: 'Finanzas',      adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/metricas',       icon: BarChart3,       label: 'Métricas',      adminOnly: true,  hideSuperAdmin: false, superAdminOnly: false },
  { path: '/gastos',         icon: Wallet,          label: 'Gastos',        adminOnly: true,  hideSuperAdmin: false, superAdminOnly: true  },
  { path: '/campanias',      icon: Megaphone,       label: 'Campañas',      adminOnly: true,  hideSuperAdmin: false, superAdminOnly: true  },
  { path: '/beneficios',     icon: Ticket,          label: 'Beneficios',    adminOnly: true,  hideSuperAdmin: false, superAdminOnly: false },
  { path: '/perfil',         icon: UserCircle,      label: 'Perfil',        adminOnly: false, hideSuperAdmin: true,  superAdminOnly: false },
  { path: '/usuarios',       icon: Users,           label: 'Usuarios',      adminOnly: true,  hideSuperAdmin: false, superAdminOnly: false },
  { path: '/turnos',         icon: Calendar,        label: 'Turnos',        adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/servicios',      icon: Wrench,          label: 'Servicios',     adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/clientes',       icon: User,            label: 'Clientes',      adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/productos',      icon: Package,         label: 'Productos',     adminOnly: false, hideSuperAdmin: false, superAdminOnly: false },
  { path: '/configuracion',  icon: Settings,        label: 'Configuracion', adminOnly: true,  hideSuperAdmin: false, superAdminOnly: false },
];

// Contenido reutilizable en desktop y mobile
const SidebarContent = ({
  collapsed,
  onToggleCollapsed,
  isMobile = false,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}) => {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const roles = state.authUser?.roles || [];

  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isSuperAdminUser = roles.includes('super_admin');

  // Puntuaciones Regular/Malo sin revisar: aviso en "Métricas", solo super admin
  const { pendientes: puntuacionesPendientes } = useContadorParaRevisar(isSuperAdminUser);

  // Clientes que esperan que les escriban: aviso en "Productos" (ahí vive la pestaña "Para contactar").
  // Solo se pide si el rol la ve: a un profesional el backend le responde 403.
  const veParaContactar = puedeVerParaContactar(roles);
  const { pendientes: avisosPendientes } = useContadorParaContactar(veParaContactar);

  const { data: productosStats } = useFetch(
    isAdmin ? 'productos:stats:sidebar' : null,
    () => productosService.getStats(),
    { ttl: 120 }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 border-b border-gray-700 h-16 flex-shrink-0">
        {(!collapsed || isMobile) && (
          <span className="text-sm font-semibold text-gray-200 truncate">Menú</span>
        )}
        {/* Botón colapsar en desktop / cerrar en mobile */}
        {isMobile ? (
          <button
            onClick={onCloseMobile}
            className="ml-auto p-1.5 rounded-md hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        ) : (
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
        {menuItems.map(({ path, icon: Icon, label, adminOnly, hideSuperAdmin, superAdminOnly }) => {
          const isSuperAdmin = roles.includes('super_admin');
          if (superAdminOnly && !isSuperAdmin) return null;
          if (adminOnly && !roles.includes('admin') && !isSuperAdmin) return null;
          if (hideSuperAdmin && isSuperAdmin) return null;

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
              title={collapsed && !isMobile
                ? (path === '/metricas' && puntuacionesPendientes > 0
                  ? `${label} (${puntuacionesPendientes} para revisar)`
                  : path === '/productos' && avisosPendientes > 0
                    ? `${label} (${avisosPendientes} para contactar)`
                    : label)
                : undefined}
            >
              <span className="relative flex-shrink-0">
                <Icon size={20} />
                {collapsed && !isMobile && path === '/metricas' && puntuacionesPendientes > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" aria-hidden="true" />
                )}
                {collapsed && !isMobile && path === '/productos' && avisosPendientes > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" aria-hidden="true" />
                )}
              </span>
              {(!collapsed || isMobile) && <span className="truncate flex-1">{label}</span>}
              {/* Dos avisos en Productos: bajo stock (ámbar, solo admin) y "Para contactar" (rojo) */}
              {(!collapsed || isMobile) && path === '/productos' && isAdmin && (productosStats?.bajo_stock_count ?? 0) > 0 && (
                <span
                  className="bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                  title={`${productosStats!.bajo_stock_count} con bajo stock`}
                >
                  {productosStats!.bajo_stock_count}
                </span>
              )}
              {(!collapsed || isMobile) && path === '/metricas' && puntuacionesPendientes > 0 && (
                <span
                  className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shrink-0"
                  title={`${puntuacionesPendientes} puntuaciones para revisar`}
                  data-testid="badge-puntuaciones"
                >
                  {puntuacionesPendientes > 99 ? '99+' : puntuacionesPendientes}
                </span>
              )}
              {(!collapsed || isMobile) && path === '/productos' && avisosPendientes > 0 && (
                <span
                  className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shrink-0"
                  title={`${avisosPendientes} ${avisosPendientes === 1 ? 'cliente espera' : 'clientes esperan'} que le escriban`}
                  data-testid="badge-para-contactar"
                >
                  {avisosPendientes > 99 ? '99+' : avisosPendientes}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-2 py-3 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={async () => { await logout(); navigate('/'); }}
          className={[
            'flex items-center w-full rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
            'text-gray-400 hover:bg-red-600 hover:text-white',
            collapsed && !isMobile ? 'justify-center' : 'gap-3',
          ].join(' ')}
          title={collapsed && !isMobile ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {(!collapsed || isMobile) && <span>Cerrar sesión</span>}
        </button>
      </div>
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
        <SidebarContent collapsed={false} onToggleCollapsed={onToggleCollapsed} isMobile onCloseMobile={onCloseMobile} />
      </aside>
    </>
  );
};

export default Sidebar;