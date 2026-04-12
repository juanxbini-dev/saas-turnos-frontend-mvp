import React, { useState } from 'react';
import { Table, Button, Badge, Card, EmptyState, Pagination } from '../ui';
import { Cliente } from '../../types/cliente.types';
import { Edit, Trash2, Users, Search, Eye } from 'lucide-react';

interface ClientesCatalogoProps {
  clientes: Cliente[];
  loading: boolean;
  isAdmin: boolean;
  onVerPerfil: (cliente: Cliente) => void;
  onEditar: (cliente: Cliente) => void;
  onEliminar: (cliente: Cliente) => void;
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  busqueda: string;
  onPaginaChange: (p: number) => void;
  onBusquedaChange: (v: string) => void;
}

export const ClientesCatalogo: React.FC<ClientesCatalogoProps> = ({
  clientes,
  loading,
  isAdmin,
  onVerPerfil,
  onEditar,
  onEliminar,
  pagina,
  totalPaginas,
  total,
  porPagina,
  busqueda,
  onPaginaChange,
  onBusquedaChange
}) => {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const toggleActions = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedActions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedActions(next);
  };
  const columns: Array<any> = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (nombre: string, cliente: Cliente) => {
        return (
          <div className="font-medium text-gray-900">
            {nombre}
          </div>
        );
      }
    },
    {
      key: 'email',
      header: 'Email',
      render: (email: string, cliente: Cliente) => {
        return (
          <div className="text-sm text-gray-600">
            {email}
          </div>
        );
      }
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (telefono: string | null, cliente: Cliente) => {
        return (
          <div className="text-sm text-gray-600">
            {telefono || '—'}
          </div>
        );
      }
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (acciones: any, cliente: Cliente) => {
        return (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onVerPerfil(cliente)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Ver perfil
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEditar(cliente)}
            >
              <Edit className="w-3 h-3 mr-1" />
              Editar
            </Button>

            {isAdmin && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onEliminar(cliente)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  // Componente móvil - Cards
  const ClienteCard: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{cliente.nombre}</div>
            <div className="text-sm text-gray-500 truncate">{cliente.email}</div>
          </div>
          <Badge variant={cliente.activo ? 'green' : 'red'} size="sm">
            {cliente.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {cliente.telefono && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Teléfono:</span> {cliente.telefono}
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={(e) => toggleActions(cliente.id, e)}
            className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
          >
            Ver acciones
            <span className="text-xs">{expandedActions.has(cliente.id) ? '▲' : '▼'}</span>
          </button>

          {expandedActions.has(cliente.id) && (
            <div className="mt-2 flex flex-col gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onVerPerfil(cliente); }}
                className="text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 font-medium"
              >
                👁 Ver perfil
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditar(cliente); }}
                className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
              >
                ✎ Editar
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEliminar(cliente); }}
                  className="text-left text-sm py-1.5 font-medium text-red-500 hover:text-red-700"
                >
                  🗑 Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={busqueda}
          onChange={e => onBusquedaChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando clientes...</div>
        </div>
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          message={busqueda ? "No se encontraron clientes con ese criterio de búsqueda" : isAdmin ? "Creá tu primer cliente usando el botón 'Nuevo cliente'" : "No hay clientes disponibles"}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Table
              columns={columns}
              data={clientes}
              loading={loading}
              emptyMessage="No se encontraron clientes"
            />
          </div>

          {/* Mobile */}
          <div className="lg:hidden space-y-3">
            {clientes.map(cliente => (
              <ClienteCard key={cliente.id} cliente={cliente} />
            ))}
          </div>

          <Pagination
            page={pagina}
            totalPages={totalPaginas}
            total={total}
            limit={porPagina}
            onPageChange={onPaginaChange}
            className="mt-4"
          />
        </>
      )}
    </div>
  );
};
