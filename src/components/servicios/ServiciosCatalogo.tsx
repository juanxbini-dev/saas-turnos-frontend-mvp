import React from 'react';
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
    const [expandido, setExpandido] = React.useState(false);

    return (
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{servicio.nombre}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {truncarTexto(servicio.descripcion, 100)}
              </p>
            </div>
            <Badge
              variant={servicio.activo ? 'green' : 'red'}
              size="sm"
            >
              {servicio.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
            <div>
              <span className="font-medium">Duración:</span> {servicio.duracion} min
            </div>
            <div>
              <span className="font-medium">Precio:</span> {formatearPrecio(servicio.precio_base)}
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
                  variant={suscripto ? 'secondary' : 'primary'}
                  onClick={() => onSuscribirse(servicio)}
                  disabled={suscripto}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {suscripto ? 'Suscripto' : 'Suscribirse'}
                </Button>

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
            )}
          </div>
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
      <div className="block lg:hidden">
        {servicios.map((servicio) => (
          <ServicioCard key={servicio.id} servicio={servicio} />
        ))}
      </div>
    </>
  );
};
