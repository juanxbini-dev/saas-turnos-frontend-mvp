import React, { useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoutButton } from '../ui/LogoutButton';

interface NavbarProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const Navbar = ({ mobileMenuOpen, onToggleMobileMenu }: NavbarProps) => {
  const { state } = useAuth();

  useEffect(() => {
    console.log('🔝 [Navbar] Estado autenticación:', state.status);
    console.log('👤 [Navbar] Usuario:', state.authUser?.email || 'No autenticado');
    console.log('📱 [Navbar] Estado mobile menu:', mobileMenuOpen);
  }, [state.status, state.authUser, mobileMenuOpen]);

  return (
    <nav className="h-16 bg-gray-900 text-white flex items-center px-6 justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="text-xl font-bold">
          Turnos System
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-sm">
          {state.status === 'authenticated' ? (
            <span className="text-gray-300">
              {state.authUser?.email || 'Usuario'}
            </span>
          ) : (
            <span className="text-gray-400">Invitado</span>
          )}
        </div>
        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium">
            {state.authUser?.email?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        {state.status === 'authenticated' && (
          <LogoutButton variant="header" className="ml-2" />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
