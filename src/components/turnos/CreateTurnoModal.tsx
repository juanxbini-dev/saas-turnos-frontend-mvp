import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal, Button, Input, Textarea, Card, Spinner } from '../ui';
import { Calendar, TimeSlots } from '../ui';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { cacheService } from '../../cache/cache.service';
import { disponibilidadService, turnoService, clienteService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { format } from 'date-fns';
import { DateHelper } from '../../shared/utils/DateHelper';

// Feature flags para migración gradual
const USE_NEW_DATE_HELPER = (window as any).__ENV__?.REACT_APP_USE_NEW_DATE_HELPER === 'true';

interface CreateTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'admin' | 'staff';
  preselectedProfesionalId?: string;
  preselectedProfesionalNombre?: string;
  preselectedFecha?: Date;
  preselectedHora?: Date;
}

interface Cliente {
  id: string;
  nombre: string;
  email: string;
}

interface Profesional {
  id: string;
  nombre: string;
  username: string;
}

interface ServicioProfesional {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
  precio_personalizado?: number;
  duracion_personalizada?: number;
}

export const CreateTurnoModal: React.FC<CreateTurnoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  preselectedProfesionalId,
  preselectedProfesionalNombre,
  preselectedFecha,
  preselectedHora
}) => {
  // Inicializar paso según el modo
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    switch (mode) {
      case 'admin': return 1; // Admin comienza seleccionando profesional
      case 'staff': return 2; // Staff salta a servicios (profesional auto-seleccionado)
      default: return 1;
    }
  });
  const [selectedProfesional, setSelectedProfesional] = useState<Profesional | null>(null);
  const [selectedServicio, setSelectedServicio] = useState<ServicioProfesional | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Estados para creación de cliente
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [newCliente, setNewCliente] = useState({
    nombre: '',
    email: '',
    telefono: ''
  });
  const [creatingCliente, setCreatingCliente] = useState(false);
  
  const { state: authUser } = useAuth();
  const toast = useToast();
  const isAdmin = authUser?.roles.includes('admin');
  const user = authUser?.authUser;

  // Hook de disponibilidad — sin servicioId (dashboard usa flujo inverso: slot primero, servicio después)
  const {
    mes,
    año,
    selectedDate,
    selectedSlot,
    availableDates,
    slots,
    loadingDates,
    loadingSlots,
    handleMonthChange,
    handleDateSelect,
    handleSlotSelect,
    reset: resetDisponibilidad,
    forceRefresh
  } = useDisponibilidad(selectedProfesional?.id || null);

  // Obtener profesionales (solo admin)
  const {
    data: profesionalesData,
    loading: loadingProfesionales
  } = useFetch(
    buildKey(ENTITIES.PROFESIONALES),
    () => disponibilidadService.getProfesionales({ limit: 100 }),
    isAdmin ? { ttl: 300 } : undefined
  );

  // Obtener servicios del profesional
  const {
    data: servicios,
    loading: loadingServicios,
    revalidate: revalidateServicios
  } = useFetch(
    selectedProfesional ? buildKey(ENTITIES.SERVICIOS, selectedProfesional.id) : null,
    () => {
      console.log('🔍 [CreateTurnoModal] Solicitando servicios para profesional:', selectedProfesional?.id);
      return selectedProfesional ? disponibilidadService.getServiciosProfesional(selectedProfesional.id) : Promise.resolve([]);
    }
  );

  // Configuración del profesional (para calcular hora_fin al validar slot preseleccionado)
  const { data: configData, loading: loadingConfig } = useFetch(
    selectedProfesional ? buildKey(ENTITIES.CONFIGURACION, selectedProfesional.id) : null,
    () => selectedProfesional ? disponibilidadService.getConfiguracion(selectedProfesional.id) : Promise.resolve(null)
  );

  // Máxima duración disponible desde el slot preseleccionado.
  // Combina dos límites:
  //   1. horaFin - slot (límite duro del horario de trabajo)
  //   2. Primer slot posterior no disponible - slot (límite por turno intermedio)
  // Se usa el mínimo de ambos. El soft-limit solo aplica cuando slots ya cargó.
  const maxDuracionDesdeSlot = React.useMemo(() => {
    const slotRef = selectedSlot ?? (preselectedHora ? format(preselectedHora, 'HH:mm') : null);
    if (!slotRef || !preselectedFecha || !configData?.disponibilidades) return Infinity;

    const toMin = (s: string) => {
      const [h, m] = s.slice(0, 5).split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };

    const dayOfWeek = preselectedFecha.getDay();
    const disp = (configData.disponibilidades as any[]).find((d: any) =>
      d.activo && dayOfWeek >= d.dia_inicio && dayOfWeek <= d.dia_fin
    );

    if (!disp) return 0;

    const fromMin = toMin(slotRef);
    const horaFinMin = toMin(disp.hora_fin);

    // Límite duro: cuánto tiempo queda hasta el fin del horario
    const hardLimit = horaFinMin - fromMin;

    // Límite suave: primer slot posterior que NO está disponible (turno intermedio)
    // Solo aplica si los slots ya cargaron (length > 0 implica día con al menos un slot disponible)
    const slotsArr = slots as string[];
    if (slotsArr && slotsArr.length > 0) {
      const interval: number = disp.intervalo_minutos;
      const availableSet = new Set(slotsArr);
      let cur = fromMin + interval;
      while (cur < horaFinMin) {
        const slotStr = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`;
        if (!availableSet.has(slotStr)) {
          return Math.min(hardLimit, cur - fromMin);
        }
        cur += interval;
      }
    }

    return hardLimit;
  }, [selectedSlot, preselectedFecha, preselectedHora, configData, slots]);

  // Debug: log cuando los servicios cambian
  React.useEffect(() => {
    console.log('🔍 [CreateTurnoModal] Servicios recibidos:', servicios);
    if (servicios && servicios.length > 0) {
      servicios.forEach((servicio, index) => {
        console.log(`🔍 [CreateTurnoModal] Servicio ${index + 1}:`, {
          id: servicio.id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          precio: servicio.precio,
          precio_personalizado: servicio.precio_personalizado,
          duracion_minutos: servicio.duracion_minutos,
          duracion_personalizada: servicio.duracion_personalizada
        });
      });
    }
  }, [servicios]);

  // Obtener clientes (todos, sin paginación para el selector)
  const {
    data: clientesResp,
    loading: loadingClientes
  } = useFetch(
    buildKey(ENTITIES.CLIENTES, 'all'),
    () => clienteService.getClientes(1, 1000),
    { ttl: 300 }
  );
  const clientes = clientesResp?.items;

  // Búsqueda de clientes
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const filteredClientes = clientes?.filter(cliente =>
    cliente.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    cliente.email.toLowerCase().includes(clienteSearch.toLowerCase())
  ).slice(0, 5) || [];

  // Preseleccionar fecha y hora si vienen como props (pero no saltar de paso)
  useEffect(() => {
    if (preselectedFecha && selectedProfesional) {
      const formattedDate = USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(preselectedFecha) : format(preselectedFecha, 'yyyy-MM-dd');
      handleDateSelect(formattedDate);
      
      // Si también viene hora preseleccionada, seleccionarla pero mantenerse en paso 2
      if (preselectedHora) {
        const formattedTime = USE_NEW_DATE_HELPER ? DateHelper.formatTime(preselectedHora) : format(preselectedHora, 'HH:mm');
        handleSlotSelect(formattedTime);
      }
      // Mantenerse en paso 2 (Servicios) para el nuevo flujo unificado
    }
  }, [preselectedFecha, preselectedHora, selectedProfesional]);

  // Auto-seleccionar profesional según el modo
  useEffect(() => {
    if (mode === 'staff' && authUser?.authUser && !selectedProfesional) {
      // Staff: auto-seleccionarse a sí mismo
      setSelectedProfesional({
        id: authUser.authUser.id,
        nombre: authUser.authUser.nombre,
        username: authUser.authUser.email
      });
    }
    // Admin: no auto-seleccionar, esperar selección manual
  }, [mode, preselectedProfesionalId, preselectedProfesionalNombre, selectedProfesional, authUser]);


  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1 as 1 | 2 | 3 | 4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1 as 1 | 2 | 3 | 4);
    }
  };

  const handleCreateTurno = async () => {
    if (!selectedProfesional || !selectedServicio || !selectedDate || !selectedSlot || !selectedCliente) {
      return;
    }

    setLoading(true);
    try {
      await turnoService.createTurno({
        cliente_id: selectedCliente.id,
        usuario_id: selectedProfesional.id,
        servicio_id: (selectedServicio as any).servicio_id || selectedServicio.id,
        fecha: selectedDate,
        hora: selectedSlot,
        notas
      });

      toast.success('Turno creado correctamente. Está pendiente de confirmación por email.');
      
      // Invalidar caché específico de slots para esta fecha y profesional
      if (selectedProfesional && selectedDate) {
        const specificSlotKey = buildKey(ENTITIES.SLOTS, selectedProfesional.id, selectedDate);
        cacheService.invalidate(specificSlotKey);
      }
      
      onSuccess();
      onClose();
      resetModal();
    } catch (error: any) {
      setErrorModal(error.response?.data?.message || error.message || 'Error al crear turno');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedProfesional(null);
    setSelectedServicio(null);
    setSelectedCliente(null);
    setNotas('');
    resetDisponibilidad();
    setClienteSearch('');
    setShowClienteDropdown(false);
    setShowCreateCliente(false);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    setCreatingCliente(false);
    setErrorModal(null);
  };

  const handleCreateCliente = async () => {
    if (!newCliente.nombre.trim() || !newCliente.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    setCreatingCliente(true);
    try {
      const createdCliente = await clienteService.createCliente({
        nombre: newCliente.nombre,
        email: newCliente.email,
        telefono: newCliente.telefono || undefined
      });

      // Seleccionar automáticamente el cliente creado
      setSelectedCliente({
        id: createdCliente.id,
        nombre: createdCliente.nombre,
        email: createdCliente.email
      });

      // Resetear formulario de creación
      setNewCliente({ nombre: '', email: '', telefono: '' });
      setShowCreateCliente(false);

      // Invalidar caché de clientes
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));

      toast.success('Cliente creado y seleccionado');
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Error al crear cliente');
    } finally {
      setCreatingCliente(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  const getStepTitle = () => {
    switch (mode) {
      case 'admin':
        // Admin: 4 pasos completos
        switch (step) {
          case 1: return 'Profesional';
          case 2: return 'Servicio';
          case 3: return 'Fecha y hora';
          case 4: return 'Confirmación';
          default: return '';
        }
      case 'staff':
        // Staff: 3 pasos (sin selección de profesional)
        switch (step) {
          case 2: return 'Servicio';
          case 3: return 'Fecha y hora';
          case 4: return 'Confirmación';
          default: return '';
        }
      default:
        return '';
    }
  };

  const isStepComplete = (stepNumber: number) => {
    switch (mode) {
      case 'admin':
        // Admin: 4 pasos completos
        switch (stepNumber) {
          case 1: return !!selectedProfesional;
          case 2: return !!selectedServicio;
          case 3: return !!selectedDate && !!selectedSlot;
          case 4: return !!selectedCliente;
          default: return false;
        }
      case 'staff':
        // Staff: 3 pasos (sin paso 1)
        switch (stepNumber) {
          case 2: return !!selectedServicio;
          case 3: return !!selectedDate && !!selectedSlot;
          case 4: return !!selectedCliente;
          default: return false;
        }
      default:
        return false;
    }
  };

  const formatFecha = (fecha: string) => {
    if (USE_NEW_DATE_HELPER) {
      // Usar DateHelper para formateo consistente
      const date = fecha.includes('T') ? new Date(fecha) : DateHelper.combineDateTime(fecha, '00:00');
      return DateHelper.formatDisplay(date);
    } else {
      // Legacy implementation
      const date = fecha.includes('T') ? new Date(fecha) : new Date(fecha + 'T00:00:00');
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const getPrecio = () => {
    console.log('🔍 [CreateTurnoModal] getPrecio() - selectedServicio:', selectedServicio);
    const precio = selectedServicio?.precio || 0;
    console.log('🔍 [CreateTurnoModal] getPrecio():', {
      selectedServicio_exists: !!selectedServicio,
      precio_personalizado: selectedServicio?.precio_personalizado,
      precio_final: selectedServicio?.precio,
      precio_calculado: precio
    });
    return precio;
  };

  const getDuracion = () => {
    console.log('🔍 [CreateTurnoModal] getDuracion() - selectedServicio:', selectedServicio);
    const duracion = selectedServicio?.duracion_minutos || 0;
    console.log('🔍 [CreateTurnoModal] getDuracion():', {
      selectedServicio_exists: !!selectedServicio,
      duracion_personalizada: selectedServicio?.duracion_personalizada,
      duracion_final: selectedServicio?.duracion_minutos,
      duracion_calculada: duracion
    });
    return duracion;
  };


  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear nuevo turno"
      size="lg"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-6">
        {(() => {
          const steps = mode === 'admin' ? [1, 2, 3, 4] : [2, 3, 4];
          
          return steps.map((stepNumber, index) => {
            const displayStep = mode === 'admin' ? stepNumber : index + 1;
            const isCurrentStep = step === stepNumber;
            
            return (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isCurrentStep
                      ? 'bg-blue-600 text-white'
                      : isStepComplete(stepNumber)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {isStepComplete(stepNumber) && !isCurrentStep ? '✓' : displayStep}
                </div>
                {stepNumber < 4 && (
                  <div
                    className={`
                      w-12 h-1 mx-2
                      ${isStepComplete(stepNumber) ? 'bg-green-500' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>
            );
          });
        })()}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-center">{getStepTitle()}</h3>
      </div>

      {/* Step 1 - Profesional (solo para admin) */}
      {step === 1 && mode === 'admin' && (
        <div className="space-y-4">
          <Input
            placeholder="Buscar profesional..."
            value={clienteSearch}
            onChange={(e) => setClienteSearch(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto space-y-2">
            {loadingProfesionales ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : (
              (profesionalesData as any)?.data?.profesionales?.map((profesional: Profesional) => (
                <Card
                  key={profesional.id}
                  className={`cursor-pointer hover:bg-blue-50 border-2 transition-all ${
                    selectedProfesional?.id === profesional.id
                      ? 'bg-blue-100 border-blue-500'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedProfesional(profesional)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{profesional.nombre}</div>
                      <div className="text-sm text-gray-500">@{profesional.username}</div>
                    </div>
                    {selectedProfesional?.id === profesional.id && (
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 2 - Servicio */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Mostrar profesional seleccionado */}
          <Card className="bg-gray-50 border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Profesional seleccionado:</div>
            <div className="font-medium text-gray-900">
              {selectedProfesional?.nombre}
            </div>
          </Card>
          
          {(loadingServicios || (preselectedHora && (loadingConfig || loadingSlots))) ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : servicios?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Este profesional no tiene servicios configurados</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {servicios?.map((servicio: ServicioProfesional) => {
                const duracion = servicio.duracion_minutos || 0;
                const noFit = !!(preselectedFecha && selectedSlot && duracion > maxDuracionDesdeSlot);
                return (
                  <Card
                    key={servicio.id}
                    className={`border-2 transition-all ${
                      noFit
                        ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                        : selectedServicio?.id === servicio.id
                        ? 'cursor-pointer border-blue-600 bg-blue-50'
                        : 'cursor-pointer hover:bg-blue-50 hover:border-blue-300'
                    }`}
                    onClick={() => { if (!noFit) setSelectedServicio(servicio); }}
                  >
                    <div className="font-medium">{servicio.nombre}</div>
                    <div className="text-sm text-gray-500">{servicio.descripcion}</div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-sm font-medium">${servicio.precio || 0}</span>
                      <span className="text-sm text-gray-500">{duracion} min</span>
                    </div>
                    {noFit && (
                      <div className="text-xs text-amber-600 mt-2">
                        No disponible: el servicio requiere {duracion} min pero solo hay {maxDuracionDesdeSlot} min libres en este horario
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3 - Fecha y hora */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Mostrar profesional y servicio seleccionados */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gray-50 border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Profesional:</div>
              <div className="font-medium text-gray-900">
                {selectedProfesional?.nombre}
              </div>
            </Card>
            <Card className="bg-gray-50 border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Servicio:</div>
              <div className="font-medium text-gray-900">
                {selectedServicio?.nombre}
              </div>
            </Card>
          </div>

          <Calendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            currentMes={mes}
            currentAño={año}
            loading={loadingDates}
          />

          {selectedDate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Horarios disponibles</h4>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={forceRefresh}
                  className="text-xs"
                >
                  🔄 Refresh
                </Button>
              </div>
              <TimeSlots
                slots={slots}
                selectedSlot={selectedSlot}
                onSlotSelect={handleSlotSelect}
                loading={loadingSlots}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 4 - Confirmación */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar cliente
            </label>
            <div className="relative">
              <Input
                placeholder="Escriba nombre o email del cliente..."
                value={clienteSearch}
                onChange={(e) => {
                  setClienteSearch(e.target.value);
                  setShowClienteDropdown(true);
                }}
                onFocus={() => setShowClienteDropdown(true)}
              />
              
              {showClienteDropdown && clienteSearch.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredClientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedCliente(cliente);
                        setClienteSearch('');
                        setShowClienteDropdown(false);
                      }}
                    >
                      <div className="font-medium">{cliente.nombre}</div>
                      <div className="text-sm text-gray-500">{cliente.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opción de crear nuevo cliente */}
          {!selectedCliente && !showCreateCliente && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowCreateCliente(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Crear nuevo cliente
              </button>
            </div>
          )}

          {/* Formulario de creación de cliente */}
          {showCreateCliente && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">Nuevo cliente</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCliente(false);
                    setNewCliente({ nombre: '', email: '', telefono: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <Input
                  type="text"
                  value={newCliente.nombre}
                  onChange={(e) => setNewCliente(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del cliente"
                  disabled={creatingCliente}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={newCliente.email}
                  onChange={(e) => setNewCliente(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                  disabled={creatingCliente}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <Input
                  type="tel"
                  value={newCliente.telefono}
                  onChange={(e) => setNewCliente(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="+54 9 11 1234-5678"
                  disabled={creatingCliente}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateCliente(false);
                    setNewCliente({ nombre: '', email: '', telefono: '' });
                  }}
                  disabled={creatingCliente}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateCliente}
                  loading={creatingCliente}
                  disabled={!newCliente.nombre.trim() || !newCliente.email.trim()}
                >
                  Crear y seleccionar
                </Button>
              </div>
            </div>
          )}

          {selectedCliente && (
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <div>
                <div className="font-medium">{selectedCliente.nombre}</div>
                <div className="text-sm text-gray-500">{selectedCliente.email}</div>
              </div>
              <button
                onClick={() => setSelectedCliente(null)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas sobre el turno..."
              rows={3}
            />
          </div>

          {/* Resumen */}
          <Card className="bg-gray-50 border-gray-200">
            <h4 className="font-medium mb-3 text-gray-900">Resumen del turno</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Profesional:</span>
                <span className="font-medium">{selectedProfesional?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Servicio:</span>
                <span className="font-medium">{selectedServicio?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duración:</span>
                <span className="font-medium">{getDuracion()} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Precio:</span>
                <span className="font-medium">${getPrecio()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha:</span>
                <span className="font-medium">{selectedDate && formatFecha(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hora:</span>
                <span className="font-medium">{selectedSlot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium">{selectedCliente?.nombre}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={handlePrevStep}
          disabled={step === 1 || (mode !== 'admin' && step === 2)}
        >
          Anterior
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            onClick={handleNextStep}
            disabled={
              (mode === 'admin' && step === 1 && !selectedProfesional) ||
              (step === 2 && !selectedServicio) ||
              (step === 3 && (!selectedDate || !selectedSlot))
            }
          >
            Siguiente
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCreateTurno}
            loading={loading}
            disabled={!selectedCliente}
          >
            Confirmar turno
          </Button>
        )}
      </div>
    </Modal>

    {/* Modal de error */}
    {errorModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setErrorModal(null)} />
        <div className="relative w-full max-w-sm bg-white rounded-lg shadow-xl p-6 text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Error al crear turno</h3>
          <p className="text-sm text-gray-600 mb-4">{errorModal}</p>
          <Button onClick={() => setErrorModal(null)} variant="primary" className="w-full">
            Entendido
          </Button>
        </div>
      </div>
    )}
    </>
  );
};
