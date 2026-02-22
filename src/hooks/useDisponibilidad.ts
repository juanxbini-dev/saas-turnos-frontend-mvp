import { useState, useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { disponibilidadService } from '../services/disponibilidad.service';

export const useDisponibilidad = (profesionalId: string | null) => {
  console.log('🔍 [useDisponibilidad] Hook inicializado con profesionalId:', profesionalId);
  
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [año, setAño] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Obtener días disponibles del mes
  console.log('🔍 [useDisponibilidad] Configurando useFetch con:', { profesionalId, mes, año });
  const cacheKey = profesionalId ? buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}`) : null;
  console.log('🔍 [useDisponibilidad] Cache key:', cacheKey);
  
  // Forzar nueva petición (sin caché)
  const {
    data: availableDates,
    loading: loadingDates,
    error: datesError,
    revalidate: revalidateDates
  } = useFetch(
    cacheKey,
    () => {
      console.log('🔍 [useDisponibilidad] Fetcher llamado con:', { profesionalId, mes, año });
      if (!profesionalId) {
        console.log('🔍 [useDisponibilidad] profesionalId es null, retornando array vacío');
        return Promise.resolve([]);
      }
      return disponibilidadService.getDisponibilidadMes(profesionalId, mes, año);
    },
    { ttl: 1 } // 1 segundo para forzar nueva petición
  );

  // Obtener slots disponibles para una fecha específica
  const {
    data: slots,
    loading: loadingSlots,
    error: slotsError,
    revalidate: revalidateSlots
  } = useFetch(
    selectedDate ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate) : null,
    () => selectedDate ? disponibilidadService.getSlotsDisponibles(profesionalId!, selectedDate) : Promise.resolve([]),
    { ttl: 300, enabled: !!selectedDate }
  );

  const handleMonthChange = useCallback((newMes: number, newAño: number) => {
    console.log('🔍 [useDisponibilidad] handleMonthChange called:', { newMes, newAño });
    setMes(newMes);
    setAño(newAño);
    setSelectedDate(null);
    setSelectedSlot(null);
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSlotSelect = useCallback((slot: string) => {
    setSelectedSlot(slot);
  }, []);

  const reset = useCallback(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
  }, []);

  // Función temporal para debugging
  const forceRefresh = useCallback(() => {
    console.log('🔍 [useDisponibilidad] Force refresh llamado');
    revalidateDates();
  }, [revalidateDates]);

  return {
    // Estado
    mes,
    año,
    selectedDate,
    selectedSlot,
    
    // Datos
    availableDates: availableDates || [],
    slots: slots || [],
    
    // Loading states
    loadingDates,
    loadingSlots,
    
    // Errors
    datesError,
    slotsError,
    
    // Actions
    handleMonthChange,
    handleDateSelect,
    handleSlotSelect,
    reset,
    
    // Revalidations
    revalidateDates,
    revalidateSlots,
    forceRefresh  // Temporal para debugging
  };
};
