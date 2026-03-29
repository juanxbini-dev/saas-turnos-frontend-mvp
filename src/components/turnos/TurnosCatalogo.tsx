import React, { useState } from 'react';
import { Card, Table, Button, DataControls, EmptyState, ConfirmModal } from '../ui';
import { TurnoConDetalle, TurnoEstado } from '../../types/turno.types';
import { TurnoEstadoBadge } from '../ui/TurnoEstadoBadge';

interface TurnosCatalogoProps {
  turnos: TurnoConDetalle[];
  loading: boolean;
  isAdmin: boolean;
  onCancelar: (turno: TurnoConDetalle) => void;
  onConfirmar?: (turno: TurnoConDetalle) => void;
  onFinalizar?: (turno: TurnoConDetalle) => void;
}

export const TurnosCatalogo: React.FC<TurnosCatalogoProps> = ({
  turnos,
  loading,
  isAdmin,
  onCancelar,
  onConfirmar,
  onFinalizar
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [confirmarModal, setConfirmarModal] = useState<{ isOpen: boolean; turno: TurnoConDetalle | null }>({
    isOpen: false,
    turno: null
  });
  const [cancelarModal, setCancelarModal] = useState<{ isOpen: boolean; turno: TurnoConDetalle | null }>({
    isOpen: false,
    turno: null
  });

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleActionsExpansion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedActions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActions(newExpanded);
  };

  const formatFecha = (fecha: string) => {
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

  const canConfirmar = (estado: TurnoEstado) => {
    return estado === 'pendiente' && !!onConfirmar;
  };

  const canFinalizar = (estado: TurnoEstado) => {
    return estado === 'confirmado' && !!onFinalizar;
  };

  const hasActions = (estado: TurnoEstado) => {
    return canConfirmar(estado) || canFinalizar(estado) || canCancelar(estado);
  };

  const handleCancelar = (turno: TurnoConDetalle) => {
    setCancelarModal({ isOpen: true, turno });
  };

  const handleConfirmar = (turno: TurnoConDetalle) => {
    setConfirmarModal({ isOpen: true, turno });
  };

  const handleConfirmarConfirm = () => {
    if (confirmarModal.turno && onConfirmar) {
      onConfirmar(confirmarModal.turno);
      setConfirmarModal({ isOpen: false, turno: null });
    }
  };

  const handleCancelarConfirm = () => {
    if (cancelarModal.turno) {
      onCancelar(cancelarModal.turno);
      setCancelarModal({ isOpen: false, turno: null });
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
        <div className="flex items-center gap-2">
          {canConfirmar(turno.estado) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleConfirmar(turno)}
            >
              Confirmar
            </Button>
          )}
          {canFinalizar(turno.estado) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onFinalizar!(turno)}
            >
              Finalizar
            </Button>
          )}
          {canCancelar(turno.estado) && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleCancelar(turno)}
            >
              Cancelar
            </Button>
          )}
        </div>
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
    <>
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
                  <Card key={turno.id} className="p-0 overflow-hidden">
                    {/* Franja de fecha */}
                    <div className="bg-gray-100 px-4 py-1.5 flex items-center justify-between border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-700 tracking-wide">
                        {formatFecha(turno.fecha)}
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        {turno.hora}
                      </span>
                    </div>

                    <div className="p-4">
                    {/* Cabecera siempre visible — click para expandir detalles */}
                    <div
                      className="cursor-pointer"
                      onClick={() => toggleRowExpansion(turno.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {turno.cliente_nombre}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {turno.servicio}
                          </div>
                          {isAdmin && (
                            <div className="text-xs text-blue-600 truncate mt-0.5">
                              {turno.usuario_nombre}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <TurnoEstadoBadge estado={turno.estado} />
                          <span className="text-gray-400 text-sm">
                            {expandedRows.has(turno.id) ? '−' : '+'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detalles expandibles */}
                    {expandedRows.has(turno.id) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-sm">
                        <div>
                          <span className="font-medium">Email:</span> {turno.cliente_email}
                        </div>
                        {isAdmin && (
                          <div>
                            <span className="font-medium">Profesional:</span>{' '}
                            {turno.usuario_nombre} (@{turno.usuario_username})
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Servicio:</span> {turno.servicio}
                        </div>
                        <div>
                          <span className="font-medium">Fecha y hora:</span>{' '}
                          {formatFecha(turno.fecha)} {turno.hora}
                        </div>
                        {turno.notas && (
                          <div>
                            <span className="font-medium">Notas:</span> {turno.notas}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acciones mobile — siempre al pie, desplegables */}
                    {hasActions(turno.estado) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => toggleActionsExpansion(turno.id, e)}
                          className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
                        >
                          Ver acciones
                          <span className="text-xs">
                            {expandedActions.has(turno.id) ? '▲' : '▼'}
                          </span>
                        </button>

                        {expandedActions.has(turno.id) && (
                          <div className="mt-2 flex flex-col gap-0.5">
                            {canConfirmar(turno.estado) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmar(turno);
                                }}
                                className="text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 font-medium"
                              >
                                ✓ Confirmar turno
                              </button>
                            )}
                            {canFinalizar(turno.estado) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFinalizar!(turno);
                                }}
                                className="text-left text-sm text-green-600 hover:text-green-800 py-1.5 font-medium"
                              >
                                ✓ Finalizar turno
                              </button>
                            )}
                            {canCancelar(turno.estado) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelar(turno);
                                }}
                                className="text-left text-sm text-red-500 hover:text-red-700 py-1.5 font-medium"
                              >
                                ✕ Cancelar turno
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>{/* fin p-4 */}
                  </Card>
                ))}
              </div>
            </>
          )}
        </DataControls>
      </div>

      <ConfirmModal
        isOpen={confirmarModal.isOpen}
        onClose={() => setConfirmarModal({ isOpen: false, turno: null })}
        onConfirm={handleConfirmarConfirm}
        title="Confirmar turno"
        message={`¿Estás seguro de que deseas confirmar el turno de ${confirmarModal.turno?.cliente_nombre}?`}
        confirmText="Confirmar turno"
        variant="primary"
      />

      <ConfirmModal
        isOpen={cancelarModal.isOpen}
        onClose={() => setCancelarModal({ isOpen: false, turno: null })}
        onConfirm={handleCancelarConfirm}
        title="Cancelar turno"
        message={`¿Estás seguro de que deseas cancelar el turno de ${cancelarModal.turno?.cliente_nombre}?`}
        confirmText="Cancelar turno"
        variant="danger"
      />
    </>
  );
};
