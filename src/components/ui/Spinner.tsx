import React, { forwardRef } from 'react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'white' | 'gray';
  overlay?: boolean;
}

// Spinner de carga circular animado con variantes de tamaño y color
export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ 
    size = 'md', 
    color = 'blue', 
    overlay = false,
    className = '',
    ...props 
  }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    };
    
    const colorClasses = {
      blue: 'text-blue-600',
      white: 'text-white',
      gray: 'text-gray-500'
    };

    const spinner = (
      <svg
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    if (overlay) {
      return (
        <div 
          ref={ref}
          className={`flex items-center justify-center bg-white/80 backdrop-blur-sm ${className}`}
          {...props}
        >
          {spinner}
        </div>
      );
    }

    return (
      <div ref={ref} className={className} {...props}>
        {spinner}
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

/*
Ejemplos de uso:

// Spinner básico
<Spinner />

// Spinner pequeño
<Spinner size="sm" />

// Spinner grande
<Spinner size="lg" />

// Spinner de diferentes colores
<Spinner color="blue" />
<Spinner color="white" />
<Spinner color="gray" />

// Spinner como overlay (centrado sobre contenedor)
<div className="relative h-64">
  <div className="absolute inset-0">
    <Spinner overlay size="lg" />
  </div>
  <div className="opacity-50">
    Contenido de fondo...
  </div>
</div>

// Spinner en botones
<Button loading>
  <Spinner size="sm" color="white" className="mr-2" />
  Procesando...
</Button>

// Spinner en tablas
<Table
  columns={columns}
  data={[]}
  loading={true}
  emptyMessage="Cargando datos..."
/>

// Spinner centrado en cards
<Card>
  <div className="flex justify-center py-8">
    <Spinner size="lg" />
  </div>
</Card>

// Spinner con className personalizado
<Spinner 
  className="mx-auto" 
  size="md" 
  color="blue" 
/>

// Spinner en formularios
<form>
  <Input label="Campo 1" value={value1} onChange={setValue1} />
  <Input label="Campo 2" value={value2} onChange={setValue2} />
  
  {isSubmitting && (
    <div className="flex justify-center py-4">
      <Spinner color="blue" />
    </div>
  )}
  
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? (
      <>
        <Spinner size="sm" color="white" className="mr-2" />
        Enviando...
      </>
    ) : (
      'Enviar'
    )}
  </Button>
</form>

// Spinner como indicador de carga global
{isLoading && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Spinner size="lg" color="white" />
  </div>
)}
*/
