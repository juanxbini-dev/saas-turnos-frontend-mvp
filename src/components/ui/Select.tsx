import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'prefix'> {
  label?: string;
  error?: string;
  help?: string;
  options: SelectOption[];
  prefix?: string | LucideIcon;
}

// Select con estilo consistente al Input y opciones dinámicas
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    label, 
    error, 
    help, 
    options, 
    prefix: Prefix, 
    className = '',
    ...props 
  }, ref) => {
    const hasPrefix = !!Prefix;
    const isIconPrefix = typeof Prefix !== 'string';
    
    const selectClasses = [
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          
          <select
            ref={ref}
            className={selectClasses}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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

Select.displayName = 'Select';

/*
Ejemplos de uso:

// Select básico con label
<Select 
  label="Categoría"
  options={[
    { value: 'electronics', label: 'Electrónica' },
    { value: 'clothing', label: 'Ropa' },
    { value: 'food', label: 'Alimentos' }
  ]}
  value={category}
  onChange={(e) => setCategory(e.target.value)}
/>

// Select con error
<Select 
  label="País"
  options={countryOptions}
  value={country}
  onChange={(e) => setCountry(e.target.value)}
  error="Debes seleccionar un país"
/>

// Select con texto de ayuda
<Select 
  label="Prioridad"
  options={[
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' }
  ]}
  value={priority}
  onChange={(e) => setPriority(e.target.value)}
  help="Selecciona la prioridad de la tarea"
/>

// Select con icono prefix
<Select 
  label="Moneda"
  prefix={DollarSignIcon}
  options={[
    { value: 'usd', label: 'USD - Dólar Americano' },
    { value: 'eur', label: 'EUR - Euro' },
    { value: 'ars', label: 'ARS - Peso Argentino' }
  ]}
  value={currency}
  onChange={(e) => setCurrency(e.target.value)}
/>

// Select deshabilitado
<Select 
  label="Campo deshabilitado"
  options={options}
  value={value}
  disabled
  onChange={() => {}}
/>
*/
