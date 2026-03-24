import React, { useState } from 'react';
import { Table, Button, Badge, Card } from '../ui';
import { Servicio, UsuarioServicio } from '../../types/servicio.types';
import { Edit, Trash2, Plus } from 'lucide-react';

interface ServiciosCatalogoProps {
  servicios: Servicio[];
  loading: boolean;
  misServicios: UsuarioServicio[];
  onEditar: (servicio: Servicio) => void;
  onSuscribirse: (servicio: Servicio) => void;
  onEliminar: (servicio: Servicio) => void;
  isAdmin: boolean;
}

export const ServiciosCatalogo: React.FC<ServiciosCatalogoProps> = ({
  servicios,
  loading,
  misServicios,
  onEditar,
  onSuscribirse,
  onEliminar,
  isAdmin
}) => {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const toggleActions = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedActions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedActions(next);
  };
  // Verificar si un usuario ya está suscripto a un servicio
  const estaSuscripto = (servicioId: string) => {
    return misServicios.some(ms => ms.servicio_id === servicioId);
  };

  // Truncar texto a un máximo de caracteres
  const truncarTexto = (texto: string | null, maxChars: number) => {
    if (!texto) return '-';
    return texto.length > maxChars ? texto.substring(0, maxChars) + '...' : texto;
  };

  // Formatear precio
  const formatearPrecio = (precio: number | null) => {
    if (precio === null || precio === undefined) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  };

  const columns: Array<any> = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (nombre: string, servicio: Servicio) => {
        return (
          <div className="font-medium text-gray-900">
            {nombre}
          </div>
        );
      }
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (descripcion: string | null, servicio: Servicio) => {
        return (
          <div className="text-sm text-gray-600 max-w-xs">
            {truncarTexto(descripcion, 50)}
          </div>
        );
      }
    },
    {
      key: 'duracion',
      header: 'Duración',
      render: (duracion: number, servicio: Servicio) => {
        return (
          <div className="text-sm text-gray-900">
            {duracion} min
          </div>
        );
      }
    },
    {
      key: 'precio_base',
      header: 'Precio base',
      render: (precio_base: number | null, servicio: Servicio) => {
        return (
          <div className="text-sm text-gray-900">
            {formatearPrecio(precio_base)}
          </div>
        );
      }
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (activo: boolean, servicio: Servicio) => {
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
      render: (acciones: any, servicio: Servicio) => {
        const suscripto = estaSuscripto(servicio.id);
        
        return (
          <div className="flex items-center space-x-2">
            {/* Botón de suscripción para todos */}
            <Button
              size="sm"
              variant={suscripto ? 'secondary' : 'primary'}
              onClick={() => onSuscribirse(servicio)}
              disabled={suscripto}
            >
              <Plus className="w-3 h-3 mr-1" />
              {suscripto ? 'Suscripto' : 'Suscribirse'}
            </Button>

            {/* Botones de admin */}
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEditar(servicio)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onEliminar(servicio)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </Button>
              </>
            )}
          </div>
        );
      }
    }
  ];

  // Componente móvil - Cards expandibles
  const ServicioCard: React.FC<{ servicio: Servicio }> = ({ servicio }) => {
    const suscripto = estaSuscripto(servicio.id);

    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{servicio.nombre}</div>
            {servicio.descripcion && (
              <div className="text-sm text-gray-500 truncate">{truncarTexto(servicio.descripcion, 80)}</div>
            )}
          </div>
          <Badge variant={servicio.activo ? 'green' : 'red'} size="sm">
            {servicio.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="flex gap-4 text-sm text-gray-600">
          <span><span className="font-medium">Duración:</span> {servicio.duracion} min</span>
          <span><span className="font-medium">Precio:</span> {formatearPrecio(servicio.precio_base)}</span>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={(e) => toggleActions(servicio.id, e)}
            className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
          >
            Ver acciones
            <span className="text-xs">{expandedActions.has(servicio.id) ? '▲' : '▼'}</span>
          </button>

          {expandedActions.has(servicio.id) && (
            <div className="mt-2 flex flex-col gap-0.5">
              {!suscripto ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onSuscribirse(servicio); }}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 font-medium"
                >
                  + Suscribirse
                </button>
              ) : (
                <span className="text-sm text-gray-400 py-1.5">✓ Ya suscripto</span>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditar(servicio); }}
                    className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
                  >
                    ✎ Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEliminar(servicio); }}
                    className="text-left text-sm text-red-500 hover:text-red-700 py-1.5 font-medium"
                  >
                    ✕ Eliminar
                  </button>
                </>
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
        <div className="text-gray-500">Cargando servicios...</div>
      </div>
    );
  }

  if (servicios.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          No hay servicios disponibles
        </div>
        {isAdmin && (
          <div className="text-sm text-gray-400">
            Crea tu primer servicio usando el botón "Nuevo servicio"
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
          data={servicios}
          loading={loading}
        />
      </div>

      {/* Cards para mobile */}
      <div className="lg:hidden space-y-3">
        {servicios.map((servicio) => (
          <ServicioCard key={servicio.id} servicio={servicio} />
        ))}
      </div>
    </>
  );
};
