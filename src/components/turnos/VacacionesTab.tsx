import React, { useState } from 'react';
import { Card, Button, Badge, ConfirmDialog } from '../ui';
import { DiasVacacion } from '../../types/turno.types';
import { VacacionModal } from './VacacionModal';
import { disponibilidadService } from '../../services/disponibilidad.service';

interface VacacionesTabProps {
  vacaciones: DiasVacacion[];
  loading: boolean;
  onRevalidate: () => void;
}

export const VacacionesTab: React.FC<VacacionesTabProps> = ({
  vacaciones,
  loading,
  onRevalidate
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVacacion, setSelectedVacacion] = useState<DiasVacacion | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleOpenModal = (vacacion: DiasVacacion | null) => {
    setSelectedVacacion(vacacion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVacacion(null);
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
      await disponibilidadService.deleteVacacion(deleteTargetId);
      onRevalidate();
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Error al eliminar vacación:', error);
    }
  };

  const formatDate = (fecha: string) => {
    const date = new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTipoConfig = (tipo: string) => {
    switch (tipo) {
      case 'vacacion':
        return { label: 'Vacación', color: 'blue' as const };
      case 'feriado':
        return { label: 'Feriado', color: 'yellow' as const };
      case 'personal':
        return { label: 'Personal', color: 'gray' as const };
      case 'enfermedad':
        return { label: 'Enfermedad', color: 'red' as const };
      default:
        return { label: tipo, color: 'gray' as const };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Vacaciones</h3>
        <Button onClick={() => handleOpenModal(null)}>
          Agregar vacación
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : vacaciones.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay vacaciones configuradas</p>
          <Button onClick={() => handleOpenModal(null)} className="mt-4">
            Crear primera vacación
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {vacaciones.map((vacacion) => {
            const tipoConfig = getTipoConfig(vacacion.tipo);
            
            return (
              <Card key={vacacion.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {formatDate(vacacion.fecha)}
                    </div>
                    
                    {vacacion.fecha_fin && (
                      <div className="text-sm text-gray-600 mt-1">
                        hasta {formatDate(vacacion.fecha_fin)}
                      </div>
                    )}

                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={tipoConfig.color}>
                        {tipoConfig.label}
                      </Badge>
                    </div>

                    {vacacion.motivo && (
                      <div className="text-sm text-gray-500 mt-1">
                        {vacacion.motivo}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenModal(vacacion)}
                    >
                      Editar
                    </Button>
                    
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(vacacion.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <VacacionModal
        vacacion={selectedVacacion}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar vacación"
        message="¿Estás seguro de que deseas eliminar esta vacación? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
