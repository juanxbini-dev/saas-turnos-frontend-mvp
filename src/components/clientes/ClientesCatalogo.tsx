import React from 'react';
import { Table, Button, Badge, Card } from '../ui';
import { Cliente } from '../../types/cliente.types';
import { Edit, Power } from 'lucide-react';

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

  // Componente móvil - Cards expandibles
  const ClienteCard: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
    const [expandido, setExpandido] = React.useState(false);

    return (
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{cliente.nombre}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {cliente.email}
              </p>
            </div>
            <Badge
              variant={cliente.activo ? 'green' : 'red'}
              size="sm"
            >
              {cliente.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          <div className="text-sm text-gray-600 mb-3">
            <div>
              <span className="font-medium">Teléfono:</span> {cliente.telefono || '—'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandido(!expandido)}
            >
              {expandido ? 'Ocultar' : 'Ver'} acciones
            </Button>

            {expandido && (
              <div className="flex items-center space-x-2 mt-3">
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
            )}
          </div>
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

  if (clientes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          No hay clientes disponibles
        </div>
        {isAdmin && (
          <div className="text-sm text-gray-400">
            Crea tu primer cliente usando el botón "Nuevo cliente"
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Tabla para desktop */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={clientes}
          loading={loading}
        />
      </div>

      {/* Cards para mobile */}
      <div className="block lg:hidden">
        {clientes.map((cliente) => (
          <ClienteCard key={cliente.id} cliente={cliente} />
        ))}
      </div>
    </>
  );
};
