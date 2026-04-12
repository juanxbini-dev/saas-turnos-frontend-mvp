import React from 'react';
import { Table, Button, Badge, Avatar } from '../ui';
import { Trash2 } from 'lucide-react';
import { Usuario } from '../../types/usuario.types';

interface UsuariosTablaProps {
  usuarios: Usuario[];
  loading: boolean;
  onEdit: (usuario: Usuario) => void;
  onCambiarRol: (usuario: Usuario) => void;
  onEliminar: (usuario: Usuario) => void;
}

export const UsuariosTabla: React.FC<UsuariosTablaProps> = ({
  usuarios,
  loading,
  onEdit,
  onCambiarRol,
  onEliminar
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
              src={usuario.avatar_url ?? undefined}
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
            {usuario.roles.includes('super_admin') ? (
              <Badge variant="yellow" size="sm">★ Super Admin</Badge>
            ) : usuario.roles.includes('admin') ? (
              <Badge variant="blue" size="sm">Admin</Badge>
            ) : (
              <Badge variant="gray" size="sm">Staff</Badge>
            )}
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
              variant="danger"
              size="sm"
              onClick={() => onEliminar(usuario)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Eliminar
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
