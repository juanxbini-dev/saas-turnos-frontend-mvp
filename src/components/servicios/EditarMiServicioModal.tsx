import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea, Select } from '../ui';
import { servicioService } from '../../services/servicio.service';
import { UsuarioServicio, UpdateMiServicioData } from '../../types/servicio.types';
import { useToast } from '../../hooks/useToast';

interface EditarMiServicioModalProps {
  usuarioServicio: UsuarioServicio;
  onClose: () => void;
  onServicioActualizado: () => void;
}

export const EditarMiServicioModal: React.FC<EditarMiServicioModalProps> = ({
  usuarioServicio,
  onClose,
  onServicioActualizado
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateMiServicioData>({
    precio_personalizado: usuarioServicio.precio_personalizado,
    duracion_personalizada: usuarioServicio.duracion_personalizada,
    habilitado: usuarioServicio.habilitado,
    nivel_habilidad: usuarioServicio.nivel_habilidad || '',
    notas: usuarioServicio.notas || ''
  });

  const nivelOptions = [
    { value: '', label: 'Seleccionar nivel' },
    { value: 'básico', label: 'Básico' },
    { value: 'intermedio', label: 'Intermedio' },
    { value: 'avanzado', label: 'Avanzado' },
    { value: 'experto', label: 'Experto' }
  ];

  const habilitadoOptions = [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' }
  ];

  const handleChange = (field: keyof UpdateMiServicioData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field: keyof UpdateMiServicioData) => {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (field === 'habilitado') {
        handleChange(field, value === 'true');
      } else if (field === 'nivel_habilidad') {
        handleChange(field, value || null);
      } else {
        handleChange(field, value);
      }
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    
    try {
      await servicioService.updateMiServicio(usuarioServicio.id, formData);
      toastSuccess('Servicio actualizado correctamente');
      onServicioActualizado();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al actualizar tu servicio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre del servicio (solo lectura) */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Servicio
        </label>
        <div className="text-gray-900 font-medium">
          {usuarioServicio.servicio_nombre}
        </div>
        {usuarioServicio.servicio_descripcion && (
          <div className="text-sm text-gray-600 mt-1">
            {usuarioServicio.servicio_descripcion}
          </div>
        )}
      </div>

      <Input
        label="Precio personalizado"
        type="number"
        value={formData.precio_personalizado || ''}
        onChange={(e) => handleChange('precio_personalizado', e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="Dejar vacío para usar precio base"
        step="0.01"
        min="0"
        help="Si no especificas un precio, se usará el precio base del servicio"
      />

      <Input
        label="Duración personalizada (minutos)"
        type="number"
        value={formData.duracion_personalizada || ''}
        onChange={(e) => handleChange('duracion_personalizada', e.target.value ? parseInt(e.target.value) : null)}
        placeholder="Dejar vacío para usar duración base"
        min="1"
        help="Si no especificas una duración, se usará la duración base del servicio"
      />

      <Select
        label="Nivel de habilidad"
        value={formData.nivel_habilidad || ''}
        onChange={handleSelectChange('nivel_habilidad')}
        options={nivelOptions}
      />

      <Select
        label="Habilitado"
        value={formData.habilitado ? 'true' : 'false'}
        onChange={handleSelectChange('habilitado')}
        options={habilitadoOptions}
      />

      <Textarea
        label="Notas personales"
        value={formData.notas || ''}
        onChange={(e) => handleChange('notas', e.target.value)}
        placeholder="Anotaciones personales sobre este servicio..."
        rows={3}
        help="Estas notas son privadas y solo las verás tú"
      />

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
          Guardar cambios
        </Button>
      </div>
    </form>
  );
};
