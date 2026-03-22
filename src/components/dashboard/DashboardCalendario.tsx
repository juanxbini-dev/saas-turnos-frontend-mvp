import React, { useState, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { turnoService } from '../../services/turno.service';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { bloqueoSlotService, BloqueoSlot } from '../../services/bloqueoSlot.service';
import { TurnoConDetalle } from '../../types/turno.types';
import { TurnoPopover } from './TurnoPopover';
import { DashboardTurnoModal } from './DashboardTurnoModal';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';
import { DateHelper } from '../../shared/utils/DateHelper';
import { createLogger } from '../../utils/createLogger';

const dashboardLogger = createLogger('DashboardCalendario');

// Feature flags para migración gradual
const USE_NEW_DATE_HELPER = (window as any).__ENV__?.REACT_APP_USE_NEW_DATE_HELPER === 'true';

// Componente personalizado para slots sin división
const TimeSlotWrapper: React.FC<any> = ({ children }) => (
  <div style={{ 
    border: 'none', 
    padding: '0px', 
    margin: '0px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    {children}
  </div>
);

// Componente personalizado para eventos
const EventComponent: React.FC<any> = ({ event }) => {
  const turno = event.resource as TurnoConDetalle;
  
  return (
    <div style={{ 
      padding: '2px 3px',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#8B5CF6',
      color: 'white',
      fontSize: '10px',
      fontWeight: '600',
      lineHeight: '1.0',
      textAlign: 'left',
      borderRadius: '2px',
      border: 'none',
      margin: '0',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: '1px',
      minHeight: '100%',
      cursor: 'pointer'
    }}>
      <div style={{ 
        fontWeight: '700', 
        fontSize: '9px', 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis',
        width: '100%'
      }}>
        {turno.cliente_nombre}
      </div>
      <div style={{ 
        fontSize: '8px', 
        opacity: 0.9, 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis',
        width: '100%'
      }}>
        {turno.servicio}
      </div>
      <div style={{ 
        fontSize: '7px', 
        opacity: 0.8, 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis',
        width: '100%'
      }}>
        {turno.hora}
      </div>
    </div>
  );
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es },
  messages: {
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    allDay: 'Todo el día',
    week: 'Semana',
    work_week: 'Semana laboral',
    day: 'Día',
    month: 'Mes',
    previous: 'Anterior',
    next: 'Siguiente',
    yesterday: 'Ayer',
    tomorrow: 'Mañana',
    today: 'Hoy',
    agenda: 'Agenda',
    noEventsInRange: 'No hay eventos en este rango.',
    showMore: (total: number) => `+${total} más`
  },
  formats: {
    dateFormat: 'dd MMMM yyyy',
    dayFormat: 'ddd',
    weekdayFormat: 'EEEE',
    dayRangeHeaderFormat: 'dd MMM yyyy',
    agendaHeaderFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: es }),
    agendaDateFormat: (date: Date) => format(date, 'd', { locale: es }),
    agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: es }),
    agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
      `${format(start, 'HH:mm', { locale: es })} - ${format(end, 'HH:mm', { locale: es })}`,
    selectRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
      `${format(start, 'dd MMM yyyy', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`,
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
      `${format(start, 'HH:mm', { locale: es })} - ${format(end, 'HH:mm', { locale: es })}`,
    eventTimeRangeStartFormat: (date: Date) => format(date, 'HH:mm', { locale: es }),
    eventTimeRangeEndFormat: (date: Date) => format(date, 'HH:mm', { locale: es }),
    monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
    dayHeaderFormat: (date: Date) => format(date, 'EEEE d', { locale: es })
  }
});

interface DashboardCalendarioProps {
  profesionalId: string
  color: string
  profesionalNombre: string
  onSlotSelect: (fecha: Date, hora: Date) => void
  onTurnoAction: (turno: TurnoConDetalle) => void
}

export function DashboardCalendario({ 
  profesionalId, 
  color, 
  profesionalNombre,
  onSlotSelect,
  onTurnoAction
}: DashboardCalendarioProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('week');
  const [selectedTurno, setSelectedTurno] = useState<TurnoConDetalle | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; fecha: Date; hora: Date } | null>(null);
  const toast = useToast();

  // Calcular rango de fechas según la vista
  const getDateRange = useCallback((date: Date, view: View) => {
    let start: Date;
    let end: Date;

    if (USE_NEW_DATE_HELPER) {
      switch (view) {
        case 'week':
          const weekRange = DateHelper.getWeekRange(date);
          start = weekRange.start;
          end = weekRange.end;
          break;
        case 'day':
          start = date;
          end = date;
          break;
        case 'month':
          const monthRange = DateHelper.getMonthRange(date);
          start = monthRange.start;
          end = monthRange.end;
          break;
        default:
          const defaultWeekRange = DateHelper.getWeekRange(date);
          start = defaultWeekRange.start;
          end = defaultWeekRange.end;
      }
    } else {
      // Legacy implementation
      switch (view) {
        case 'week':
          start = startOfWeek(date, { weekStartsOn: 1 });
          end = endOfWeek(date, { weekStartsOn: 1 });
          break;
        case 'day':
          start = date;
          end = date;
          break;
        case 'month':
          start = startOfMonth(date);
          end = endOfMonth(date);
          break;
        default:
          start = startOfWeek(date, { weekStartsOn: 1 });
          end = endOfWeek(date, { weekStartsOn: 1 });
      }
    }

    return {
      start: USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(start) : format(start, 'yyyy-MM-dd'),
      end: USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(end) : format(end, 'yyyy-MM-dd')
    };
  }, []);

  const { start: rangoInicio, end: rangoFin } = getDateRange(currentDate, currentView);

  // Cargar turnos con useFetch
  const { data: turnos, revalidate, loading, error } = useFetch(
    buildKey(ENTITIES.CALENDARIO, profesionalId, `${rangoInicio}-${rangoFin}`),
    async () => {
      dashboardLogger.debug('Iniciando petición de turnos', {
        profesionalId,
        rangoInicio,
        rangoFin
      });
      
      try {
        const result = await turnoService.getCalendario(profesionalId, rangoInicio, rangoFin);
        dashboardLogger.info('Respuesta exitosa de turnos', {
          cantidad: result?.length || 0
        });
        return result;
      } catch (error) {
        dashboardLogger.error('Error en petición de turnos', error as Error);
        throw error;
      }
    },
    { ttl: TTL.SHORT }
  );

  dashboardLogger.debug('Estado de turnos', {
    loading,
    hasError: !!error,
    dataLength: turnos?.length || 0
  });

  // Cargar configuración de disponibilidad (incluye intervalo_minutos)
  const { data: configData, loading: loadingConfig } = useFetch(
    profesionalId ? buildKey(ENTITIES.CONFIGURACION, profesionalId) : null,
    async () => {
      if (!profesionalId) return null;
      
      try {
        const config = await disponibilidadService.getConfiguracion();
        dashboardLogger.debug('Configuración obtenida');
        return config;
      } catch (error) {
        dashboardLogger.warn('Error obteniendo configuración', error as Error);
        return null;
      }
    },
    { ttl: TTL.LONG }
  );

  // Cargar disponibilidad de slots para cada día en el rango visible
  const { data: slotsDisponibles, loading: loadingSlots } = useFetch(
    profesionalId ? buildKey(ENTITIES.SLOTS, profesionalId, rangoInicio) : null,
    async () => {
      if (!profesionalId) return [];
      
      // Obtener disponibilidad para cada día en el rango
      const startDate = new Date(rangoInicio);
      const endDate = new Date(rangoFin);
      const slotsPorDia: Record<string, string[]> = {};
      
      // Iterar por cada día en el rango
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const fechaStr = format(date, 'yyyy-MM-dd');
        try {
          const slots = await disponibilidadService.getSlotsDisponibles(profesionalId, fechaStr);
          slotsPorDia[fechaStr] = slots;
        } catch (error) {
          dashboardLogger.warn('Error obteniendo slots', { fecha: fechaStr, error: error as Error });
          slotsPorDia[fechaStr] = [];
        }
      }
      
      return slotsPorDia;
    },
    { ttl: TTL.SHORT }
  );

  // Cargar bloqueos de slots para el rango visible
  const { data: bloqueosSlots, revalidate: revalidateBloqueos } = useFetch(
    profesionalId ? buildKey(ENTITIES.BLOQUEOS, profesionalId, rangoInicio) : null,
    async () => {
      if (!profesionalId) return [];
      return bloqueoSlotService.getByRango(rangoInicio, rangoFin);
    },
    { ttl: TTL.SHORT }
  );

  // Función para obtener el intervalo configurado para un profesional
  const getIntervaloConfigurado = useCallback(() => {
    // Usar el intervalo_minutos de la configuración del profesional
    if (configData?.disponibilidades && configData.disponibilidades.length > 0) {
      // Buscar la configuración para este profesional
      const configProfesional = configData.disponibilidades.find((disp: any) => 
        disp.profesional_id === profesionalId
      );
      
      if (configProfesional?.intervalo_minutos) {
        dashboardLogger.debug('Usando intervalo configurado', { intervalo: configProfesional.intervalo_minutos });
        return configProfesional.intervalo_minutos;
      }
    }
    
    // Fallback: calcular desde slots si no hay configuración
    if (!slotsDisponibles || loadingSlots) return 30; // Default 30 min
    
    // Buscar el primer día que tenga slots para determinar el intervalo
    const primerDiaConSlots = Object.keys(slotsDisponibles as any).find(dia => 
      (slotsDisponibles as any)[dia] && (slotsDisponibles as any)[dia].length > 0
    );
    
    if (primerDiaConSlots && (slotsDisponibles as any)[primerDiaConSlots].length > 1) {
      // Calcular el intervalo entre slots consecutivos
      const slots = (slotsDisponibles as any)[primerDiaConSlots];
      if (slots.length >= 2) {
        const hora1 = USE_NEW_DATE_HELPER ? DateHelper.combineDateTime('2000-01-01', slots[0]) : new Date(`2000-01-01T${slots[0]}:00`);
        const hora2 = USE_NEW_DATE_HELPER ? DateHelper.combineDateTime('2000-01-01', slots[1]) : new Date(`2000-01-01T${slots[1]}:00`);
        const diffMinutos = (hora2.getTime() - hora1.getTime()) / 60000;
        dashboardLogger.debug('Intervalo calculado desde slots', { intervalo: diffMinutos });
        return diffMinutos > 0 ? diffMinutos : 30;
      }
    }
    
    dashboardLogger.debug('Usando intervalo default', { intervalo: 30 });
    return 30; // Default si no se puede determinar
  }, [configData, slotsDisponibles, loadingSlots, profesionalId]);

  const intervaloConfigurado = getIntervaloConfigurado();

  // Función para obtener la hora más temprana disponible
  const getPrimeraHoraDisponible = useCallback(() => {
    if (!slotsDisponibles || loadingSlots) return 8; // Default 8 AM
    
    // Buscar el primer día con slots en la semana actual
    const startDate = new Date(rangoInicio);
    const endDate = new Date(rangoFin);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(date) : format(date, 'yyyy-MM-dd');
      const slotsDelDia = (slotsDisponibles as Record<string, string[]>)[fechaStr] || [];
      
      if (slotsDelDia.length > 0) {
        // Obtener la primera hora disponible y convertirla a número
        const primeraHora = slotsDelDia[0];
        const horaNum = parseInt(primeraHora.split(':')[0]);
        dashboardLogger.debug('Primera hora disponible', { hora: horaNum });
        return horaNum;
      }
    }
    
    return 8; // Default 8 AM si no hay slots
  }, [slotsDisponibles, loadingSlots, rangoInicio, rangoFin]);

  const primeraHoraDisponible = getPrimeraHoraDisponible();

  // Transformar turnos al formato de react-big-calendar
  const events = (turnos || [])
    .filter(turno => {
      // Validar que el turno tenga datos necesarios
      if (!turno.fecha || !turno.hora) {
        dashboardLogger.warn('Turno sin fecha u hora', { turnoId: turno.id });
        return false;
      }
      return true;
    })
    .map(turno => {
      try {
        // Limpiar y formatear la fecha y hora
        const fechaStr = turno.fecha.split('T')[0]; // Eliminar timezone si existe
        const horaStr = turno.hora.split(':')[0] + ':' + turno.hora.split(':')[1]; // Solo HH:MM
        
        dashboardLogger.debug('Procesando fecha/hora', {
          turnoId: turno.id,
          original: { fecha: turno.fecha, hora: turno.hora },
          limpiado: { fecha: fechaStr, hora: horaStr },
          useNewHelper: USE_NEW_DATE_HELPER
        });
        
        const startDate = USE_NEW_DATE_HELPER ? DateHelper.combineDateTime(fechaStr, horaStr) : new Date(`${fechaStr}T${horaStr}:00`);
        
        // Validar que la fecha sea válida
        if (isNaN(startDate.getTime())) {
          dashboardLogger.warn('Fecha inválida', {
            turnoId: turno.id,
            fecha: fechaStr,
            hora: horaStr
          });
          return null;
        }
        
        // IMPORTANTE: Usar la duración del servicio, no el intervalo de disponibilidad
        const duracionServicio = Math.max(turno.duracion_minutos || 60, 60); // Mínimo 60 min
        const endDate = USE_NEW_DATE_HELPER ? DateHelper.addMinutes(startDate, duracionServicio) : new Date(startDate.getTime() + duracionServicio * 60000);
        
        dashboardLogger.debug('Transformando turno', {
          turnoId: turno.id,
          cliente: turno.cliente_nombre,
          servicio: turno.servicio,
          duracion: duracionServicio
        });
        
        return {
          id: turno.id,
          title: `${turno.cliente_nombre} — ${turno.servicio}`,
          start: startDate,
          end: endDate,
          resource: turno
        };
      } catch (error) {
        dashboardLogger.error('Error procesando turno', error as Error, { turnoId: turno.id });
        return null;
      }
    })
    .filter(event => event !== null); // Filtrar eventos nulos

  dashboardLogger.info('Totales de calendario', {
    totalTurnos: turnos?.length || 0,
    totalEvents: events.length
  });

  // Si no hay eventos, crear algunos de ejemplo para pruebas
  const eventsWithDemo = events.length === 0 ? [
    {
      id: 'demo-1',
      title: 'Juan Pérez — Corte de Cabello',
      start: new Date(new Date().setHours(10, 0, 0, 0)),
      end: new Date(new Date().setHours(10, 30, 0, 0)),
      resource: {
        id: 'demo-1',
        cliente_nombre: 'Juan Pérez',
        servicio: 'Corte de Cabello',
        hora: '10:00',
        duracion_minutos: 30
      }
    },
    {
      id: 'demo-2',
      title: 'María García — Tinte',
      start: new Date(new Date().setHours(14, 0, 0, 0)),
      end: new Date(new Date().setHours(15, 0, 0, 0)),
      resource: {
        id: 'demo-2',
        cliente_nombre: 'María García',
        servicio: 'Tinte',
        hora: '14:00',
        duracion_minutos: 60
      }
    }
  ] : events;

  if (events.length === 0) {
    dashboardLogger.debug('Usando eventos de demostración');
  }

  // Función para verificar si un slot está bloqueado puntualmente
  const isSlotBloqueado = useCallback((date: Date) => {
    if (!bloqueosSlots) return false;
    const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(date) : format(date, 'yyyy-MM-dd');
    const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(date) : format(date, 'HH:mm');
    const [h, m] = horaStr.split(':').map(Number);
    const minutos = h * 60 + m;

    return (bloqueosSlots as BloqueoSlot[]).some(b => {
      if (b.fecha.slice(0, 10) !== fechaStr) return false;
      const [bIH, bIM] = b.hora_inicio.split(':').map(Number);
      const [bFH, bFM] = b.hora_fin.split(':').map(Number);
      return minutos >= bIH * 60 + bIM && minutos < bFH * 60 + bFM;
    });
  }, [bloqueosSlots]);

  // Función para verificar si un slot está disponible
  const isSlotAvailable = useCallback((date: Date) => {
    if (!slotsDisponibles || loadingSlots) return false;

    const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(date) : format(date, 'yyyy-MM-dd');
    const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(date) : format(date, 'HH:mm');
    const slotsDelDia = (slotsDisponibles as Record<string, string[]>)[fechaStr] || [];

    return slotsDelDia.includes(horaStr);
  }, [slotsDisponibles, loadingSlots]);

  // Bloquear un slot
  const handleBloquearSlot = useCallback(async (fecha: Date, hora: Date) => {
    const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(fecha) : format(fecha, 'yyyy-MM-dd');
    const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(hora) : format(hora, 'HH:mm');
    const [h, m] = horaStr.split(':').map(Number);
    const intervalo = intervaloConfigurado;
    const finMinutos = h * 60 + m + intervalo;
    const horaFin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;

    try {
      await bloqueoSlotService.create({ fecha: fechaStr, hora_inicio: horaStr, hora_fin: horaFin });
      cacheService.invalidateByPrefix(buildKey(ENTITIES.BLOQUEOS));
      cacheService.invalidateByPrefix(buildKey(ENTITIES.SLOTS));
      revalidateBloqueos();
      toast.success('Horario bloqueado');
    } catch {
      toast.error('Error al bloquear el horario');
    }
    setSlotMenu(null);
  }, [intervaloConfigurado, revalidateBloqueos, toast]);

  // Manejar selección de slot con validación de disponibilidad
  const handleSelectSlot = useCallback((slotInfo: any) => {
    if (!profesionalId) {
      toast.warning('Por favor, selecciona un profesional primero');
      return;
    }

    // Verificar si el slot está disponible
    if (!isSlotAvailable(slotInfo.start)) {
      toast.error('Este horario no está disponible');
      return;
    }

    // Mostrar menú contextual en lugar de abrir directo el modal
    const e = slotInfo.box || slotInfo.bounds;
    const x = e?.clientX ?? e?.x ?? window.innerWidth / 2;
    const y = e?.clientY ?? e?.y ?? window.innerHeight / 2;

    setSlotMenu({ x, y, fecha: slotInfo.start, hora: slotInfo.start });
  }, [isSlotAvailable, profesionalId, toast]);

  // Manejar selección de evento
  const handleSelectEvent = useCallback((event: any, e: React.SyntheticEvent) => {
    const turno = event.resource as TurnoConDetalle;
    setSelectedTurno(turno);
    
    // En lugar de mostrar popover, llamar al callback del padre
    onTurnoAction(turno);
  }, [onTurnoAction]);

  // Manejar cambio de rango
  const handleRangeChange = useCallback((range: any) => {
    // React Big Calendar llama a esto cuando cambia el rango visible
    // El refetch se hace automáticamente por el cambio en las dependencias de useFetch
  }, []);

  // Cancelar turno
  const handleCancelarTurno = useCallback(async (turno: TurnoConDetalle) => {
    try {
      await turnoService.cancelarTurno(turno.id);
      
      // Invalidar caché
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CALENDARIO));
      cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
      
      // Refetch
      revalidate();
      
      toast.success('Turno cancelado correctamente');
    } catch (error) {
      toast.error('Error al cancelar turno');
    }
  }, [revalidate, toast]);

  // Cerrar popover
  const handlePopoverClose = useCallback(() => {
    setPopoverOpen(false);
    setSelectedTurno(null);
  }, []);

  return (
    <div className="h-[700px]">
      {/* Leyenda de disponibilidad */}
      <div className="mb-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-700">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-700">Bloqueado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
          <span className="text-gray-700">No disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 rounded opacity-30"></div>
          <span className="text-gray-700">Fecha pasada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
          <span className="text-gray-700">Turno agendado</span>
        </div>
      </div>

      {/* Menú contextual de slot */}
      {slotMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{ top: slotMenu.y, left: slotMenu.x }}
        >
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
            {format(slotMenu.hora, 'HH:mm')} — {format(slotMenu.fecha, 'dd/MM/yyyy')}
          </div>
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setSlotMenu(null);
              onSlotSelect(slotMenu.fecha, slotMenu.hora);
            }}
          >
            Agendar turno
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={() => handleBloquearSlot(slotMenu.fecha, slotMenu.hora)}
          >
            Bloquear horario
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
            onClick={() => setSlotMenu(null)}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Overlay para cerrar el menú */}
      {slotMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setSlotMenu(null)} />
      )}

      <Calendar
        localizer={localizer}
        events={eventsWithDemo}
        defaultView="week"
        views={['day', 'week', 'month']}
        view={currentView}
        date={currentDate}
        onView={setCurrentView}
        onNavigate={setCurrentDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onRangeChange={handleRangeChange}
        selectable={true}
        step={60}
        timeslots={1}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        resourceAccessor="resource"
        scrollToTime={new Date(new Date().setHours(primeraHoraDisponible, 0, 0, 0))}
        slotPropGetter={(date: Date) => {
          const isAvailable = isSlotAvailable(date);
          const isBloqueado = isSlotBloqueado(date);
          const isPast = date < new Date();

          let backgroundColor = 'transparent';
          if (isBloqueado) backgroundColor = '#EF4444';
          else if (isAvailable) backgroundColor = '#10B981';

          const style: React.CSSProperties = {
            backgroundColor,
            borderColor: isBloqueado ? '#EF4444' : isAvailable ? '#10B981' : '#E5E7EB',
            opacity: isPast ? 0.3 : 1,
            cursor: isAvailable && !isPast ? 'pointer' : 'not-allowed',
            height: '60px',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box'
          };

          return { style };
        }}
        // eventPropGetter={(event) => ({
        //   style: { 
        //     backgroundColor: '#8B5CF6',
        //     borderColor: '#8B5CF6',
        //     borderRadius: '2px',
        //     color: 'white',
        //     border: 'none',
        //     fontSize: '9px',
        //     fontWeight: '600',
        //     padding: '1px 2px',
        //     margin: '0',
        //     overflow: 'hidden',
        //     cursor: 'pointer',
        //     maxWidth: 'calc(100% - 4px)',
        //     maxHeight: 'calc(100% - 4px)',
        //     width: 'auto',
        //     height: 'auto',
        //     left: '2px',
        //     top: '2px',
        //     right: '2px',
        //     display: 'block',
        //     boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        //     boxSizing: 'border-box',
        //     position: 'absolute',
        //     textOverflow: 'ellipsis',
        //     whiteSpace: 'nowrap'
        //   }
        // })}
        components={{
          timeSlotWrapper: TimeSlotWrapper,
          event: EventComponent,
          toolbar: (props) => (
            <div className="rbc-toolbar mb-4">
              <span className="rbc-btn-group">
                <button 
                  type="button" 
                  onClick={() => props.onView('day')}
                  className={props.view === 'day' ? 'rbc-active' : ''}
                >
                  Día
                </button>
                <button 
                  type="button" 
                  onClick={() => props.onView('week')}
                  className={props.view === 'week' ? 'rbc-active' : ''}
                >
                  Semana
                </button>
                <button 
                  type="button" 
                  onClick={() => props.onView('month')}
                  className={props.view === 'month' ? 'rbc-active' : ''}
                >
                  Mes
                </button>
              </span>
              <span className="rbc-toolbar-label">{props.label}</span>
              <span className="rbc-btn-group">
                <button 
                  type="button" 
                  onClick={() => props.onNavigate('PREV')}
                >
                  Anterior
                </button>
                <button 
                  type="button" 
                  onClick={() => props.onNavigate('TODAY')}
                >
                  Hoy
                </button>
                <button 
                  type="button" 
                  onClick={() => props.onNavigate('NEXT')}
                >
                  Siguiente
                </button>
              </span>
            </div>
          )
        }}
        messages={{
          today: 'Hoy',
          previous: 'Anterior',
          next: 'Siguiente',
          month: 'Mes',
          week: 'Semana',
          day: 'Día',
          agenda: 'Agenda',
          noEventsInRange: 'Sin turnos en este período'
        }}
      />

    </div>
  );
}
