import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Textarea } from '../ui';
import { ExcepcionDia } from '../../types/turno.types';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { useAuth } from '../../context/AuthContext';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';

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
  const { state: authUser } = useAuth();
  
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

  // Reset form data when excepcion prop changes
  useEffect(() => {
    setFormData({
      fecha: excepcion?.fecha || '',
      disponible: excepcion?.disponible ?? true,
      hora_inicio: excepcion?.hora_inicio || '',
      hora_fin: excepcion?.hora_fin || '',
      intervalo_minutos: excepcion?.intervalo_minutos?.toString() || '30',
      notas: excepcion?.notas || ''
    });
    setErrors({});
  }, [excepcion]);

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
      const dataForService = {
        fecha: formData.fecha,
        disponible: formData.disponible,
        ...(formData.disponible && {
          hora_inicio: formData.hora_inicio,
          hora_fin: formData.hora_fin,
          intervalo_minutos: parseInt(formData.intervalo_minutos)
        }),
        notas: formData.notas || undefined
      };

      console.log('🔍 [ExcepcionModal] Guardando excepción:', dataForService);
      console.log('🔍 [ExcepcionModal] excepcion:', excepcion);
      console.log('🔍 [ExcepcionModal] Es edición?', !!excepcion);
      
      if (excepcion) {
        // Editar excepción existente
        console.log('🔍 [ExcepcionModal] Editando excepción ID:', excepcion.id);
        await disponibilidadService.updateExcepcion(excepcion.id, dataForService);
        console.log('✅ [ExcepcionModal] Excepción actualizada');
      } else {
        // Crear nueva excepción
        console.log('🔍 [ExcepcionModal] Creando nueva excepción');
        await disponibilidadService.createExcepcion(dataForService);
        console.log('✅ [ExcepcionModal] Excepción creada');
      }
      
      // Invalidar caché relacionado de forma segura
      try {
        const configKey = buildKey(ENTITIES.CONFIGURACION);
        const slotsKey = buildKey(ENTITIES.SLOTS);
        
        console.log('🔍 [ExcepcionModal] Invalidando caché - configKey:', configKey, 'slotsKey:', slotsKey);
        
        if (configKey && configKey.trim()) {
          cacheService.invalidateByPrefix(configKey);
          console.log('✅ [ExcepcionModal] Caché CONFIGURACION invalidado');
        }
        if (slotsKey && slotsKey.trim()) {
          cacheService.invalidateByPrefix(slotsKey);
          console.log('✅ [ExcepcionModal] Caché SLOTS invalidado');
        }
      } catch (cacheError) {
        console.warn('⚠️ [ExcepcionModal] Error al invalidar caché:', cacheError);
        // No bloquear el flujo principal si falla la invalidación del caché
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('💥 [ExcepcionModal] Error al guardar excepción:', error);
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
            onChange={(e) => handleChange('disponible', e.target.value === 'true')}
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
                onChange={(e) => handleChange('intervalo_minutos', e.target.value)}
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
