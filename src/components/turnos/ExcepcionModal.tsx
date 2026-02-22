import React, { useState } from 'react';
import { Modal, Input, Select, Button, Textarea } from '../ui';
import { ExcepcionDia } from '../../types/turno.types';

interface ExcepcionModalProps {
  excepcion: ExcepcionDia | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcepcionModal: React.FC<ExcepcionModalProps> = ({
  excepcion,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    fecha: excepcion?.fecha || '',
    disponible: excepcion?.disponible ?? true,
    hora_inicio: excepcion?.hora_inicio || '',
    hora_fin: excepcion?.hora_fin || '',
    intervalo_minutos: excepcion?.intervalo_minutos?.toString() || '30',
    notas: excepcion?.notas || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }

    if (formData.disponible) {
      if (!formData.hora_inicio) {
        newErrors.hora_inicio = 'La hora de inicio es requerida cuando trabaja ese día';
      }
      if (!formData.hora_fin) {
        newErrors.hora_fin = 'La hora de fin es requerida cuando trabaja ese día';
      }
      if (formData.hora_fin <= formData.hora_inicio) {
        newErrors.hora_fin = 'La hora de fin debe ser mayor a la hora de inicio';
      }
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
      // Aquí iría la lógica para guardar la excepción
      console.log('Guardando excepción:', formData);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al guardar excepción:', error);
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

  const intervalos = [
    { value: '15', label: '15 minutos' },
    { value: '30', label: '30 minutos' },
    { value: '60', label: '1 hora' }
  ];

  const opcionesDisponible = [
    { value: 'true', label: 'Trabaja ese día' },
    { value: 'false', label: 'No trabaja ese día' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={excepcion ? 'Editar excepción' : 'Nueva excepción'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha
          </label>
          <Input
            type="date"
            value={formData.fecha}
            onChange={(e) => handleChange('fecha', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          {errors.fecha && (
            <p className="text-red-500 text-xs mt-1">{errors.fecha}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Disponibilidad
          </label>
          <Select
            value={formData.disponible.toString()}
            onChange={(value) => handleChange('disponible', value === 'true')}
            options={opcionesDisponible}
          />
        </div>

        {formData.disponible && (
          <>
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
                {errors.hora_inicio && (
                  <p className="text-red-500 text-xs mt-1">{errors.hora_inicio}</p>
                )}
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
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <Textarea
            value={formData.notas}
            onChange={(e) => handleChange('notas', e.target.value)}
            placeholder="Notas sobre esta excepción..."
            rows={3}
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
            {excepcion ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
