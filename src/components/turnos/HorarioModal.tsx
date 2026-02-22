import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { DisponibilidadSemanal } from '../../types/turno.types';
import { useAuth } from '../../context/AuthContext';

interface HorarioModalProps {
  horario: DisponibilidadSemanal | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const diasSemana = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' }
];

const intervalos = [
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' }
];

export const HorarioModal: React.FC<HorarioModalProps> = ({
  horario,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { state: authUser } = useAuth();
  
  const [formData, setFormData] = useState({
    dia_inicio: horario?.dia_inicio?.toString() || '1',
    dia_fin: horario?.dia_fin?.toString() || '5',
    hora_inicio: horario?.hora_inicio || '09:00',
    hora_fin: horario?.hora_fin || '17:00',
    intervalo_minutos: horario?.intervalo_minutos?.toString() || '30'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (parseInt(formData.dia_fin) < parseInt(formData.dia_inicio)) {
      newErrors.dia_fin = 'El día de fin debe ser mayor o igual al día de inicio';
    }

    if (formData.hora_fin <= formData.hora_inicio) {
      newErrors.hora_fin = 'La hora de fin debe ser mayor a la hora de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 [HorarioModal] Guardando horario:', formData);
      console.log('🔍 [HorarioModal] horario:', horario);
      console.log('🔍 [HorarioModal] Es edición?', !!horario);
      
      // Convertir strings a numbers para el servicio
      const dataForService = {
        profesional_id: authUser?.authUser?.id || '',
        dia_inicio: parseInt(formData.dia_inicio),
        dia_fin: parseInt(formData.dia_fin),
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        intervalo_minutos: parseInt(formData.intervalo_minutos)
      };
      
      console.log('🔍 [HorarioModal] dataForService:', dataForService);
      
      if (horario) {
        // Editar horario existente
        console.log('🔍 [HorarioModal] Editando horario ID:', horario.id);
        await disponibilidadService.updateDisponibilidad(horario.id, dataForService);
        console.log('✅ [HorarioModal] Horario actualizado');
      } else {
        // Crear nuevo horario
        console.log('🔍 [HorarioModal] Creando nuevo horario');
        await disponibilidadService.createDisponibilidad(dataForService);
        console.log('✅ [HorarioModal] Horario creado');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('💥 [HorarioModal] Error al guardar horario:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={horario ? 'Editar horario' : 'Nuevo horario'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Día de inicio
            </label>
            <Select
              value={formData.dia_inicio}
              onChange={(value) => handleChange('dia_inicio', value)}
              options={diasSemana}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Día de fin
            </label>
            <Select
              value={formData.dia_fin}
              onChange={(value) => handleChange('dia_fin', value)}
              options={diasSemana}
            />
            {errors.dia_fin && (
              <p className="text-red-500 text-xs mt-1">{errors.dia_fin}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora de inicio
            </label>
            <Input
              type="time"
              value={formData.hora_inicio}
              onChange={(e) => handleChange('hora_inicio', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora de fin
            </label>
            <Input
              type="time"
              value={formData.hora_fin}
              onChange={(e) => handleChange('hora_fin', e.target.value)}
            />
            {errors.hora_fin && (
              <p className="text-red-500 text-xs mt-1">{errors.hora_fin}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Intervalo
          </label>
          <Select
            value={formData.intervalo_minutos}
            onChange={(value) => handleChange('intervalo_minutos', value)}
            options={intervalos}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            {horario ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
