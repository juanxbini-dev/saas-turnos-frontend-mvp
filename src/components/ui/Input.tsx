import React, { forwardRef, useId } from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  help?: string;
  prefix?: string | LucideIcon;
}

// Input de texto con label, errores y soporte para prefix.
// El label queda asociado al input (htmlFor/id): si no viene `id` por props se
// genera uno estable con useId, así los lectores de pantalla y getByLabelText
// lo encuentran sin que los usuarios del kit tengan que hacer nada.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    help, 
    prefix: Prefix, 
    className = '',
    id,
    ...props 
  }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasPrefix = !!Prefix;
    const isIconPrefix = typeof Prefix !== 'string';
    
    const inputClasses = [
      'w-full px-3 py-2 border rounded-lg shadow-sm transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      error 
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
        : 'border-gray-300',
      props.disabled && 'bg-gray-100 cursor-not-allowed',
      hasPrefix && (isIconPrefix ? 'pl-10' : 'pl-8'),
      className
    ].filter(Boolean).join(' ');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
          {hasPrefix && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              {isIconPrefix ? (
                <Prefix size={18} className="text-gray-400" />
              ) : (
                <span className="text-sm text-gray-500">{Prefix}</span>
              )}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            {...props}
          />
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        
        {help && !error && (
          <p className="mt-1 text-sm text-gray-500">
            {help}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/*
Ejemplos de uso:

// Input básico con label
<Input 
  label="Nombre completo"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Ingresa tu nombre"
/>

// Input con error
<Input 
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error="El email es inválido"
  placeholder="email@ejemplo.com"
/>

// Input con texto de ayuda
<Input 
  label="Contraseña"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  help="Mínimo 8 caracteres"
/>

// Input con prefix de texto
<Input 
  label="Teléfono"
  prefix="+54"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  placeholder="11 1234 5678"
/>

// Input con icono prefix
<Input 
  label="Buscar"
  prefix={SearchIcon}
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Buscar productos..."
/>

// Input deshabilitado
<Input 
  label="Campo deshabilitado"
  value={value}
  disabled
  onChange={() => {}}
/>
*/
