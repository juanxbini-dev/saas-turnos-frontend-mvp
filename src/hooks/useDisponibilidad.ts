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

// servicioId: string → filtra por duración del servicio
//             null    → no fetcha (el servicio es paso previo obligatorio)
//             undefined → fetcha sin filtro de servicio (comportamiento legacy/dashboard)
export const useDisponibilidad = (profesionalId: string | null, servicioId?: string | null) => {
  disponibilidadLogger.debug('Hook inicializado', { profesionalId, servicioId });

  const today = USE_NEW_DATE_HELPER ? DateHelper.today() : new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [año, setAño] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Resetear fecha/slot cuando cambia el servicio seleccionado
  useEffect(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
  }, [servicioId]);

  // servicioId=null significa "no buscar aún" (servicio es paso previo)
  const debesFetchear = profesionalId !== null && servicioId !== null;
  const cacheKey = debesFetchear
    ? buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}-${servicioId ?? 'todos'}`)
    : null;

  disponibilidadLogger.debug('Cache key', { cacheKey });

  const {
    data: availableDates,
    loading: loadingDates,
    error: datesError,
    revalidate: revalidateDates
  } = useFetch(
    cacheKey,
    () => {
      disponibilidadLogger.debug('Fetcher llamado', { profesionalId, mes, año, servicioId });
      if (!profesionalId) return Promise.resolve([]);
      return disponibilidadService.getDisponibilidadMes(
        profesionalId,
        mes,
        año,
        servicioId ?? undefined
      );
    },
    { ttl: 1 }
  );

  // Slots: incluir servicioId en cache key para que diferentes servicios no compartan caché
  const slotsCacheKey = selectedDate && profesionalId && servicioId !== null
    ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate, servicioId ?? 'todos')
    : null;

  const {
    data: slots,
    loading: loadingSlots,
    error: slotsError,
    revalidate: revalidateSlots
  } = useFetch(
    slotsCacheKey,
    () => {
      if (!selectedDate || !profesionalId) return Promise.resolve([]);
      return disponibilidadService.getSlotsDisponibles(profesionalId, selectedDate, servicioId ?? undefined);
    },
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

    if (profesionalId) {
      const disponibilidadKey = buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}-${servicioId ?? 'todos'}`);
      const slotsKey = selectedDate
        ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate, servicioId ?? 'todos')
        : null;

      disponibilidadLogger.debug('Invalidando - disponibilidadKey', { disponibilidadKey });
      disponibilidadLogger.debug('Invalidando - slotsKey', { slotsKey });

      cacheService.invalidate(disponibilidadKey);
      if (slotsKey) cacheService.invalidate(slotsKey);

      setTimeout(() => {
        revalidateDates();
        if (selectedDate) revalidateSlots();
      }, 100);
    }
  }, [profesionalId, mes, año, selectedDate, servicioId, revalidateDates, revalidateSlots]);

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
