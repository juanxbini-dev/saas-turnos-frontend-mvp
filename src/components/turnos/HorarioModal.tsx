import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { DisponibilidadSemanal } from '../../types/turno.types';
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/createLogger';
import { cacheService } from '../../cache/cache.service';

const horarioLogger = createLogger('HorarioModal');
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';

interface HorarioModalProps {
  horario: DisponibilidadSemanal | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profesionalId?: string;
}

// Orden de visualización: Lunes primero, Domingo último
const diasSemana = [
  { value: 1, label: 'Lunes', corto: 'Lun' },
  { value: 2, label: 'Martes', corto: 'Mar' },
  { value: 3, label: 'Miércoles', corto: 'Mié' },
  { value: 4, label: 'Jueves', corto: 'Jue' },
  { value: 5, label: 'Viernes', corto: 'Vie' },
  { value: 6, label: 'Sábado', corto: 'Sáb' },
  { value: 0, label: 'Domingo', corto: 'Dom' },
];

const intervalos = [
  { value: '60', label: '1 hora' },
  { value: '120', label: '2 horas' }
];

// Expande un rango de días [inicio..fin] a un array de días individuales
const expandirRango = (inicio: number, fin: number): number[] => {
  const dias: number[] = [];
  for (let d = inicio; d <= fin; d++) dias.push(d);
  return dias;
};

export const HorarioModal: React.FC<HorarioModalProps> = ({
  horario,
  isOpen,
  onClose,
  onSuccess,
  profesionalId
}) => {
  const { state: authUser } = useAuth();
  const efectivoProfesionalId = profesionalId || authUser?.authUser?.id || '';

  const diasIniciales = horario ? expandirRango(horario.dia_inicio, horario.dia_fin) : [];

  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>(diasIniciales);
  const [formData, setFormData] = useState({
    hora_inicio: horario?.hora_inicio?.slice(0, 5) || '09:00',
    hora_fin: horario?.hora_fin?.slice(0, 5) || '17:00',
    intervalo_minutos: horario?.intervalo_minutos?.toString() || '60'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [diasSolapados, setDiasSolapados] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset cuando cambia el horario que se está editando
  useEffect(() => {
    setDiasSeleccionados(horario ? expandirRango(horario.dia_inicio, horario.dia_fin) : []);
    setFormData({
      hora_inicio: horario?.hora_inicio?.slice(0, 5) || '09:00',
      hora_fin: horario?.hora_fin?.slice(0, 5) || '17:00',
      intervalo_minutos: horario?.intervalo_minutos?.toString() || '60'
    });
    setErrors({});
    setDiasSolapados([]);
  }, [horario]);

  const toggleDia = (dia: number) => {
    setDiasSolapados([]);
    setDiasSeleccionados(prev =>
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    );
    if (errors.dias) setErrors(prev => ({ ...prev, dias: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (diasSeleccionados.length === 0) {
      newErrors.dias = 'Seleccioná al menos un día';
    }

    if (formData.hora_fin <= formData.hora_inicio) {
      newErrors.hora_fin = 'La hora de fin debe ser mayor a la hora de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const invalidarCache = () => {
    try {
      [ENTITIES.CONFIGURACION, ENTITIES.SLOTS, ENTITIES.DISPONIBILIDAD].forEach(entity => {
        const key = buildKey(entity);
        if (key && key.trim()) cacheService.invalidateByPrefix(key);
      });
    } catch (cacheError) {
      horarioLogger.warn('Error al invalidar caché', cacheError as Error);
    }
  };

  // ¿El error de axios es un 409 (solapamiento)? Esos se reportan, no se tratan como fallo total.
  const esSolapamiento = (err: any): boolean => err?.response?.status === 409;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const dias = [...diasSeleccionados].sort((a, b) => a - b);
    const base = {
      profesional_id: efectivoProfesionalId,
      hora_inicio: formData.hora_inicio,
      hora_fin: formData.hora_fin,
      intervalo_minutos: parseInt(formData.intervalo_minutos)
    };

    setLoading(true);
    const solapados: number[] = [];
    try {
      if (horario) {
        // Editar: la fila original toma el primer día; los demás se crean como filas nuevas.
        const [primero, ...resto] = dias;
        await disponibilidadService.updateDisponibilidad(horario.id, {
          ...base,
          dia_inicio: primero,
          dia_fin: primero
        });
        for (const d of resto) {
          try {
            await disponibilidadService.createDisponibilidad({ ...base, dia_inicio: d, dia_fin: d });
          } catch (err) {
            if (esSolapamiento(err)) solapados.push(d);
            else throw err;
          }
        }
      } else {
        // Crear: una fila por día seleccionado
        for (const d of dias) {
          try {
            await disponibilidadService.createDisponibilidad({ ...base, dia_inicio: d, dia_fin: d });
          } catch (err) {
            if (esSolapamiento(err)) solapados.push(d);
            else throw err;
          }
        }
      }

      invalidarCache();

      if (solapados.length > 0) {
        // Algunos días no se pudieron crear por solaparse con un horario existente
        setDiasSolapados(solapados);
        // Si TODOS los días fallaron, no cerramos para que el usuario corrija
        const creadosAlMenosUno = solapados.length < dias.length || !!horario;
        if (creadosAlMenosUno) {
          onSuccess();
        }
      } else {
        onSuccess();
        onClose();
      }
    } catch (error) {
      horarioLogger.error('Error al guardar horario', error as Error);
      setErrors({ general: 'Ocurrió un error al guardar. Intentá de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const nombresDias = (valores: number[]) =>
    valores
      .map(v => diasSemana.find(d => d.value === v)?.corto)
      .filter(Boolean)
      .join(', ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={horario ? 'Editar horario' : 'Nuevo horario'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Días {horario ? '' : '(podés elegir varios)'}
          </label>
          <div className="flex flex-wrap gap-2">
            {diasSemana.map(dia => {
              const activo = diasSeleccionados.includes(dia.value);
              return (
                <button
                  key={dia.value}
                  type="button"
                  onClick={() => toggleDia(dia.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    activo
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {dia.corto}
                </button>
              );
            })}
          </div>
          {errors.dias && <p className="text-red-500 text-xs mt-1">{errors.dias}</p>}
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
            onChange={(e) => handleChange('intervalo_minutos', e.target.value)}
            options={intervalos}
          />
        </div>

        {diasSolapados.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-amber-700 text-sm">
              Estos días ya tenían un horario que se cruza y no se agregaron: <strong>{nombresDias(diasSolapados)}</strong>.
              El resto se guardó correctamente.
            </p>
          </div>
        )}

        {errors.general && (
          <p className="text-red-500 text-sm">{errors.general}</p>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {diasSolapados.length > 0 ? 'Cerrar' : 'Cancelar'}
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
