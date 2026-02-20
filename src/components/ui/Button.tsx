import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  block?: boolean;
}

// Botón con variantes y estados consistentes con el diseño del sistema
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    leftIcon: LeftIcon, 
    rightIcon: RightIcon, 
    block = false,
    disabled,
    className = '',
    ...props 
  }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
      secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
      ghost: 'text-gray-700 hover:bg-gray-100 disabled:text-gray-400'
    };
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };
    
    const iconSize = {
      sm: 16,
      md: 18,
      lg: 20
    };

    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      block && 'w-full',
      (disabled || loading) && 'cursor-not-allowed',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading && (
          <svg 
            className={`animate-spin -ml-1 mr-2 h-${size === 'sm' ? '4' : size === 'lg' ? '6' : '5'} w-${size === 'sm' ? '4' : size === 'lg' ? '6' : '5'}`} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        
        {!loading && LeftIcon && <LeftIcon size={iconSize[size]} className="mr-2" />}
        {children}
        {!loading && RightIcon && <RightIcon size={iconSize[size]} className="ml-2" />}
      </button>
    );
  }
);

Button.displayName = 'Button';

/*
Ejemplos de uso:

// Botón primario por defecto
<Button onClick={handleClick}>Guardar</Button>

// Botón con icono y estado de carga
<Button loading={isLoading} leftIcon={SaveIcon}>
  Guardando...
</Button>

// Botón secundario pequeño
<Button variant="secondary" size="sm">
  Cancelar
</Button>

// Botón de peligro
<Button variant="danger" rightIcon={TrashIcon}>
  Eliminar
</Button>

// Botón fantasma (sin fondo)
<Button variant="ghost" leftIcon={EditIcon}>
  Editar
</Button>

// Botón de ancho completo
<Button block>
  Enviar formulario
</Button>
*/
