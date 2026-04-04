import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar';
import { format, parse, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
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

// Factory para el componente de evento con color dinámico
const makeEventComponent = (color: string): React.FC<any> => ({ event, title }) => {
  const turno = event.resource as TurnoConDetalle;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showServicio, setShowServicio] = React.useState(true);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setShowServicio(el.offsetHeight >= 38);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        padding: '3px 5px 3px 8px',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: color,
        color: 'white',
        borderLeft: '3px solid rgba(255,255,255,0.6)',
        borderRadius: '2px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1px',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: '700', fontSize: '12px', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {turno.cliente_nombre}
      </div>
      {showServicio && (
        <div style={{ fontSize: '10px', opacity: 0.85, lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {turno.servicio}
        </div>
      )}
    </div>
  );
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

const calendarFormats = {
  dateFormat: 'dd MMMM yyyy',
  dayFormat: (date: Date) => format(date, 'EEE d', { locale: es }),
  weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'dd MMM yyyy', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`,
  agendaHeaderFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: es }),
  agendaDateFormat: (date: Date) => format(date, 'd', { locale: es }),
  agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: es }),
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'HH:mm', { locale: es })} - ${format(end, 'HH:mm', { locale: es })}`,
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'dd MMM yyyy', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`,
  eventTimeRangeFormat: () => '',
  eventTimeRangeStartFormat: () => '',
  eventTimeRangeEndFormat: () => '',
  monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
  dayHeaderFormat: (date: Date) => format(date, 'EEEE d', { locale: es }),
};

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [currentView, setCurrentView] = useState<View>(() => window.innerWidth < 640 ? 'day' : 'week');

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [selectedTurno, setSelectedTurno] = useState<TurnoConDetalle | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; fecha: Date; hora: Date; bloqueoId?: string; noDisponible?: boolean } | null>(null);
  const toast = useToast();
  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMovedRef = React.useRef(false);
  const lastPointerRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
  const { data: slotsDisponibles, loading: loadingSlots, revalidate: revalidateSlots } = useFetch(
    profesionalId ? buildKey(ENTITIES.SLOTS, profesionalId, rangoInicio) : null,
    async () => {
      if (!profesionalId) return [];
      return disponibilidadService.getSlotsRango(profesionalId, rangoInicio, rangoFin);
    },
    { ttl: TTL.SHORT }
  );

  // Cargar bloqueos de slots para el rango visible
  const { data: bloqueosSlots, revalidate: revalidateBloqueos } = useFetch(
    profesionalId ? buildKey(ENTITIES.BLOQUEOS, profesionalId, rangoInicio) : null,
    async () => {
      if (!profesionalId) return [];
      return bloqueoSlotService.getByRango(rangoInicio, rangoFin, profesionalId);
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

  // Hora de inicio de la jornada según el horario semanal configurado
  // Usa configData (TTL 30min) en lugar de slots para estar disponible desde el primer render
  const primeraHoraDisponible = useMemo(() => {
    const disponibilidades = configData?.disponibilidades;
    if (!disponibilidades?.length) return 8;
    const horas = disponibilidades
      .filter((d: any) => d.activo)
      .map((d: any) => parseInt(d.hora_inicio.split(':')[0]));
    return horas.length ? Math.min(...horas) : 8;
  }, [configData]);

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

  const eventsWithDemo = events;

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

  // Obtener el bloqueo que cubre una fecha/hora específica
  const getBloqueoEnSlot = useCallback((date: Date): BloqueoSlot | null => {
    if (!bloqueosSlots) return null;
    const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(date) : format(date, 'yyyy-MM-dd');
    const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(date) : format(date, 'HH:mm');
    const [h, m] = horaStr.split(':').map(Number);
    const minutos = (h ?? 0) * 60 + (m ?? 0);

    return (bloqueosSlots as BloqueoSlot[]).find(b => {
      if (b.fecha.slice(0, 10) !== fechaStr) return false;
      const iParts = b.hora_inicio.split(':').map(Number);
      const fParts = b.hora_fin.split(':').map(Number);
      return minutos >= (iParts[0] ?? 0) * 60 + (iParts[1] ?? 0) && minutos < (fParts[0] ?? 0) * 60 + (fParts[1] ?? 0);
    }) ?? null;
  }, [bloqueosSlots]);

  // Desbloquear un slot
  const handleDesbloquearSlot = useCallback(async (bloqueoId: string) => {
    try {
      await bloqueoSlotService.remove(bloqueoId);
      cacheService.invalidateByPrefix(buildKey(ENTITIES.BLOQUEOS));
      cacheService.invalidateByPrefix(buildKey(ENTITIES.SLOTS));
      revalidateBloqueos();
      toast.success('Horario desbloqueado');
    } catch {
      toast.error('Error al desbloquear el horario');
    }
    setSlotMenu(null);
  }, [revalidateBloqueos, toast]);

  // Bloquear un slot
  const handleBloquearSlot = useCallback(async (fecha: Date, hora: Date) => {
    const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(fecha) : format(fecha, 'yyyy-MM-dd');
    const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(hora) : format(hora, 'HH:mm');
    const [h, m] = horaStr.split(':').map(Number);
    const intervalo = intervaloConfigurado;
    const finMinutos = h * 60 + m + intervalo;
    const horaFin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;

    try {
      await bloqueoSlotService.create({ fecha: fechaStr, hora_inicio: horaStr, hora_fin: horaFin, profesional_id: profesionalId });
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

    const e = slotInfo.box || slotInfo.bounds;
    const menuW = 190;
    const menuH = 160;
    const raw = lastPointerRef.current;
    const x = Math.max(8, Math.min(raw.x, window.innerWidth - menuW - 8));
    const y = Math.max(8, Math.min(raw.y, window.innerHeight - menuH - 8));

    // Si el slot está bloqueado, mostrar opción de desbloquear
    const bloqueo = getBloqueoEnSlot(slotInfo.start);
    if (bloqueo) {
      setSlotMenu({ x, y, fecha: slotInfo.start, hora: slotInfo.start, bloqueoId: bloqueo.id });
      return;
    }

    // Slot fuera del horario habitual: ofrecer habilitarlo
    if (!isSlotAvailable(slotInfo.start)) {
      const isPast = slotInfo.start < new Date();
      if (!isPast) {
        setSlotMenu({ x, y, fecha: slotInfo.start, hora: slotInfo.start, noDisponible: true });
      }
      return;
    }

    // Slot disponible: mostrar menú para agendar o bloquear
    setSlotMenu({ x, y, fecha: slotInfo.start, hora: slotInfo.start });
  }, [isSlotAvailable, getBloqueoEnSlot, profesionalId, toast]);

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

  // Habilitar un slot fuera del horario habitual como excepción adicional
  const handleHabilitarSlot = useCallback(async (fecha: Date, hora: Date) => {
    try {
      const fechaStr = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(fecha) : format(fecha, 'yyyy-MM-dd');
      const horaStr = USE_NEW_DATE_HELPER ? DateHelper.formatTime(hora) : format(hora, 'HH:mm');
      const intervalo = getIntervaloConfigurado();

      const [h, m] = horaStr.split(':').map(Number);
      const finMinutos = (h ?? 0) * 60 + (m ?? 0) + intervalo;
      const horaFin = `${Math.floor(finMinutos / 60).toString().padStart(2, '0')}:${(finMinutos % 60).toString().padStart(2, '0')}`;

      await disponibilidadService.createExcepcion({
        fecha: fechaStr,
        disponible: true,
        tipo: 'adicional',
        hora_inicio: horaStr,
        hora_fin: horaFin,
        intervalo_minutos: intervalo,
        profesional_id: profesionalId,
      });

      cacheService.invalidateByPrefix(buildKey(ENTITIES.SLOTS));
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CONFIGURACION));
      revalidateSlots();
      setSlotMenu(null);
      toast.success(`Horario ${horaStr} habilitado`);
    } catch {
      toast.error('Error al habilitar el horario');
    }
  }, [getIntervaloConfigurado, revalidateSlots, toast]);

  // Cerrar popover
  const handlePopoverClose = useCallback(() => {
    setPopoverOpen(false);
    setSelectedTurno(null);
  }, []);

  const calendarHeight = isMobile ? 480 : 650;

  return (
    <div className="flex flex-col gap-3">
      {/* Leyenda de disponibilidad */}
      <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-700">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-700">Bloqueado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border border-gray-300 rounded bg-black/[.03]"></div>
          <span className="text-gray-700">Habilitable</span>
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

      {/* Aviso de uso en mobile */}
      {isMobile && (
        <div className="flex items-center gap-2 mx-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <span>💡</span>
          <span>Mantené apretado un slot para ver las acciones disponibles.</span>
        </div>
      )}

      {/* Menú contextual de slot — renderizado via Portal para evitar problemas con position:fixed en mobile */}
      {slotMenu && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSlotMenu(null)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{ top: slotMenu.y, left: slotMenu.x }}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
              {format(slotMenu.hora, 'HH:mm')} — {format(slotMenu.fecha, 'dd/MM/yyyy')}
            </div>
            {slotMenu.bloqueoId ? (
              <button
                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                onClick={() => handleDesbloquearSlot(slotMenu.bloqueoId!)}
              >
                Desbloquear horario
              </button>
            ) : slotMenu.noDisponible ? (
              <button
                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                onClick={() => handleHabilitarSlot(slotMenu.fecha, slotMenu.hora)}
              >
                Habilitar este horario
              </button>
            ) : (
              <>
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
              </>
            )}
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
              onClick={() => setSlotMenu(null)}
            >
              Cancelar
            </button>
          </div>
        </>,
        document.body
      )}

      <div
        style={{ height: calendarHeight }}
        onMouseDown={(e) => { lastPointerRef.current = { x: e.clientX, y: e.clientY }; }}
        onTouchStart={(e) => {
          lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          if (!isMobile) return;
          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
          touchMovedRef.current = false;
        }}
        onTouchMove={isMobile ? (e) => {
          if (!touchStartRef.current) return;
          const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
          const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
          if (dx > 5 || dy > 5) touchMovedRef.current = true;
        } : undefined}
        onTouchEnd={isMobile ? (e) => {
          if (!touchStartRef.current || touchMovedRef.current) return;
          const elapsed = Date.now() - touchStartRef.current.time;
          if (elapsed < 300) {
            // Tap rápido: simular click en el elemento tocado
            const touch = e.changedTouches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
            el?.click();
          }
          touchStartRef.current = null;
        } : undefined}
      >
      <Calendar
        localizer={localizer}
        culture="es"
        formats={calendarFormats}
        events={eventsWithDemo}
        defaultView={isMobile ? 'day' : 'week'}
        views={['day', 'week', 'month']}
        view={currentView}
        date={currentDate}
        onView={setCurrentView}
        onNavigate={setCurrentDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onRangeChange={handleRangeChange}
        selectable={true}
        longPressThreshold={250}
        step={60}
        timeslots={1}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        resourceAccessor="resource"
        min={new Date(new Date().setHours(7, 0, 0, 0))}
        max={new Date(new Date().setHours(23, 0, 0, 0))}
        scrollToTime={new Date(new Date().setHours(Math.max(primeraHoraDisponible - 1, 7), 0, 0, 0))}
        timeGutterWidth={isMobile ? 45 : 70}
        slotPropGetter={(date: Date) => {
          const isAvailable = isSlotAvailable(date);
          const isBloqueado = isSlotBloqueado(date);
          const isPast = date < new Date();

          let backgroundColor = 'transparent';
          if (isBloqueado) backgroundColor = '#EF4444';
          else if (isAvailable) backgroundColor = '#10B981';
          else if (!isPast) backgroundColor = 'rgba(0,0,0,0.03)';

          const isHabilitable = !isAvailable && !isBloqueado && !isPast;

          const style: React.CSSProperties = {
            backgroundColor,
            borderColor: isBloqueado ? '#EF4444' : isAvailable ? '#10B981' : '#E5E7EB',
            opacity: isPast ? 0.3 : 1,
            cursor: (isAvailable || isHabilitable) && !isPast ? 'pointer' : 'not-allowed',
            height: '60px',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box'
          };

          return { style };
        }}
        eventPropGetter={() => ({
          style: {
            backgroundColor: color,
            borderColor: color,
            borderRadius: '2px',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }
        })}
        components={{
          timeSlotWrapper: TimeSlotWrapper,
          event: makeEventComponent(color),
          toolbar: (props) => (
            <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Fila 1: vistas (Día / Semana / Mes) */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
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
              </div>
              {/* Fila 2: navegación + label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span className="rbc-btn-group">
                  <button type="button" onClick={() => props.onNavigate('PREV')}>‹</button>
                  <button type="button" onClick={() => props.onNavigate('TODAY')}>Hoy</button>
                  <button type="button" onClick={() => props.onNavigate('NEXT')}>›</button>
                </span>
                <span className="rbc-toolbar-label" style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: isMobile ? '13px' : '16px' }}>
                  {props.label}
                </span>
              </div>
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
    </div>
  );
}
