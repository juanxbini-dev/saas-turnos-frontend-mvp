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
import { TurnoConDetalle } from '../../types/turno.types';
import { TurnoPopover } from './TurnoPopover';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';

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
      minHeight: '100%'
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
  locales: { es }
});

interface DashboardCalendarioProps {
  profesionalId: string
  color: string
  onSlotSelect: (fecha: Date, hora: Date) => void
}

export function DashboardCalendario({ 
  profesionalId, 
  color, 
  onSlotSelect 
}: DashboardCalendarioProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('week');
  const [selectedTurno, setSelectedTurno] = useState<TurnoConDetalle | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const toast = useToast();

  // Calcular rango de fechas según la vista
  const getDateRange = useCallback((date: Date, view: View) => {
    let start: Date;
    let end: Date;

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

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  }, []);

  const { start: rangoInicio, end: rangoFin } = getDateRange(currentDate, currentView);

  // Cargar turnos con useFetch
  const { data: turnos, revalidate, loading, error } = useFetch(
    buildKey(ENTITIES.CALENDARIO, profesionalId, `${rangoInicio}-${rangoFin}`),
    async () => {
      console.log('🔍 [DashboardCalendario] Iniciando petición de turnos:', {
        profesionalId,
        rangoInicio,
        rangoFin
      });
      
      try {
        const result = await turnoService.getCalendario(profesionalId, rangoInicio, rangoFin);
        console.log('✅ [DashboardCalendario] Respuesta exitosa:', {
          cantidad: result?.length || 0,
          datos: result
        });
        return result;
      } catch (error) {
        console.error('❌ [DashboardCalendario] Error en petición:', error);
        throw error;
      }
    },
    { ttl: TTL.SHORT }
  );

  console.log('📊 [DashboardCalendario] Estado de turnos:', {
    loading,
    error,
    dataLength: turnos?.length || 0,
    datos: turnos
  });

  // Cargar configuración de disponibilidad (incluye intervalo_minutos)
  const { data: configData, loading: loadingConfig } = useFetch(
    profesionalId ? buildKey(ENTITIES.CONFIGURACION, profesionalId) : null,
    async () => {
      if (!profesionalId) return null;
      
      try {
        const config = await disponibilidadService.getConfiguracion();
        console.log('🔧 [DashboardCalendario] Configuración obtenida:', config);
        return config;
      } catch (error) {
        console.warn('Error obteniendo configuración:', error);
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
          console.warn(`Error obteniendo slots para ${fechaStr}:`, error);
          slotsPorDia[fechaStr] = [];
        }
      }
      
      return slotsPorDia;
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
        console.log('🔧 [DashboardCalendario] Usando intervalo configurado:', configProfesional.intervalo_minutos);
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
        const hora1 = new Date(`2000-01-01T${slots[0]}:00`);
        const hora2 = new Date(`2000-01-01T${slots[1]}:00`);
        const diffMinutos = (hora2.getTime() - hora1.getTime()) / 60000;
        console.log('🔧 [DashboardCalendario] Intervalo calculado desde slots:', diffMinutos);
        return diffMinutos > 0 ? diffMinutos : 30;
      }
    }
    
    console.log('🔧 [DashboardCalendario] Usando intervalo default: 30 min');
    return 30; // Default si no se puede determinar
  }, [configData, slotsDisponibles, loadingSlots, profesionalId]);

  const intervaloConfigurado = getIntervaloConfigurado();

  // Transformar turnos al formato de react-big-calendar
  const events = (turnos || [])
    .filter(turno => {
      // Validar que el turno tenga datos necesarios
      if (!turno.fecha || !turno.hora) {
        console.warn('⚠️ [DashboardCalendario] Turno sin fecha u hora:', turno);
        return false;
      }
      return true;
    })
    .map(turno => {
      try {
        // Limpiar y formatear la fecha y hora
        const fechaStr = turno.fecha.split('T')[0]; // Eliminar timezone si existe
        const horaStr = turno.hora.split(':')[0] + ':' + turno.hora.split(':')[1]; // Solo HH:MM
        
        console.log('🔧 [DashboardCalendario] Procesando fecha/hora:', {
          original: { fecha: turno.fecha, hora: turno.hora },
          limpiado: { fecha: fechaStr, hora: horaStr }
        });
        
        const startDate = new Date(`${fechaStr}T${horaStr}:00`);
        
        // Validar que la fecha sea válida
        if (isNaN(startDate.getTime())) {
          console.warn('⚠️ [DashboardCalendario] Fecha inválida:', {
            id: turno.id,
            fecha: fechaStr,
            hora: horaStr,
            fechaCompleta: `${fechaStr}T${horaStr}:00`,
            fechaInvalida: startDate.toString()
          });
          return null;
        }
        
        // IMPORTANTE: Usar la duración del servicio, no el intervalo de disponibilidad
        const duracionServicio = Math.max(turno.duracion_minutos || 60, 60); // Mínimo 60 min
        const endDate = new Date(startDate.getTime() + duracionServicio * 60000);
        
        console.log('📅 [DashboardCalendario] Transformando turno:', {
          id: turno.id,
          cliente: turno.cliente_nombre,
          servicio: turno.servicio,
          fecha: fechaStr,
          hora: horaStr,
          duracion_servicio: turno.duracion_minutos,
          duracion_usada: duracionServicio,
          intervalo_configurado: intervaloConfigurado,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          diffMinutos: (endDate.getTime() - startDate.getTime()) / 60000
        });
        
        return {
          id: turno.id,
          title: `${turno.cliente_nombre} — ${turno.servicio}`,
          start: startDate,
          end: endDate,
          resource: turno
        };
      } catch (error) {
        console.error('❌ [DashboardCalendario] Error procesando turno:', {
          turno,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    })
    .filter(event => event !== null); // Filtrar eventos nulos

  console.log('📊 [DashboardCalendario] Total turnos:', turnos?.length || 0);
  console.log('📊 [DashboardCalendario] Total events:', events.length);
  console.log('📊 [DashboardCalendario] Events para Calendar:', events);

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
    console.log('🎭 [DashboardCalendario] Usando eventos de demostración');
  }

  // Función para verificar si un slot está disponible
  const isSlotAvailable = useCallback((date: Date) => {
    if (!slotsDisponibles || loadingSlots) return false;
    
    const fechaStr = format(date, 'yyyy-MM-dd');
    const horaStr = format(date, 'HH:mm');
    const slotsDelDia = (slotsDisponibles as Record<string, string[]>)[fechaStr] || [];
    
    return slotsDelDia.includes(horaStr);
  }, [slotsDisponibles, loadingSlots]);

  // Manejar selección de slot con validación de disponibilidad
  const handleSelectSlot = useCallback((slotInfo: any) => {
    // Verificar si el slot está disponible
    if (!isSlotAvailable(slotInfo.start)) {
      toast.error('Este horario no está disponible');
      return;
    }
    
    const fecha = slotInfo.start;
    const hora = slotInfo.start;

    console.log('📅 [DashboardCalendario] Slot seleccionado:', {
      fecha,
      hora,
      profesionalId,
      profesionalSeleccionado: !!profesionalId
    });

    // Verificar que haya un profesional seleccionado
    if (!profesionalId) {
      toast.warning('Por favor, selecciona un profesional primero');
      return;
    }

    // Usar la firma original de onSlotSelect (fecha, hora)
    onSlotSelect(fecha, hora);
  }, [isSlotAvailable, profesionalId, toast, onSlotSelect]);

  // Manejar selección de evento
  const handleSelectEvent = useCallback((event: any, e: React.SyntheticEvent) => {
    const turno = event.resource as TurnoConDetalle;
    setSelectedTurno(turno);
    
    // Calcular posición del popover
    const rect = (e.target as Element).getBoundingClientRect();
    setPopoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setPopoverOpen(true);
  }, []);

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
        slotPropGetter={(date: Date) => {
          const isAvailable = isSlotAvailable(date);
          const isPast = date < new Date();
          
          let style: React.CSSProperties = {
            backgroundColor: isAvailable ? '#10B981' : 'transparent',
            borderColor: isAvailable ? '#10B981' : '#E5E7EB',
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

      {/* Popover de detalles del turno */}
      <TurnoPopover
        turno={selectedTurno}
        isOpen={popoverOpen}
        onClose={handlePopoverClose}
        onCancelar={handleCancelarTurno}
        position={popoverPosition}
      />
    </div>
  );
}
