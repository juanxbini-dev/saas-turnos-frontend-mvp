import { useState, useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { disponibilidadService } from '../services/disponibilidad.service';

export const useDisponibilidad = (profesionalId: string) => {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [año, setAño] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Obtener días disponibles del mes
  const {
    data: availableDates,
    loading: loadingDates,
    error: datesError,
    revalidate: revalidateDates
  } = useFetch(
    buildKey(ENTITIES.DISPONIBILIDAD, profesionalId, `${mes}-${año}`),
    () => disponibilidadService.getDisponibilidadMes(profesionalId, mes, año),
    { ttl: 300 } // 5 minutos
  );

  // Obtener slots disponibles para una fecha específica
  const {
    data: slots,
    loading: loadingSlots,
    error: slotsError,
    revalidate: revalidateSlots
  } = useFetch(
    selectedDate ? buildKey(ENTITIES.SLOTS, profesionalId, selectedDate) : null,
    () => selectedDate ? disponibilidadService.getSlotsDisponibles(profesionalId, selectedDate as string) : Promise.resolve([]),
    { ttl: 300, enabled: !!selectedDate }
  );

  const handleMonthChange = useCallback((newMes: number, newAño: number) => {
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
    revalidateSlots
  };
};
