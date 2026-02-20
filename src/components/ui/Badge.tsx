import React, { forwardRef } from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
  size?: 'sm' | 'md';
  dot?: boolean;
}

// Badge inline con variantes de color y opcional dot indicator
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    variant = 'blue', 
    size = 'md', 
    dot = false,
    children, 
    className = '',
    ...props 
  }, ref) => {
    const variantClasses = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    
    const dotClasses = {
      blue: 'bg-blue-400',
      green: 'bg-green-400',
      red: 'bg-red-400',
      yellow: 'bg-yellow-400',
      gray: 'bg-gray-400'
    };
    
    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm'
    };

    const dotSize = {
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2'
    };

    const classes = [
      'inline-flex items-center font-medium rounded-full',
      variantClasses[variant],
      sizeClasses[size],
      className
    ].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={classes} {...props}>
        {dot && (
          <span 
            className={`mr-1.5 rounded-full ${dotClasses[variant]} ${dotSize[size]}`}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/*
Ejemplos de uso:

// Badge básico
<Badge variant="blue">Nuevo</Badge>
<Badge variant="green">Activo</Badge>
<Badge variant="red">Error</Badge>
<Badge variant="yellow">Pendiente</Badge>
<Badge variant="gray">Inactivo</Badge>

// Badge con dot indicator
<Badge variant="green" dot>En línea</Badge>
<Badge variant="red" dot>Desconectado</Badge>
<Badge variant="yellow" dot>Ausente</Badge>

// Badge pequeño
<Badge variant="blue" size="sm">Mini</Badge>
<Badge variant="green" size="sm" dot>Activo</Badge>

// Badge en tablas
<Table
  columns={[
    { key: 'name', header: 'Nombre' },
    { 
      key: 'status', 
      header: 'Estado',
      render: (status) => (
        <Badge 
          variant={status === 'active' ? 'green' : 'red'}
          size="sm"
        >
          {status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ]}
  data={data}
/>

// Badge en cards
<Card title="Usuario">
  <div className="flex items-center justify-between">
    <span>Estado de la cuenta</span>
    <Badge variant="green" dot>Verificada</Badge>
  </div>
</Card>

// Badge personalizado con className
<Badge 
  variant="blue" 
  className="uppercase tracking-wide"
>
  Premium
</Badge>

// Badge combinado con iconos
<div className="flex items-center gap-2">
  <MailIcon size={16} className="text-gray-500" />
  <Badge variant="gray" size="sm">3 nuevos</Badge>
</div>

// Badge para notificaciones
<div className="relative">
  <BellIcon size={20} />
  <Badge 
    variant="red" 
    size="sm" 
    className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center p-0"
  >
    5
  </Badge>
</div>
*/
