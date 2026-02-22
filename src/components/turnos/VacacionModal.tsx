import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Textarea } from '../ui';
import { DiasVacacion } from '../../types/turno.types';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { useAuth } from '../../context/AuthContext';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';

interface VacacionModalProps {
  vacacion: DiasVacacion | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VacacionModal: React.FC<VacacionModalProps> = ({
  vacacion,
  isOpen,
  onClose,
  onSuccess
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
        motivo: formData.motivo || undefined
      };

      console.log('🔍 [VacacionModal] Guardando vacación:', dataForService);
      console.log('🔍 [VacacionModal] vacacion:', vacacion);
      console.log('🔍 [VacacionModal] Es edición?', !!vacacion);
      
      if (vacacion) {
        // Editar vacación existente
        console.log('🔍 [VacacionModal] Editando vacación ID:', vacacion.id);
        await disponibilidadService.updateVacacion(vacacion.id, dataForService);
        console.log('✅ [VacacionModal] Vacación actualizada');
      } else {
        // Crear nueva vacación
        console.log('🔍 [VacacionModal] Creando nueva vacación');
        await disponibilidadService.createVacacion(dataForService);
        console.log('✅ [VacacionModal] Vacación creada');
      }
      
      // Invalidar caché relacionado de forma segura
      try {
        console.log('🔍 [VacacionModal] Invalidando caché después de guardar vacación...');
        
        const configKey = buildKey(ENTITIES.CONFIGURACION);
        const slotsKey = buildKey(ENTITIES.SLOTS);
        const disponibilidadKey = buildKey(ENTITIES.DISPONIBILIDAD);
        
        console.log('🔍 [VacacionModal] Invalidando caché - configKey:', configKey, 'slotsKey:', slotsKey, 'disponibilidadKey:', disponibilidadKey);
        
        if (configKey && configKey.trim()) {
          cacheService.invalidateByPrefix(configKey);
          console.log('✅ [VacacionModal] Caché CONFIGURACION invalidado');
        }
        if (slotsKey && slotsKey.trim()) {
          cacheService.invalidateByPrefix(slotsKey);
          console.log('✅ [VacacionModal] Caché SLOTS invalidado');
        }
        if (disponibilidadKey && disponibilidadKey.trim()) {
          cacheService.invalidateByPrefix(disponibilidadKey);
          console.log('✅ [VacacionModal] Caché DISPONIBILIDAD invalidado');
        }
      } catch (cacheError) {
        console.warn('⚠️ [VacacionModal] Error al invalidar caché:', cacheError);
        // No bloquear el flujo principal si falla la invalidación del caché
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('💥 [VacacionModal] Error al guardar vacación:', error);
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
