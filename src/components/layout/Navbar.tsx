import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoutButton } from '../ui/LogoutButton';

interface NavbarProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

const Navbar = ({ mobileOpen, onToggleMobile }: NavbarProps) => {
  const { state } = useAuth();

  const userInitial = state.authUser?.email?.charAt(0).toUpperCase() ?? 'U';
  const userEmail   = state.authUser?.email ?? 'Invitado';

  return (
    <nav className="h-16 bg-gray-900 text-white flex items-center px-4 lg:px-6 justify-between flex-shrink-0 z-30">

      {/* Izquierda: botón mobile + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="text-lg font-bold tracking-tight">Turnos System</span>
      </div>

      {/* Derecha: info usuario + logout */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-sm text-gray-400 truncate max-w-[180px]">
          {userEmail}
        </span>

        {/* Avatar inicial */}
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold">{userInitial}</span>
        </div>

        {state.status === 'authenticated' && (
          <LogoutButton variant="header" />
        )}
      </div>

    </nav>
  );
};

export default Navbar;