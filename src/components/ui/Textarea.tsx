import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
  rows?: number;
}

// Textarea con label, errores y texto de ayuda
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    label, 
    error, 
    help, 
    rows = 3,
    className = '',
    ...props 
  }, ref) => {
    const textareaClasses = [
      'w-full px-3 py-2 border rounded-lg shadow-sm transition-colors resize-none',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      error 
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
        : 'border-gray-300',
      props.disabled && 'bg-gray-100 cursor-not-allowed',
      className
    ].filter(Boolean).join(' ');

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          className={textareaClasses}
          rows={rows}
          {...props}
        />
        
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

Textarea.displayName = 'Textarea';

/*
Ejemplos de uso:

// Textarea básico con label
<Textarea 
  label="Descripción"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  placeholder="Ingresa una descripción..."
/>

// Textarea con error
<Textarea 
  label="Comentarios"
  value={comments}
  onChange={(e) => setComments(e.target.value)}
  error="Los comentarios son requeridos"
  placeholder="Escribe tus comentarios..."
/>

// Textarea con texto de ayuda
<Textarea 
  label="Notas"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  help="Máximo 500 caracteres"
  rows={4}
/>

// Textarea deshabilitado
<Textarea 
  label="Campo deshabilitado"
  value={value}
  disabled
  onChange={() => {}}
  rows={3}
/>
*/
