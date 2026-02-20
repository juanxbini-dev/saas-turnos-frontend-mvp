import React, { useState } from 'react';
import { Card, Button, Badge, Avatar } from '../ui';
import { Usuario } from '../../types/usuario.types';

interface UsuariosMobileListProps {
  usuarios: Usuario[];
  loading: boolean;
  onEdit: (usuario: Usuario) => void;
  onCambiarRol: (usuario: Usuario) => void;
  onToggleActivo: (usuario: Usuario) => void;
}

export const UsuariosMobileList: React.FC<UsuariosMobileListProps> = ({
  usuarios,
  loading,
  onEdit,
  onCambiarRol,
  onToggleActivo
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  if (loading) {
    return (
      <div className="block lg:hidden space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="p-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/4"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="block lg:hidden space-y-4">
      {usuarios.map((usuario) => (
        <Card
          key={usuario.id}
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => toggleExpanded(usuario.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar
                name={usuario.nombre}
                size="sm"
                className="flex-shrink-0"
              />
              <div>
                <div className="font-medium text-gray-900">{usuario.nombre}</div>
                <div className="text-sm text-gray-500">@{usuario.username}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {usuario.roles.map((rol) => (
                  <Badge
                    key={rol}
                    variant={rol === 'admin' ? 'blue' : 'gray'}
                    size="sm"
                  >
                    {rol === 'admin' ? 'Admin' : 'Staff'}
                  </Badge>
                ))}
              </div>
              <Badge
                variant={usuario.activo ? 'green' : 'red'}
                size="sm"
              >
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Último login: {usuario.last_login
              ? new Date(usuario.last_login).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })
              : 'Nunca'
            }
          </div>

          {expandedId === usuario.id && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleAction(e, () => onEdit(usuario))}
                  className="justify-start"
                >
                  Editar datos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleAction(e, () => onCambiarRol(usuario))}
                  className="justify-start"
                >
                  Cambiar rol
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleAction(e, () => onToggleActivo(usuario))}
                  className={`justify-start ${
                    usuario.activo ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  {usuario.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {usuarios.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-gray-500">No hay usuarios para mostrar</div>
        </Card>
      )}
    </div>
  );
};
