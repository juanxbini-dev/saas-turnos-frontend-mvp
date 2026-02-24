import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Configuración del localizer para react-big-calendar
const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Profesional {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
}

interface ConfiguracionData {
  disponibilidades: any[];
  vacaciones: any[];
  excepciones: any[];
}

interface ServiciosData {
  id: string;
  nombre: string;
  descripcion?: string;
  duracion_minutos: number;
  precio: number;
}

interface TurnosData {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
  };
  servicio: {
    nombre: string;
    duracion_minutos: number;
  };
}

const TestApiPage: React.FC = () => {
  // Estados para profesionales
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string>('');
  const [loadingProfesionales, setLoadingProfesionales] = useState(false);

  // Estados para las consultas
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [loadingTurnos, setLoadingTurnos] = useState(false);
  const [loadingSlotsRango, setLoadingSlotsRango] = useState(false);

  // Estados para los outputs
  const [outputConfig, setOutputConfig] = useState<ConfiguracionData | null>(null);
  const [outputServicios, setOutputServicios] = useState<ServiciosData[] | null>(null);
  const [outputTurnos, setOutputTurnos] = useState<TurnosData[] | null>(null);
  const [outputProfesional, setOutputProfesional] = useState<Profesional | null>(null);
  const [outputSlotsRango, setOutputSlotsRango] = useState<{ fecha: string; slots: string[] }[] | null>(null);

  // Estados para errores
  const [errorConfig, setErrorConfig] = useState<string>('');
  const [errorServicios, setErrorServicios] = useState<string>('');
  const [errorTurnos, setErrorTurnos] = useState<string>('');
  const [errorSlotsRango, setErrorSlotsRango] = useState<string>('');

  // Estados para el calendario
  const [calRango, setCalRango] = useState<{ fechaInicio: string, fechaFin: string }>({
    fechaInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    fechaFin: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [calSlots, setCalSlots] = useState<{ fecha: string; slots: string[] }[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calTurnos, setCalTurnos] = useState<any[]>([]);

  // Estados para el modal de slot
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState<{
    fecha: string
    hora: string
    profesionalNombre: string
    turno?: any
  } | null>(null);

  // Actualizar output del profesional seleccionado
  useEffect(() => {
    if (selectedProfesionalId) {
      const profesional = profesionales.find(p => p.id === selectedProfesionalId);
      setOutputProfesional(profesional || null);
    } else {
      setOutputProfesional(null);
    }
  }, [selectedProfesionalId, profesionales]);

  // useEffect para cargar rango inicial del calendario
  useEffect(() => {
    if (selectedProfesionalId) {
      handleCalRangeChange({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      });
    }
  }, [selectedProfesionalId]);

  // Auto-seleccionar primer profesional cuando se carguen
  useEffect(() => {
    if (profesionales.length > 0 && !selectedProfesionalId) {
      const primerProfesional = profesionales[0];
      setSelectedProfesionalId(primerProfesional.id);
    }
  }, [profesionales, selectedProfesionalId]);

  // Cargar profesionales al montar el componente
  useEffect(() => {
    const fetchProfesionales = async () => {
      setLoadingProfesionales(true);
      try {
        const response = await axiosInstance.get('/api/usuarios/profesionales');
        const profesionalesData = response.data.data?.profesionales || response.data.profesionales || [];
        setProfesionales(Array.isArray(profesionalesData) ? profesionalesData : []);
      } catch (error: any) {
        console.error('Error cargando profesionales:', error);
      } finally {
        setLoadingProfesionales(false);
      }
    };

    fetchProfesionales();
  }, []);

  // Función para consultar configuración
  const handleConsultarConfig = async () => {
    setLoadingConfig(true);
    setErrorConfig('');
    try {
      const response = await axiosInstance.get('/api/turnos/configuracion');
      setOutputConfig(response.data.data);
    } catch (error: any) {
      setErrorConfig(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Función para consultar servicios del profesional
  const handleConsultarServicios = async () => {
    if (!selectedProfesionalId) return;
    
    setLoadingServicios(true);
    setErrorServicios('');
    try {
      const response = await axiosInstance.get(`/api/usuarios/${selectedProfesionalId}/servicios`);
      setOutputServicios(response.data.data);
    } catch (error: any) {
      setErrorServicios(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputServicios(null);
    } finally {
      setLoadingServicios(false);
    }
  };

  // Función para consultar turnos del profesional
  const handleConsultarTurnos = async () => {
    if (!selectedProfesionalId) return;
    
    setLoadingTurnos(true);
    setErrorTurnos('');
    try {
      const now = new Date();
      const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const fechaInicio = primerDiaMes.toISOString().split('T')[0];
      const fechaFin = ultimoDiaMes.toISOString().split('T')[0];
      
      const response = await axiosInstance.get('/api/turnos/calendario', {
        params: {
          profesionalId: selectedProfesionalId,
          fechaInicio,
          fechaFin
        }
      });
      setOutputTurnos(response.data.data);
    } catch (error: any) {
      setErrorTurnos(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputTurnos(null);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Función para consultar slots por rango
  const handleConsultarSlotsRango = async () => {
    if (!selectedProfesionalId) return;
    
    setLoadingSlotsRango(true);
    setErrorSlotsRango('');
    try {
      const hoy = new Date();
      const en7Dias = new Date(hoy);
      en7Dias.setDate(hoy.getDate() + 7);
      
      const fechaInicio = hoy.toISOString().split('T')[0];
      const fechaFin = en7Dias.toISOString().split('T')[0];
      
      const response = await axiosInstance.get(`/api/turnos/disponibilidad/${selectedProfesionalId}/slots-rango`, {
        params: {
          fechaInicio,
          fechaFin
        }
      });
      setOutputSlotsRango(response.data.data);
    } catch (error: any) {
      setErrorSlotsRango(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputSlotsRango(null);
    } finally {
      setLoadingSlotsRango(false);
    }
  };

  // Funciones para limpiar outputs
  const limpiarConfig = () => {
    setOutputConfig(null);
    setErrorConfig('');
  };

  const limpiarServicios = () => {
    setOutputServicios(null);
    setErrorServicios('');
  };

  const limpiarTurnos = () => {
    setOutputTurnos(null);
    setErrorTurnos('');
  };

  const limpiarSlotsRango = () => {
    setOutputSlotsRango(null);
    setErrorSlotsRango('');
  };

  // Handler para cambios de rango en el calendario
  const handleCalRangeChange = (range: any) => {
    if (!selectedProfesionalId) return;
    
    const fechaInicio = Array.isArray(range)
      ? format(range[0], 'yyyy-MM-dd')
      : format(range.start, 'yyyy-MM-dd');
    
    const fechaFin = Array.isArray(range)
      ? format(range[range.length - 1], 'yyyy-MM-dd')
      : format(range.end, 'yyyy-MM-dd');


    // Validar y limitar rango a máximo 30 días
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diasDiferencia = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    
    let fechaFinLimitada = fechaFin;
    if (diasDiferencia > 30) {
      // Limitar a 30 días desde el inicio
      const finLimitado = new Date(inicio);
      finLimitado.setDate(finLimitado.getDate() + 30);
      fechaFinLimitada = format(finLimitado, 'yyyy-MM-dd');
    }

    setCalRango({ fechaInicio, fechaFin: fechaFinLimitada });
    setCalLoading(true);
    
    // Llamada asíncrona sin hacer async el handler
    (async () => {
      try {
        const [slotsRes, turnosRes] = await Promise.all([
          axiosInstance.get(
            `/api/turnos/disponibilidad/${selectedProfesionalId}/slots-rango?fechaInicio=${fechaInicio}&fechaFin=${fechaFinLimitada}` 
          ),
          axiosInstance.get('/api/turnos/calendario', {
            params: { profesionalId: selectedProfesionalId, fechaInicio, fechaFin: fechaFinLimitada }
          })
        ]);
        setCalSlots(slotsRes.data.data);
        setCalTurnos(turnosRes.data.data || []);
      } catch (error: any) {
        console.error('Error cargando calendario:', error);
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Data:', error.response.data);
        }
      } finally {
        setCalLoading(false);
      }
    })();
  };

  // Handler para navegación del calendario
  const handleNavigate = (date: Date, view?: View, action?: string) => {
    const vistaActual = view || currentView; // usa el que viene, fallback al estado
    let start: Date, end: Date;
    
    if (vistaActual === 'month') {
      start = startOfMonth(date);
      end = endOfMonth(date);
    } else if (vistaActual === 'week') {
      start = startOfWeek(date, { weekStartsOn: 1 });
      end = endOfWeek(date, { weekStartsOn: 1 });
    } else {
      start = date;
      end = date;
    }
    
    console.log('🔍 [handleNavigate] Navegando:', { date, view: vistaActual, action, start, end });
    
    // Actualizar la fecha actual del calendario
    setCurrentDate(date);
    
    // Actualizar el rango y cargar datos
    handleCalRangeChange({ start, end });
  };

  // Handler para cambio de vista
  const handleViewChange = (view: View) => {
    setCurrentView(view);
    const now = new Date();
    handleNavigate(now, view); // pasa view explícitamente
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Página de Pruebas API</h1>
      
      {/* Sección 1: Selector de profesional */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Selector de Profesional</h2>
        
        {loadingProfesionales ? (
          <div className="flex justify-center py-4">
            <Spinner size="md" color="blue" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profesionales.map((profesional) => (
              <button
                key={profesional.id}
                onClick={() => setSelectedProfesionalId(profesional.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedProfesionalId === profesional.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {profesional.nombre}
              </button>
            ))}
          </div>
        )}
        
        {selectedProfesionalId && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Profesional seleccionado: <strong>{profesionales.find(p => p.id === selectedProfesionalId)?.nombre}</strong>
            </p>
          </div>
        )}
      </Card>

      {/* Sección 2: Botones de consulta */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Botones de Consulta</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={handleConsultarConfig}
            loading={loadingConfig}
            disabled={loadingConfig}
            className="w-full"
          >
            Configuración de disponibilidad
          </Button>
          
          <Button
            onClick={handleConsultarServicios}
            loading={loadingServicios}
            disabled={!selectedProfesionalId || loadingServicios}
            className="w-full"
          >
            Servicios del profesional
          </Button>
          
          <Button
            onClick={handleConsultarTurnos}
            loading={loadingTurnos}
            disabled={!selectedProfesionalId || loadingTurnos}
            className="w-full"
          >
            Turnos del profesional
          </Button>
          
          <Button
            onClick={handleConsultarSlotsRango}
            loading={loadingSlotsRango}
            disabled={!selectedProfesionalId || loadingSlotsRango}
            className="w-full"
          >
            Slots por rango
          </Button>
        </div>
      </Card>

      {/* Sección 3: Bloques de output */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bloque 1: Profesional seleccionado */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              Profesional Seleccionado
            </h3>
            {outputProfesional && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProfesionalId('')}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputProfesional && (
              <span className="text-gray-500">
                // Sin selección — elegí un profesional arriba
              </span>
            )}
            
            {outputProfesional && (
              <pre>{JSON.stringify(outputProfesional, null, 2)}</pre>
            )}
          </div>
        </Card>
        {/* Bloque 1: Configuración */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/turnos/configuracion
            </h3>
            {outputConfig && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarConfig}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputConfig && !errorConfig && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorConfig && (
              <span className="text-red-400">
                Error: {errorConfig}
              </span>
            )}
            
            {outputConfig && (
              <pre>{JSON.stringify(outputConfig, null, 2)}</pre>
            )}
          </div>
        </Card>

        {/* Bloque 2: Servicios */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/usuarios/{selectedProfesionalId || ':id'}/servicios
            </h3>
            {outputServicios && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarServicios}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputServicios && !errorServicios && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorServicios && (
              <span className="text-red-400">
                Error: {errorServicios}
              </span>
            )}
            
            {outputServicios && (
              <pre>{JSON.stringify(outputServicios, null, 2)}</pre>
            )}
          </div>
        </Card>

        {/* Bloque 3: Turnos */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/turnos/calendario
            </h3>
            {outputTurnos && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarTurnos}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputTurnos && !errorTurnos && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorTurnos && (
              <span className="text-red-400">
                Error: {errorTurnos}
              </span>
            )}
            
            {outputTurnos && (
              <pre>{JSON.stringify(outputTurnos, null, 2)}</pre>
            )}
          </div>
        </Card>
        
        {/* Bloque 4: Slots por rango */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              Slots disponibles por rango (hoy + 7 días)
            </h3>
            {outputSlotsRango && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarSlotsRango}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputSlotsRango && !errorSlotsRango && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorSlotsRango && (
              <span className="text-red-400">
                Error: {errorSlotsRango}
              </span>
            )}
            
            {outputSlotsRango && (
              <pre>{JSON.stringify(outputSlotsRango, null, 2)}</pre>
            )}
          </div>
        </Card>
      </div>

      {/* Sección 4: Resumen del profesional */}
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Resumen del profesional
          {selectedProfesionalId && (
            <span className="text-blue-600 ml-2">
              - {profesionales.find(p => p.id === selectedProfesionalId)?.nombre}
            </span>
          )}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sección Disponibilidad */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-2">Disponibilidad</h3>
            {outputConfig?.disponibilidades && outputConfig.disponibilidades.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-600">
                {outputConfig.disponibilidades.map((disp: any, index: number) => (
                  <li key={index} className="bg-gray-50 p-2 rounded">
                    Día {disp.dia_inicio} → {disp.dia_fin}, {disp.hora_inicio} - {disp.hora_fin}, cada {disp.intervalo_minutos} min
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">
                // Sin datos — consultá el botón correspondiente
              </p>
            )}
          </div>

          {/* Sección Servicios */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-2">Servicios</h3>
            {outputServicios && outputServicios.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-600">
                {outputServicios.map((servicio: any, index: number) => (
                  <li key={index} className="bg-gray-50 p-2 rounded">
                    <div className="font-medium">{servicio.nombre || servicio.servicio_nombre}</div>
                    <div className="text-xs text-gray-500">
                      ${servicio.precio_personalizado || servicio.precio_base || servicio.servicio_precio_base}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">
                // Sin datos — consultá el botón correspondiente
              </p>
            )}
          </div>

          {/* Sección Turnos del mes */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-2">Turnos del mes</h3>
            {outputTurnos && outputTurnos.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-600">
                {outputTurnos.map((turno: any, index: number) => (
                  <li key={index} className="bg-gray-50 p-2 rounded">
                    {new Date(turno.fecha).toLocaleDateString('es-AR', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    })} - {turno.hora_inicio || turno.hora}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">
                // Sin datos — consultá el botón correspondiente
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Sección 5: Mini Calendario */}
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Mini Calendario</h2>
        
        {/* Información del rango consultado */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            Rango consultado: {calRango.fechaInicio} → {calRango.fechaFin}
            {calLoading && (
              <span className="ml-2">
                <Spinner size="sm" />
              </span>
            )}
          </div>
        </div>

        {/* Mensaje si no hay profesional seleccionado */}
        {!selectedProfesionalId ? (
          <div className="text-center py-8 text-gray-400">
            Seleccioná un profesional para ver disponibilidad
          </div>
        ) : (
          <>
            {/* Transformación de slots a eventos */}
            {(() => {
              // Obtener intervalo de la configuración
              const intervaloMinutos = outputConfig?.disponibilidades?.[0]?.intervalo_minutos || 30;
              
              const eventosDisponibles = calSlots.flatMap(item =>
                item.slots.map(slot => {
                  const [dYear, dMonth, dDay] = item.fecha.split('-').map(Number);
                  const [dHour, dMinute] = slot.split(':').map(Number);
                  const start = new Date(dYear, dMonth - 1, dDay, dHour, dMinute, 0);
                  const end = new Date(start.getTime() + intervaloMinutos * 60000);
                  return {
                    title: `🟢 ${slot}`,
                    start,
                    end,
                    type: 'disponible'
                  };
                })
              );

              const eventosOcupados = calTurnos.map((turno: any) => {
                const [tYear, tMonth, tDay] = turno.fecha.split('-').map(Number);
                const [tHour, tMinute] = turno.hora.split(':').map(Number);
                const start = new Date(tYear, tMonth - 1, tDay, tHour, tMinute, 0);
                const end = new Date(start.getTime() + intervaloMinutos * 60000);
                return {
                  title: `${turno.cliente_nombre} — ${turno.servicio}`,
                  start,
                  end,
                  type: 'ocupado',
                  turno
                };
              });

              const eventos = [...eventosDisponibles, ...eventosOcupados];

              return (
                <div style={{ height: '500px' }}>
                  <Calendar
                    localizer={localizer}
                    events={eventos}
                    startAccessor="start"
                    endAccessor="end"
                    defaultView="week"
                    view={currentView}
                    date={currentDate}
                    views={['month', 'week', 'day']}
                    onNavigate={handleNavigate}
                    onView={handleViewChange}
                    onRangeChange={handleCalRangeChange}
                    onSelectEvent={(event: any) => {
                      if (event.type === 'disponible') {
                        setSlotSeleccionado({
                          fecha: format(event.start, 'yyyy-MM-dd'),
                          hora: format(event.start, 'HH:mm'),
                          profesionalNombre: profesionales.find(p => p.id === selectedProfesionalId)?.nombre || ''
                        });
                        setSlotModalOpen(true);
                      } else if (event.type === 'ocupado') {
                        setSlotSeleccionado({
                          fecha: format(event.start, 'yyyy-MM-dd'),
                          hora: format(event.start, 'HH:mm'),
                          profesionalNombre: profesionales.find(p => p.id === selectedProfesionalId)?.nombre || '',
                          turno: event.turno
                        });
                        setSlotModalOpen(true);
                      }
                    }}
                    messages={{
                      month: 'Mes',
                      week: 'Semana',
                      day: 'Día',
                      today: 'Hoy',
                      previous: 'Anterior',
                      next: 'Siguiente',
                      date: 'Fecha',
                      time: 'Hora',
                      event: 'Evento',
                      noEventsInRange: 'No hay eventos en este rango'
                    }}
                    eventPropGetter={(event: any) => ({
                      style: event.type === 'ocupado'
                        ? {
                            backgroundColor: '#DBEAFE',
                            color: '#1E40AF',
                            border: '1px solid #3B82F6',
                            borderRadius: '4px',
                            fontSize: '12px',
                            padding: '2px 4px',
                            fontWeight: '600'
                          }
                        : {
                            backgroundColor: '#D1FAE5',
                            color: '#065F46',
                            border: '1px solid #10B981',
                            borderRadius: '4px',
                            fontSize: '12px',
                            padding: '2px 4px'
                          }
                    })}
                  />
                </div>
              );
            })()}
          </>
        )}
      </Card>

      {/* Modal para selección de slot */}
      <Modal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        title={slotSeleccionado?.turno ? 'Detalle del turno' : 'Nuevo turno'}
        size="sm"
      >
        {slotSeleccionado && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Profesional</span>
                <span className="text-sm font-medium text-gray-800">
                  {slotSeleccionado.profesionalNombre}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Fecha</span>
                <span className="text-sm font-medium text-gray-800">
                  {new Date(slotSeleccionado.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Hora</span>
                <span className="text-sm font-medium text-gray-800">
                  {slotSeleccionado.hora}
                </span>
              </div>

              {slotSeleccionado.turno && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Cliente</span>
                    <span className="text-sm font-medium text-gray-800">
                      {slotSeleccionado.turno.cliente_nombre}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-sm font-medium text-gray-800">
                      {slotSeleccionado.turno.cliente_email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Servicio</span>
                    <span className="text-sm font-medium text-gray-800">
                      {slotSeleccionado.turno.servicio}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Estado</span>
                    <span className="text-sm font-medium text-gray-800">
                      {slotSeleccionado.turno.estado}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TestApiPage;
