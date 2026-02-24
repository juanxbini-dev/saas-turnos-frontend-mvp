import React from 'react';
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

  // Componente móvil - Cards
  const MiServicioCard: React.FC<{ usuarioServicio: UsuarioServicio }> = ({ usuarioServicio }) => {
    const [expandido, setExpandido] = React.useState(false);

    const variantMap: Record<string, any> = {
      'básico': 'gray',
      'intermedio': 'blue',
      'avanzado': 'purple',
      'experto': 'gold'
    };

    return (
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {usuarioServicio.nombre}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {usuarioServicio.descripcion || 'Sin descripción'}
              </p>
            </div>
            <Badge
              variant={usuarioServicio.habilitado ? 'green' : 'red'}
              size="sm"
            >
              {usuarioServicio.habilitado ? 'Habilitado' : 'Deshabilitado'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
            <div>
              <span className="font-medium">Precio:</span> {formatearPrecio(
                usuarioServicio.precio || null
              )}
            </div>
            <div>
              <span className="font-medium">Duración:</span> {usuarioServicio.duracion_minutos || '-'} min
            </div>
            {usuarioServicio.nivel_habilidad && (
              <div className="col-span-2">
                <span className="font-medium">Nivel:</span>{' '}
                <Badge
                  variant={variantMap[usuarioServicio.nivel_habilidad] || 'gray'}
                  size="sm"
                  className="ml-1"
                >
                  {usuarioServicio.nivel_habilidad}
                </Badge>
              </div>
            )}
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
            )}
          </div>
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
      <div className="block lg:hidden">
        {misServicios.map((usuarioServicio) => (
          <MiServicioCard key={usuarioServicio.id} usuarioServicio={usuarioServicio} />
        ))}
      </div>
    </>
  );
};
