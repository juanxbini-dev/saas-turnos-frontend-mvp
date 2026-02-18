import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface LogoutButtonProps {
  className?: string;
  variant?: 'default' | 'header' | 'sidebar';
}

export function LogoutButton({ 
  className = '', 
  variant = 'default' 
}: LogoutButtonProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, redirect to welcome page
      navigate('/');
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'header':
        return 'w-auto bg-red-600 hover:bg-red-700 text-sm px-4 py-2';
      case 'sidebar':
        return 'w-full bg-red-600 hover:bg-red-700 text-left justify-start';
      default:
        return 'w-full bg-red-600 hover:bg-red-700';
    }
  };

  return (
    <Button
      onClick={handleLogout}
      className={`${getVariantStyles()} ${className}`}
    >
      Cerrar Sesión
    </Button>
  );
}
