import React, { useState } from 'react';
import { Table, Button, Badge, Card } from '../ui';
import { UsuarioServicio } from '../../types/servicio.types';
import { Edit, Trash2 } from 'lucide-react';

interface MisServiciosListProps {
  misServicios: UsuarioServicio[];
  loading: boolean;
  onEditar: (usuarioServicio: UsuarioServicio) => void;
  onDesuscribirse: (servicioId: string) => void;
}

export const MisServiciosList: React.FC<MisServiciosListProps> = ({
  misServicios,
  loading,
  onEditar,
  onDesuscribirse
}) => {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const toggleActions = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedActions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedActions(next);
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
      key: 'servicio_nombre',
      header: 'Servicio',
      render: (servicio_nombre: string, usuarioServicio: UsuarioServicio) => {
        return (
          <div>
            <div className="font-medium text-gray-900">
              {usuarioServicio.nombre}
            </div>
            <div className="text-sm text-gray-600 max-w-xs">
              {usuarioServicio.descripcion || '-'}
            </div>
          </div>
        );
      }
    },
    {
      key: 'precio_personalizado',
      header: 'Precio',
      render: (precio_personalizado: number | null | undefined, usuarioServicio: UsuarioServicio) => {
        const precio = usuarioServicio.precio;
        return (
          <div className="text-sm text-gray-900">
            {formatearPrecio(precio || null)}
          </div>
        );
      }
    },
    {
      key: 'duracion_personalizada',
      header: 'Duración',
      render: (duracion_personalizada: number | null, usuarioServicio: UsuarioServicio) => {
        return (
          <div className="text-sm text-gray-900">
            {usuarioServicio.duracion_minutos || '-'} min
          </div>
        );
      }
    },
    {
      key: 'nivel_habilidad',
      header: 'Nivel',
      render: (nivel_habilidad: string | null, usuarioServicio: UsuarioServicio) => {
        if (!nivel_habilidad) {
          return <span className="text-sm text-gray-400">-</span>;
        }
        
        const variantMap: Record<string, any> = {
          'básico': 'gray',
          'intermedio': 'blue',
          'avanzado': 'purple',
          'experto': 'gold'
        };
        
        return (
          <Badge
            variant={variantMap[nivel_habilidad] || 'gray'}
            size="sm"
          >
            {nivel_habilidad}
          </Badge>
        );
      }
    },
    {
      key: 'habilitado',
      header: 'Estado',
      render: (habilitado: boolean, usuarioServicio: UsuarioServicio) => {
        return (
          <Badge
            variant={habilitado ? 'green' : 'red'}
            size="sm"
          >
            {habilitado ? 'Habilitado' : 'Deshabilitado'}
          </Badge>
        );
      }
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (acciones: any, usuarioServicio: UsuarioServicio) => {
        return (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEditar(usuarioServicio)}
            >
              <Edit className="w-3 h-3 mr-1" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDesuscribirse(usuarioServicio.servicio_id)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Desuscribirse
            </Button>
          </div>
        );
      }
    }
  ];

  const variantMap: Record<string, any> = {
    'básico': 'gray',
    'intermedio': 'blue',
    'avanzado': 'purple',
    'experto': 'gold'
  };

  // Componente móvil - Cards
  const MiServicioCard: React.FC<{ usuarioServicio: UsuarioServicio }> = ({ usuarioServicio }) => {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{usuarioServicio.nombre}</div>
            {usuarioServicio.descripcion && (
              <div className="text-sm text-gray-500 truncate">{usuarioServicio.descripcion}</div>
            )}
          </div>
          <Badge variant={usuarioServicio.habilitado ? 'green' : 'red'} size="sm">
            {usuarioServicio.habilitado ? 'Habilitado' : 'Deshabilitado'}
          </Badge>
        </div>

        <div className="flex gap-4 text-sm text-gray-600">
          <span><span className="font-medium">Precio:</span> {formatearPrecio(usuarioServicio.precio || null)}</span>
          <span><span className="font-medium">Duración:</span> {usuarioServicio.duracion_minutos || '-'} min</span>
        </div>

        {usuarioServicio.nivel_habilidad && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Nivel:</span>{' '}
            <Badge variant={variantMap[usuarioServicio.nivel_habilidad] || 'gray'} size="sm" className="ml-1">
              {usuarioServicio.nivel_habilidad}
            </Badge>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={(e) => toggleActions(usuarioServicio.id, e)}
            className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
          >
            Ver acciones
            <span className="text-xs">{expandedActions.has(usuarioServicio.id) ? '▲' : '▼'}</span>
          </button>

          {expandedActions.has(usuarioServicio.id) && (
            <div className="mt-2 flex flex-col gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onEditar(usuarioServicio); }}
                className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
              >
                ✎ Editar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDesuscribirse(usuarioServicio.servicio_id); }}
                className="text-left text-sm text-red-500 hover:text-red-700 py-1.5 font-medium"
              >
                ✕ Desuscribirse
              </button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Cargando tus servicios...</div>
      </div>
    );
  }

  if (misServicios.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          No estás suscripto a ningún servicio
        </div>
        <div className="text-sm text-gray-400">
          Ve a la sección "Servicios" para suscribirte a los servicios disponibles
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Tabla para desktop */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={misServicios}
          loading={loading}
        />
      </div>

      {/* Cards para mobile */}
      <div className="lg:hidden space-y-3">
        {misServicios.map((usuarioServicio) => (
          <MiServicioCard key={usuarioServicio.id} usuarioServicio={usuarioServicio} />
        ))}
      </div>
    </>
  );
};
