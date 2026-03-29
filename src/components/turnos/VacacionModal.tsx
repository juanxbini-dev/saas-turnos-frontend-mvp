import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Textarea } from '../ui';
import { DiasVacacion } from '../../types/turno.types';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/createLogger';
import { cacheService } from '../../cache/cache.service';

const vacacionLogger = createLogger('VacacionModal');
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';

interface VacacionModalProps {
  vacacion: DiasVacacion | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profesionalId?: string;
}

export const VacacionModal: React.FC<VacacionModalProps> = ({
  vacacion,
  isOpen,
  onClose,
  onSuccess,
  profesionalId
}) => {
  const { state: authUser } = useAuth();
  
  const [formData, setFormData] = useState({
    fecha: vacacion?.fecha || '',
    fecha_fin: vacacion?.fecha_fin || '',
    tipo: vacacion?.tipo || 'vacacion',
    motivo: vacacion?.motivo || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Reset form data when vacacion prop changes
  useEffect(() => {
    setFormData({
      fecha: vacacion?.fecha || '',
      fecha_fin: vacacion?.fecha_fin || '',
      tipo: vacacion?.tipo || 'vacacion',
      motivo: vacacion?.motivo || ''
    });
    setErrors({});
  }, [vacacion]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }

    if (formData.fecha_fin && formData.fecha_fin < formData.fecha) {
      newErrors.fecha_fin = 'La fecha de fin debe ser mayor o igual a la fecha de inicio';
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
      const dataForService = {
        fecha: formData.fecha,
        fecha_fin: formData.fecha_fin || undefined,
        tipo: formData.tipo,
        motivo: formData.motivo || undefined,
        ...(profesionalId && { profesional_id: profesionalId })
      };

      vacacionLogger.debug('Guardando vacación', { 
        esEdicion: !!vacacion,
        vacacionId: vacacion?.id
      });
      
      if (vacacion) {
        // Editar vacación existente
        vacacionLogger.debug('Editando vacación', { vacacionId: vacacion.id });
        await disponibilidadService.updateVacacion(vacacion.id, dataForService);
        vacacionLogger.info('Vacación actualizada', { vacacionId: vacacion.id });
      } else {
        // Crear nueva vacación
        vacacionLogger.debug('Creando nueva vacación');
        await disponibilidadService.createVacacion(dataForService);
        vacacionLogger.info('Vacación creada');
      }
      
      // Invalidar caché relacionado de forma segura
      try {
        vacacionLogger.debug('Invalidando caché después de guardar vacación');
        
        const configKey = buildKey(ENTITIES.CONFIGURACION);
        const slotsKey = buildKey(ENTITIES.SLOTS);
        const disponibilidadKey = buildKey(ENTITIES.DISPONIBILIDAD);
        
        vacacionLogger.debug('Invalidando caché', { 
          configKey,
          slotsKey,
          disponibilidadKey
        });
        
        if (configKey && configKey.trim()) {
          cacheService.invalidateByPrefix(configKey);
          vacacionLogger.debug('Caché CONFIGURACION invalidado');
        }
        if (slotsKey && slotsKey.trim()) {
          cacheService.invalidateByPrefix(slotsKey);
          vacacionLogger.debug('Caché SLOTS invalidado');
        }
        if (disponibilidadKey && disponibilidadKey.trim()) {
          cacheService.invalidateByPrefix(disponibilidadKey);
          vacacionLogger.debug('Caché DISPONIBILIDAD invalidado');
        }
      } catch (cacheError) {
        vacacionLogger.warn('Error al invalidar caché', cacheError as Error);
        // No bloquear el flujo principal si falla la invalidación del caché
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      vacacionLogger.error('Error al guardar vacación', error as Error);
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

  const tipos = [
    { value: 'vacacion', label: 'Vacación' },
    { value: 'feriado', label: 'Feriado' },
    { value: 'personal', label: 'Personal' },
    { value: 'enfermedad', label: 'Enfermedad' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vacacion ? 'Editar vacación' : 'Nueva vacación'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio
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
              Fecha de fin (opcional)
            </label>
            <Input
              type="date"
              value={formData.fecha_fin}
              onChange={(e) => handleChange('fecha_fin', e.target.value)}
              min={formData.fecha}
            />
            {errors.fecha_fin && (
              <p className="text-red-500 text-xs mt-1">{errors.fecha_fin}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo
          </label>
          <Select
            value={formData.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            options={tipos}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo (opcional)
          </label>
          <Textarea
            value={formData.motivo}
            onChange={(e) => handleChange('motivo', e.target.value)}
            placeholder="Motivo de la ausencia..."
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
            {vacacion ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
