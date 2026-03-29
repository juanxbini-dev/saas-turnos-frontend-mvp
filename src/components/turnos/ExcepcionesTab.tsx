import React, { useState } from 'react';
import { Card, Button, Badge, ConfirmDialog } from '../ui';
import { ExcepcionDia } from '../../types/turno.types';
import { ExcepcionModal } from './ExcepcionModal';
import { disponibilidadService } from '../../services/disponibilidad.service';

interface ExcepcionesTabProps {
  excepciones: ExcepcionDia[];
  loading: boolean;
  onRevalidate: () => void;
  profesionalId?: string;
}

export const ExcepcionesTab: React.FC<ExcepcionesTabProps> = ({
  excepciones,
  loading,
  onRevalidate,
  profesionalId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExcepcion, setSelectedExcepcion] = useState<ExcepcionDia | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleOpenModal = (excepcion: ExcepcionDia | null) => {
    setSelectedExcepcion(excepcion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExcepcion(null);
  };

  const handleSuccess = () => {
    onRevalidate();
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    try {
      await disponibilidadService.deleteExcepcion(deleteTargetId, profesionalId);
      onRevalidate();
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Error al eliminar excepción:', error);
    }
  };

  const formatDate = (fecha: string) => {
    if (!fecha) return 'Fecha no disponible';
    
    console.log('🔍 [ExcepcionesTab] Formateando fecha:', fecha);
    
    try {
      // Intentar diferentes formatos de fecha
      let date: Date;
      
      // Si la fecha tiene formato YYYY-MM-DD, agregar tiempo para evitar problemas de timezone
      if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(fecha + 'T12:00:00');
      } else {
        date = new Date(fecha);
      }
      
      console.log('🔍 [ExcepcionesTab] Fecha parseada:', date, 'getTime():', date.getTime());
      
      // Validar que la fecha sea válida
      if (isNaN(date.getTime())) {
        console.error('❌ [ExcepcionesTab] Fecha inválida:', fecha);
        return 'Fecha inválida';
      }
      
      const formatted = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      console.log('✅ [ExcepcionesTab] Fecha formateada:', formatted);
      return formatted;
    } catch (error) {
      console.error('💥 [ExcepcionesTab] Error formateando fecha:', fecha, error);
      return 'Error en fecha';
    }
  };

  const formatTime = (time: string) => {
    return time ? time.slice(0, 5) : '';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Excepciones</h3>
        <Button onClick={() => handleOpenModal(null)}>
          Agregar excepción
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : excepciones.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay excepciones configuradas</p>
          <Button onClick={() => handleOpenModal(null)} className="mt-4">
            Crear primera excepción
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {excepciones.map((excepcion) => (
            <Card key={excepcion.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {formatDate(excepcion.fecha)}
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge
                      variant={excepcion.disponible ? 'green' : 'red'}
                    >
                      {excepcion.disponible ? 'Trabaja' : 'No trabaja'}
                    </Badge>
                  </div>

                  {excepcion.disponible && excepcion.hora_inicio && excepcion.hora_fin && (
                    <div className="text-sm text-gray-600 mt-1">
                      {formatTime(excepcion.hora_inicio)} - {formatTime(excepcion.hora_fin)}
                      {excepcion.intervalo_minutos && (
                        <span className="ml-2">
                          Cada {excepcion.intervalo_minutos} min
                        </span>
                      )}
                    </div>
                  )}

                  {excepcion.notas && (
                    <div className="text-sm text-gray-500 mt-1">
                      {excepcion.notas}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenModal(excepcion)}
                  >
                    Editar
                  </Button>
                  
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(excepcion.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ExcepcionModal
        excepcion={selectedExcepcion}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        profesionalId={profesionalId}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar excepción"
        message="¿Estás seguro de que deseas eliminar esta excepción? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
