import React, { useState } from 'react';
import { Card, Table, Button, Badge, DataControls, EmptyState } from '../ui';
import { TurnoConDetalle, TurnoEstado } from '../../types/turno.types';
import { TurnoEstadoBadge } from '../ui/TurnoEstadoBadge';

interface TurnosCatalogoProps {
  turnos: TurnoConDetalle[];
  loading: boolean;
  isAdmin: boolean;
  onCancelar: (turno: TurnoConDetalle) => void;
}

export const TurnosCatalogo: React.FC<TurnosCatalogoProps> = ({
  turnos,
  loading,
  isAdmin,
  onCancelar
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatFecha = (fecha: string) => {
    // Si la fecha ya incluye timestamp, usarla directamente
    // Si es solo fecha, agregar tiempo para evitar problemas de timezone
    const date = fecha.includes('T') ? new Date(fecha) : new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const canCancelar = (estado: TurnoEstado) => {
    return estado === 'pendiente' || estado === 'confirmado';
  };

  const handleCancelar = (turno: TurnoConDetalle) => {
    if (window.confirm(`¿Estás seguro de que deseas cancelar el turno de ${turno.cliente_nombre}?`)) {
      onCancelar(turno);
    }
  };

  const columns = [
    {
      key: 'cliente_nombre' as keyof TurnoConDetalle,
      header: 'Cliente',
      render: (value: any, turno: TurnoConDetalle) => (
        <div>
          <div className="font-medium text-gray-900">{turno.cliente_nombre}</div>
          <div className="text-sm text-gray-500">{turno.cliente_email}</div>
        </div>
      )
    },
    ...(isAdmin ? [{
      key: 'usuario_nombre' as keyof TurnoConDetalle,
      header: 'Profesional',
      render: (value: any, turno: TurnoConDetalle) => (
        <div>
          <div className="font-medium text-gray-900">{turno.usuario_nombre}</div>
          <div className="text-sm text-gray-500">@{turno.usuario_username}</div>
        </div>
      )
    }] : []),
    {
      key: 'servicio' as keyof TurnoConDetalle,
      header: 'Servicio',
      render: (value: any, turno: TurnoConDetalle) => (
        <div className="text-gray-900">{turno.servicio}</div>
      )
    },
    {
      key: 'fecha' as keyof TurnoConDetalle,
      header: 'Fecha y hora',
      render: (value: any, turno: TurnoConDetalle) => (
        <div>
          <div className="text-gray-900">{formatFecha(turno.fecha)}</div>
          <div className="text-sm text-gray-500">{turno.hora}</div>
        </div>
      )
    },
    {
      key: 'estado' as keyof TurnoConDetalle,
      header: 'Estado',
      render: (value: any, turno: TurnoConDetalle) => (
        <TurnoEstadoBadge estado={turno.estado} />
      )
    },
    {
      key: 'id' as keyof TurnoConDetalle,
      header: 'Acciones',
      render: (value: any, turno: TurnoConDetalle) => (
        canCancelar(turno.estado) && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleCancelar(turno)}
          >
            Cancelar
          </Button>
        )
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (turnos.length === 0) {
    return (
      <EmptyState
        title="No hay turnos"
        message="No se encontraron turnos para mostrar"
        action={{
          label: "Actualizar",
          onClick: () => window.location.reload()
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DataControls
        data={turnos}
        searchFields={['cliente_nombre', 'usuario_nombre', 'servicio']}
        sortOptions={[
          { value: 'fecha', label: 'Fecha' },
          { value: 'estado', label: 'Estado' },
          { value: 'cliente_nombre', label: 'Cliente' },
          ...(isAdmin ? [{ value: 'usuario_nombre', label: 'Profesional' }] : [])
        ]}
        defaultSort="fecha"
        pageSize={10}
      >
        {(paginatedTurnos) => (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Table
                columns={columns}
                data={paginatedTurnos}
              />
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {paginatedTurnos.map((turno) => (
                <Card key={turno.id} className="p-4">
                  <div 
                    className="cursor-pointer"
                    onClick={() => toggleRowExpansion(turno.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {turno.cliente_nombre}
                        </div>
                        <div className="text-sm text-gray-500">
                          {turno.servicio} • {formatFecha(turno.fecha)} {turno.hora}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <TurnoEstadoBadge estado={turno.estado} />
                        <div className="text-gray-400">
                          {expandedRows.has(turno.id) ? '−' : '+'}
                        </div>
                      </div>
                    </div>

                    {expandedRows.has(turno.id) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Email:</span> {turno.cliente_email}
                          </div>
                          {isAdmin && (
                            <div>
                              <span className="font-medium">Profesional:</span> {turno.usuario_nombre} (@{turno.usuario_username})
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Servicio:</span> {turno.servicio}
                          </div>
                          <div>
                            <span className="font-medium">Fecha y hora:</span> {formatFecha(turno.fecha)} {turno.hora}
                          </div>
                          {turno.notas && (
                            <div>
                              <span className="font-medium">Notas:</span> {turno.notas}
                            </div>
                          )}
                          {canCancelar(turno.estado) && (
                            <div className="pt-2">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelar(turno);
                                }}
                              >
                                Cancelar turno
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </DataControls>
    </div>
  );
};
