import { useState, useCallback, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { cacheService } from '../cache/cache.service';
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
    selectedDate && profesionalId ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate) : null,
    () => selectedDate && profesionalId ? disponibilidadService.getSlotsDisponibles(profesionalId, selectedDate) : Promise.resolve([]),
    { ttl: 30 }
  );

  // Logging para depurar caché
  useEffect(() => {
    console.log('🔍 [useDisponibilidad] Slots actualizados:', {
      selectedDate,
      profesionalId,
      slots,
      loadingSlots,
      slotsError,
      slotsLength: slots?.length || 0
    });
  }, [slots, selectedDate, profesionalId, loadingSlots, slotsError]);

  const handleMonthChange = useCallback((newMes: number, newAño: number) => {
    console.log('🔍 [useDisponibilidad] handleMonthChange called:', { newMes, newAño });
    setMes(newMes);
    setAño(newAño);
    setSelectedDate(null);
    setSelectedSlot(null);
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    console.log('🔍 [useDisponibilidad] handleDateSelect called:', date);
    setSelectedDate(date);
    setSelectedSlot(null);
    
    // Forzar revalidación de slots para la nueva fecha
    setTimeout(() => {
      revalidateSlots();
    }, 100);
  }, [revalidateSlots]);

  const handleSlotSelect = useCallback((slot: string) => {
    setSelectedSlot(slot);
  }, []);

  const reset = useCallback(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
  }, []);

  // Función temporal para debugging y limpieza de caché
  const forceRefresh = useCallback(() => {
    console.log('🔍 [useDisponibilidad] Force refresh llamado - limpiando caché...');
    
    // Invalidar caché específico para el profesional actual
    if (profesionalId) {
      const disponibilidadKey = buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}`);
      const slotsKey = selectedDate ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate) : null;
      
      console.log('🔍 [useDisponibilidad] Invalidando - disponibilidadKey:', disponibilidadKey);
      console.log('🔍 [useDisponibilidad] Invalidando - slotsKey:', slotsKey);
      
      cacheService.invalidate(disponibilidadKey);
      if (slotsKey) {
        cacheService.invalidate(slotsKey);
      }
      
      // Forzar revalidación
      setTimeout(() => {
        revalidateDates();
        if (selectedDate) {
          revalidateSlots();
        }
      }, 100);
    }
  }, [profesionalId, mes, año, selectedDate, revalidateDates, revalidateSlots]);

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
