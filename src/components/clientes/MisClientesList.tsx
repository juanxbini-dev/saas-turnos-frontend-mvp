import React from 'react';
import { useFetch } from '../../hooks/useFetch';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
import { clienteService } from '../../services/cliente.service';
import { Cliente } from '../../types/cliente.types';
import { Table, Badge, Card, DataControls, EmptyState } from '../ui';
import { Users } from 'lucide-react';

interface MisClientesListProps {
  usuarioId?: string;
}

export function MisClientesList({ usuarioId }: MisClientesListProps = {}) {
  const cacheKey = usuarioId
    ? buildKey(ENTITIES.MIS_CLIENTES, usuarioId)
    : buildKey(ENTITIES.MIS_CLIENTES);

  const {
    data: clientes,
    loading,
    error
  } = useFetch(
    cacheKey,
    () => clienteService.getMisClientes(usuarioId),
    { ttl: 300 }
  );

  const columns: Array<any> = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (nombre: string, cliente: Cliente) => (
        <div className="font-medium text-gray-900">
          {nombre}
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      render: (email: string, cliente: Cliente) => (
        <div className="text-sm text-gray-600">
          {email || 'Sin email'}
        </div>
      )
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (telefono: string, cliente: Cliente) => (
        <div className="text-sm text-gray-600">
          {telefono || 'Sin teléfono'}
        </div>
      )
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (activo: boolean, cliente: Cliente) => (
        <Badge
          variant={activo ? 'green' : 'red'}
          size="sm"
        >
          {activo ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  // Componente móvil - Cards
  const ClienteCard: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
    return (
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{cliente.nombre}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {cliente.email || 'Sin email'}
              </p>
            </div>
            <Badge
              variant={cliente.activo ? 'green' : 'red'}
              size="sm"
            >
              {cliente.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          <div className="text-sm text-gray-600">
            <div>
              <span className="font-medium">Teléfono:</span> {cliente.telefono || 'Sin teléfono'}
            </div>
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

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">Error al cargar clientes</div>
      </div>
    );
  }

  if (!clientes || clientes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No tienes clientes registrados"
        message="Los clientes aparecerán aquí cuando tengas turnos con ellos"
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
        { value: 'activo', label: 'Estado' },
      ]}
      defaultSort="nombre"
      pageSize={10}
    >
      {(filteredData) => (
        <>
          {/* Desktop - Tabla */}
          <div className="hidden lg:block">
            <Table 
              columns={columns} 
              data={filteredData} 
              loading={loading}
              emptyMessage="No se encontraron clientes con los filtros aplicados"
            />
          </div>

          {/* Mobile - Cards */}
          <div className="block lg:hidden">
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
}
