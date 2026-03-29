import React from 'react';
import { Table, Button, Badge, Avatar } from '../ui';
import { Usuario } from '../../types/usuario.types';

interface UsuariosTablaProps {
  usuarios: Usuario[];
  loading: boolean;
  onEdit: (usuario: Usuario) => void;
  onCambiarRol: (usuario: Usuario) => void;
  onToggleActivo: (usuario: Usuario) => void;
}

export const UsuariosTabla: React.FC<UsuariosTablaProps> = ({
  usuarios,
  loading,
  onEdit,
  onCambiarRol,
  onToggleActivo
}) => {
  const columns: Array<any> = [
    {
      key: 'nombre',
      header: 'Usuario',
      render: (nombre: string, usuario: Usuario) => {
        if (!usuario) return null;
        return (
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
        );
      }
    },
    {
      key: 'roles',
      header: 'Rol',
      render: (roles: string[], usuario: Usuario) => {
        if (!usuario || !usuario.roles) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {usuario.roles.includes('super_admin') && (
              <Badge key="super_admin" variant="yellow" size="sm">
                ★ Super Admin
              </Badge>
            )}
            {usuario.roles.filter(r => r !== 'super_admin').map((rol) => (
              <Badge
                key={rol}
                variant={rol === 'admin' ? 'blue' : 'gray'}
                size="sm"
              >
                {rol}
              </Badge>
            ))}
          </div>
        );
      }
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (activo: boolean, usuario: Usuario) => {
        if (!usuario) return null;
        return (
          <Badge
            variant={usuario.activo ? 'green' : 'red'}
            size="sm"
          >
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        );
      }
    },
    {
      key: 'last_login',
      header: 'Último Login',
      render: (last_login: string, usuario: Usuario) => {
        if (!usuario) return null;
        return (
          <span className="text-sm text-gray-500">
            {usuario.last_login 
              ? new Date(usuario.last_login).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Nunca'
            }
          </span>
        );
      }
    },
    {
      key: 'id',
      header: 'Acciones',
      render: (id: string, usuario: Usuario) => {
        if (!usuario) return null;
        return (
          <div className="flex space-x-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onEdit(usuario)}
            >
              Editar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCambiarRol(usuario)}
            >
              Rol
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleActivo(usuario)}
              className={usuario.activo ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
            >
              {usuario.activo ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <Table
      columns={columns}
      data={usuarios}
      loading={loading}
      emptyMessage="No hay usuarios para mostrar"
      className="mt-4"
    />
  );
};
