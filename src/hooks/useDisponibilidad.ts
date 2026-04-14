import { useState, useCallback, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { createLogger } from '../utils/createLogger';
import { cacheService } from '../cache/cache.service';

const disponibilidadLogger = createLogger('useDisponibilidad');
import { disponibilidadService } from '../services/disponibilidad.service';
import { DateHelper } from '../shared/utils/DateHelper';

// Feature flags para migración gradual
const USE_NEW_DATE_HELPER = (window as any).__ENV__?.REACT_APP_USE_NEW_DATE_HELPER === 'true';

export const useDisponibilidad = (profesionalId: string | null) => {
  disponibilidadLogger.debug('Hook inicializado', { profesionalId });
  
  // Usar DateHelper para obtener fecha actual
  const today = USE_NEW_DATE_HELPER ? DateHelper.today() : new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [año, setAño] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Obtener días disponibles del mes
  disponibilidadLogger.debug('Configurando useFetch', { profesionalId, mes, año });
  const cacheKey = profesionalId ? buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}`) : null;
  disponibilidadLogger.debug('Cache key', { cacheKey });
  
  // Forzar nueva petición (sin caché)
  const {
    data: availableDates,
    loading: loadingDates,
    error: datesError,
    revalidate: revalidateDates
  } = useFetch(
    cacheKey,
    () => {
      disponibilidadLogger.debug('Fetcher llamado', { profesionalId, mes, año });
      if (!profesionalId) {
        disponibilidadLogger.debug('profesionalId es null, retornando array vacío');
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
    { ttl: 5 }
  );

  // Logging para depurar caché
  useEffect(() => {
    disponibilidadLogger.debug('Slots actualizados', {
      selectedDate,
      profesionalId,
      slotsCount: slots?.length || 0,
      loadingSlots,
      hasError: !!slotsError
    });
  }, [slots, selectedDate, profesionalId, loadingSlots, slotsError]);

  const handleMonthChange = useCallback((newMes: number, newAño: number) => {
    disponibilidadLogger.debug('handleMonthChange llamado', { newMes, newAño });
    setMes(newMes);
    setAño(newAño);
    setSelectedDate(null);
    setSelectedSlot(null);
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    disponibilidadLogger.debug('handleDateSelect llamado', { date });
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
    disponibilidadLogger.debug('Force refresh - limpiando caché');
    
    // Invalidar caché específico para el profesional actual
    if (profesionalId) {
      const disponibilidadKey = buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}`);
      const slotsKey = selectedDate ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate) : null;
      
      disponibilidadLogger.debug('Invalidando - disponibilidadKey', { disponibilidadKey });
      disponibilidadLogger.debug('Invalidando - slotsKey', { slotsKey });
      
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
