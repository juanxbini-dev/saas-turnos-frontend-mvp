import React, { useState } from 'react';
import { Button, Input, Textarea } from '../ui';
import { servicioService } from '../../services/servicio.service';
import { CreateServicioData } from '../../types/servicio.types';
import { useToast } from '../../hooks/useToast';

interface CrearServicioModalProps {
  onClose: () => void;
  onServicioCreado: () => void;
}

export const CrearServicioModal: React.FC<CrearServicioModalProps> = ({
  onClose,
  onServicioCreado
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateServicioData>({
    nombre: '',
    descripcion: '',
    duracion: 30,
    precio_base: undefined,
    precio_minimo: undefined,
    precio_maximo: undefined
  });

  const handleChange = (field: keyof CreateServicioData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!formData.nombre.trim()) {
      toastError('El nombre del servicio es requerido');
      return;
    }
    
    if (!formData.duracion || formData.duracion <= 0) {
      toastError('La duración debe ser mayor a 0');
      return;
    }

    setLoading(true);
    
    try {
      await servicioService.createServicio(formData);
      toastSuccess('Servicio creado correctamente');
      onServicioCreado();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al crear el servicio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre del servicio"
        value={formData.nombre}
        onChange={(e) => handleChange('nombre', e.target.value)}
        placeholder="Ej: Corte de cabello"
        required
      />

      <Textarea
        label="Descripción"
        value={formData.descripcion}
        onChange={(e) => handleChange('descripcion', e.target.value)}
        placeholder="Describe el servicio..."
        rows={3}
      />

      <Input
        label="Duración (minutos)"
        type="number"
        value={formData.duracion}
        onChange={(e) => handleChange('duracion', parseInt(e.target.value) || 0)}
        placeholder="30"
        min="1"
        required
      />

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Precio base"
          type="number"
          value={formData.precio_base || ''}
          onChange={(e) => handleChange('precio_base', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="0.00"
          step="0.01"
          min="0"
        />

        <Input
          label="Precio mínimo"
          type="number"
          value={formData.precio_minimo || ''}
          onChange={(e) => handleChange('precio_minimo', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="0.00"
          step="0.01"
          min="0"
        />

        <Input
          label="Precio máximo"
          type="number"
          value={formData.precio_maximo || ''}
          onChange={(e) => handleChange('precio_maximo', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="0.00"
          step="0.01"
          min="0"
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
          Crear servicio
        </Button>
      </div>
    </form>
  );
};
