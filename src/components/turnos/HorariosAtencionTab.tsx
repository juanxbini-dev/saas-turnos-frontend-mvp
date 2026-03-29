import React, { useState } from 'react';
import { Card, Button, Badge, ConfirmDialog } from '../ui';
import { DisponibilidadSemanal } from '../../types/turno.types';
import { HorarioModal } from './HorarioModal';
import { disponibilidadService } from '../../services/disponibilidad.service';

interface HorariosAtencionTabProps {
  disponibilidades: DisponibilidadSemanal[];
  loading: boolean;
  onRevalidate: () => void;
  profesionalId?: string;
}

export const HorariosAtencionTab: React.FC<HorariosAtencionTabProps> = ({
  disponibilidades,
  loading,
  onRevalidate,
  profesionalId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHorario, setSelectedHorario] = useState<DisponibilidadSemanal | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleOpenModal = (horario: DisponibilidadSemanal | null) => {
    setSelectedHorario(horario);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedHorario(null);
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
      await disponibilidadService.deleteDisponibilidad(deleteTargetId, profesionalId);
      onRevalidate();
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Error al eliminar horario:', error);
    }
  };

  const getDiasText = (diaInicio: number, diaFin: number) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    if (diaInicio === diaFin) {
      return dias[diaInicio];
    }
    
    return `${dias[diaInicio]} a ${dias[diaFin]}`;
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Horarios de atención</h3>
        <Button onClick={() => handleOpenModal(null)}>
          Agregar horario
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : disponibilidades.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay horarios configurados</p>
          <Button onClick={() => handleOpenModal(null)} className="mt-4">
            Crear primer horario
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {disponibilidades.map((horario) => (
            <Card key={horario.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {getDiasText(horario.dia_inicio, horario.dia_fin)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatTime(horario.hora_inicio)} - {formatTime(horario.hora_fin)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Cada {horario.intervalo_minutos} minutos
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Badge
                    variant={horario.activo ? 'green' : 'gray'}
                  >
                    {horario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenModal(horario)}
                  >
                    Editar
                  </Button>
                  
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(horario.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <HorarioModal
        horario={selectedHorario}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        profesionalId={profesionalId}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar horario"
        message="¿Estás seguro de que deseas eliminar este horario? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};
