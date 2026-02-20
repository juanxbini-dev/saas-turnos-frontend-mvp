import React, { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  flat?: boolean;
}

// Contenedor card con header opcional y variantes
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    title, 
    subtitle, 
    headerAction, 
    footer, 
    flat = false,
    children, 
    className = '',
    ...props 
  }, ref) => {
    const baseClasses = flat 
      ? 'bg-white rounded-lg' 
      : 'bg-white rounded-lg shadow-lg';
    
    const classes = [
      baseClasses,
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {/* Header */}
        {(title || subtitle || headerAction) && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h3 className="text-lg font-semibold text-gray-800">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-600 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              {headerAction && (
                <div className="ml-4">
                  {headerAction}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

/*
Ejemplos de uso:

// Card básica
<Card>
  <p>Este es el contenido de la card.</p>
</Card>

// Card con título y subtítulo
<Card 
  title="Estadísticas de ventas"
  subtitle="Últimos 30 días"
>
  <div className="space-y-4">
    <div className="flex justify-between">
      <span className="text-gray-600">Total ventas:</span>
      <span className="font-semibold">$45,230</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-600">Órdenes:</span>
      <span className="font-semibold">156</span>
    </div>
  </div>
</Card>

// Card con acción en el header
<Card 
  title="Usuarios"
  headerAction={
    <Button size="sm" variant="primary">
      Nuevo usuario
    </Button>
  }
>
  <p>Lista de usuarios del sistema</p>
</Card>

// Card con footer
<Card 
  title="Configuración"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="secondary">Cancelar</Button>
      <Button>Guardar cambios</Button>
    </div>
  }
>
  <form className="space-y-4">
    <Input label="Nombre de la empresa" value={name} onChange={setName} />
    <Input label="Email de contacto" type="email" value={email} onChange={setEmail} />
  </form>
</Card>

// Card plana (sin shadow) para usar dentro de otras cards
<Card flat className="border border-gray-200">
  <h4 className="font-medium text-gray-800 mb-2">Subtítulo</h4>
  <p className="text-sm text-gray-600">Contenido anidado</p>
</Card>

// Card con className personalizado
<Card className="max-w-md mx-auto">
  <h3 className="text-xl font-bold text-center mb-4">Bienvenido</h3>
  <p className="text-center text-gray-600">Contenido centrado</p>
</Card>

// Card combinada con otras cards
<Card title="Dashboard">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card flat>
      <h4 className="font-medium text-gray-800">Métrica 1</h4>
      <p className="text-2xl font-bold text-blue-600">123</p>
    </Card>
    <Card flat>
      <h4 className="font-medium text-gray-800">Métrica 2</h4>
      <p className="text-2xl font-bold text-green-600">456</p>
    </Card>
  </div>
</Card>
*/
