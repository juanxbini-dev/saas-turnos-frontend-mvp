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
      key: 'usuario',
      header: 'Usuario',
      render: (usuario: Usuario) => {
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
      key: 'rol',
      header: 'Rol',
      render: (usuario: Usuario) => {
        if (!usuario || !usuario.roles) return null;
        return (
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
        );
      }
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (usuario: Usuario) => {
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
      key: 'ultimo_login',
      header: 'Último Login',
      render: (usuario: Usuario) => {
        if (!usuario) return null;
        return (
          <span className="text-sm text-gray-600">
            {usuario.last_login
              ? new Date(usuario.last_login).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })
              : 'Nunca'
            }
          </span>
        );
      }
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (usuario: Usuario) => {
        if (!usuario) return null;
        return (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(usuario)}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
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
    <div className="hidden lg:block">
      <Table
        columns={columns}
        data={usuarios}
        loading={loading}
        emptyMessage="No hay usuarios para mostrar"
        className="mt-4"
      />
    </div>
  );
};
