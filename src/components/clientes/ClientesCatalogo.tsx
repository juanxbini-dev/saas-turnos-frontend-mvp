import React, { useState } from 'react';
import { Table, Button, Badge, Card, DataControls, EmptyState } from '../ui';
import { Cliente } from '../../types/cliente.types';
import { Edit, Power, Users } from 'lucide-react';

interface ClientesCatalogoProps {
  clientes: Cliente[];
  loading: boolean;
  isAdmin: boolean;
  onEditar: (cliente: Cliente) => void;
  onToggleActivo: (cliente: Cliente) => void;
}

export const ClientesCatalogo: React.FC<ClientesCatalogoProps> = ({
  clientes,
  loading,
  isAdmin,
  onEditar,
  onToggleActivo
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
      key: 'activo',
      header: 'Estado',
      render: (activo: boolean, cliente: Cliente) => {
        return (
          <Badge
            variant={activo ? 'green' : 'red'}
            size="sm"
          >
            {activo ? 'Activo' : 'Inactivo'}
          </Badge>
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
              variant="secondary"
              onClick={() => onEditar(cliente)}
            >
              <Edit className="w-3 h-3 mr-1" />
              Editar
            </Button>

            {isAdmin && (
              <Button
                size="sm"
                variant={cliente.activo ? 'danger' : 'primary'}
                onClick={() => onToggleActivo(cliente)}
              >
                <Power className="w-3 h-3 mr-1" />
                {cliente.activo ? 'Desactivar' : 'Activar'}
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
                onClick={(e) => { e.stopPropagation(); onEditar(cliente); }}
                className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
              >
                ✎ Editar
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleActivo(cliente); }}
                  className={`text-left text-sm py-1.5 font-medium ${
                    cliente.activo
                      ? 'text-red-500 hover:text-red-700'
                      : 'text-green-600 hover:text-green-800'
                  }`}
                >
                  {cliente.activo ? '✕ Desactivar' : '✓ Activar'}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Cargando clientes...</div>
      </div>
    );
  }

  // Estado vacío inicial sin datos
  if (clientes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No hay clientes"
        message={isAdmin ? "Creá tu primer cliente usando el botón 'Nuevo cliente'" : "No hay clientes disponibles"}
      />
    );
  }

  return (
    <DataControls
      data={clientes}
      searchFields={['nombre', 'email', 'telefono']}
      sortOptions={[
        { value: 'nombre', label: 'Nombre' },
        { value: 'email', label: 'Email' },
        { value: 'created_at', label: 'Fecha de creación' },
        { value: 'activo', label: 'Estado' },
      ]}
      defaultSort="nombre"
      pageSize={10}
    >
      {(filteredData) => (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Table 
              columns={columns} 
              data={filteredData} 
              loading={loading}
              emptyMessage="No se encontraron clientes con los filtros aplicados"
            />
          </div>

          {/* Mobile */}
          <div className="lg:hidden space-y-3">
            {filteredData.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No hay clientes"
                message="No se encontraron clientes con los filtros aplicados"
              />
            ) : (
              filteredData.map(cliente => (
                <ClienteCard key={cliente.id} cliente={cliente} />
              ))
            )}
          </div>
        </>
      )}
    </DataControls>
  );
};
