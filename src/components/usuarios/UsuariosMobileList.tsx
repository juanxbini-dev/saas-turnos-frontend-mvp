import React, { useState } from 'react';
import { Card, Badge, Avatar } from '../ui';
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
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const toggleActions = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedActions);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedActions(next);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
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

  if (usuarios.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-gray-500">No hay usuarios para mostrar</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {usuarios.map((usuario) => (
        <Card key={usuario.id} className="p-4">
          {/* Cabecera: avatar + info + badges en columna */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={usuario.nombre} size="sm" className="flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{usuario.nombre}</div>
                <div className="text-sm text-gray-500">@{usuario.username}</div>
              </div>
            </div>

            {/* Badges en columna */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {usuario.roles.map((rol) => (
                <Badge key={rol} variant={rol === 'admin' ? 'blue' : 'gray'} size="sm">
                  {rol === 'admin' ? 'Admin' : 'Staff'}
                </Badge>
              ))}
              <Badge variant={usuario.activo ? 'green' : 'red'} size="sm">
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>

          {/* Último login */}
          <div className="mt-2 text-xs text-gray-500">
            Último login:{' '}
            {usuario.last_login
              ? new Date(usuario.last_login).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                })
              : 'Nunca'}
          </div>

          {/* Ver acciones */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={(e) => toggleActions(usuario.id, e)}
              className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
            >
              Ver acciones
              <span className="text-xs">{expandedActions.has(usuario.id) ? '▲' : '▼'}</span>
            </button>

            {expandedActions.has(usuario.id) && (
              <div className="mt-2 flex flex-col gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(usuario); }}
                  className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
                >
                  ✎ Editar datos
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCambiarRol(usuario); }}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 font-medium"
                >
                  ⇄ Cambiar rol
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleActivo(usuario); }}
                  className={`text-left text-sm py-1.5 font-medium ${
                    usuario.activo
                      ? 'text-red-500 hover:text-red-700'
                      : 'text-green-600 hover:text-green-800'
                  }`}
                >
                  {usuario.activo ? '✕ Desactivar cuenta' : '✓ Activar cuenta'}
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
