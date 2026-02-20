import React, { forwardRef } from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'away';
}

// Avatar que muestra iniciales o imagen, con indicador de estado opcional
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ 
    src, 
    alt = '', 
    name, 
    size = 'md', 
    status,
    className = '',
    ...props 
  }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base'
    };

    const statusSizeClasses = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3'
    };

    const statusPositionClasses = {
      sm: '-bottom-0 -right-0',
      md: '-bottom-0.5 -right-0.5',
      lg: '-bottom-0.5 -right-0.5'
    };

    const statusColors = {
      online: 'bg-green-400',
      offline: 'bg-gray-400',
      away: 'bg-yellow-400'
    };

    // Generar iniciales desde el nombre
    const getInitials = (name?: string) => {
      if (!name) return '';
      
      const parts = name.trim().split(' ');
      if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
      }
      
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(name);

    return (
      <div 
        ref={ref}
        className={`relative inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-medium ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              // Si la imagen falla, mostrar iniciales
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="truncate">
            {initials}
          </span>
        )}
        
        {/* Indicador de estado */}
        {status && (
          <span
            className={`absolute ${statusPositionClasses[size]} ${statusSizeClasses[size]} ${statusColors[status]} rounded-full border-2 border-white`}
            aria-label={`Estado: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/*
Ejemplos de uso:

// Avatar básico con iniciales
<Avatar name="Juan Pérez" />

// Avatar con imagen
<Avatar 
  src="https://ejemplo.com/avatar.jpg"
  alt="Juan Pérez"
  name="Juan Pérez"
/>

// Avatar con diferentes tamaños
<Avatar name="Usuario" size="sm" />
<Avatar name="Usuario" size="md" />
<Avatar name="Usuario" size="lg" />

// Avatar con indicador de estado
<Avatar 
  name="María García" 
  status="online" 
/>
<Avatar 
  name="Carlos López" 
  status="offline" 
/>
<Avatar 
  name="Ana Martínez" 
  status="away" 
/>

// Avatar en tabla de usuarios
<Table
  columns={[
    {
      key: 'user',
      header: 'Usuario',
      render: (_, item) => (
        <div className="flex items-center gap-3">
          <Avatar 
            name={item.name} 
            src={item.avatar}
            size="sm"
            status={item.status}
          />
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-500">{item.email}</div>
          </div>
        </div>
      )
    }
  ]}
  data={users}
/>

// Avatar en cards
<Card title="Perfil">
  <div className="flex items-center gap-4">
    <Avatar 
      name="Usuario Actual" 
      src={user.avatar}
      size="lg"
      status="online"
    />
    <div>
      <h3 className="font-semibold text-gray-800">Juan Pérez</h3>
      <p className="text-sm text-gray-600">juan@ejemplo.com</p>
      <Badge variant="green" size="sm" className="mt-1">
        Administrador
      </Badge>
    </div>
  </div>
</Card>

// Avatar en sidebar de chat
<div className="space-y-2">
  {chatUsers.map(user => (
    <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100">
      <Avatar 
        name={user.name} 
        src={user.avatar}
        size="sm"
        status={user.status}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-gray-500 truncate">{user.lastMessage}</p>
      </div>
    </div>
  ))}
</div>

// Avatar con fallback automático
<Avatar 
  name="Usuario sin imagen"
  // Si src falla, mostrará "US"
  src="https://url-invalida.com/image.jpg"
/>

// Avatar personalizado con className
<Avatar 
  name="Usuario Especial"
  className="ring-2 ring-blue-500 ring-offset-2"
  status="online"
/>
*/
