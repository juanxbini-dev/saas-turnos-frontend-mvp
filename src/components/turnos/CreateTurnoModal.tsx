import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Card, Spinner } from '../ui';
import { Calendar, TimeSlots } from '../ui';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { cacheService } from '../../cache/cache.service';
import { disponibilidadService, turnoService, clienteService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

interface CreateTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  onSuccess
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedProfesional, setSelectedProfesional] = useState<Profesional | null>(null);
  const [selectedServicio, setSelectedServicio] = useState<ServicioProfesional | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  
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

  // Hook de disponibilidad
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
    reset: resetDisponibilidad
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
    },
    { enabled: !!selectedProfesional }
  );

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

  // Obtener clientes
  const {
    data: clientes,
    loading: loadingClientes
  } = useFetch(
    buildKey(ENTITIES.CLIENTES),
    () => clienteService.getClientes(),
    { ttl: 300 }
  );

  // Búsqueda de clientes
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const filteredClientes = clientes?.filter(cliente =>
    cliente.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    cliente.email.toLowerCase().includes(clienteSearch.toLowerCase())
  ).slice(0, 5) || [];

  useEffect(() => {
    if (selectedProfesional && !isAdmin && selectedProfesional.id !== authUser?.id) {
      setSelectedProfesional({
        id: authUser!.authUser!.id,
        nombre: authUser!.authUser!.email,
        username: authUser!.authUser!.email
      });
    }
  }, [selectedProfesional, authUser, isAdmin]);

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
        servicio_id: selectedServicio.servicio_id,
        fecha: selectedDate,
        hora: selectedSlot,
        notas
      });

      toast.success('Turno creado correctamente');
      onSuccess();
      onClose();
      resetModal();
    } catch (error: any) {
      toast.error(error.message || 'Error al crear turno');
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
    // Resetear estados de creación de cliente
    setShowCreateCliente(false);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    setCreatingCliente(false);
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
    switch (step) {
      case 1: return 'Profesional';
      case 2: return 'Servicio';
      case 3: return 'Fecha y hora';
      case 4: return 'Confirmación';
      default: return '';
    }
  };

  const isStepComplete = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!selectedProfesional;
      case 2: return !!selectedServicio;
      case 3: return !!selectedDate && !!selectedSlot;
      case 4: return !!selectedCliente;
      default: return false;
    }
  };

  const formatFecha = (fecha: string) => {
    // Si la fecha ya incluye timestamp, usarla directamente
    // Si es solo fecha, agregar tiempo para evitar problemas de timezone
    const date = fecha.includes('T') ? new Date(fecha) : new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear nuevo turno"
      size="lg"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-6">
        {[1, 2, 3, 4].map((stepNumber) => (
          <div key={stepNumber} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step === stepNumber
                  ? 'bg-blue-600 text-white'
                  : isStepComplete(stepNumber)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
                }
              `}
            >
              {isStepComplete(stepNumber) && step !== stepNumber ? '✓' : stepNumber}
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
        ))}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-center">{getStepTitle()}</h3>
      </div>

      {/* Step 1 - Profesional */}
      {step === 1 && (
        <div className="space-y-4">
          {isAdmin ? (
            <>
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
                  profesionalesData?.profesionales?.map((profesional: Profesional) => (
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
            </>
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <div className="text-center">
                <div className="font-medium text-blue-900">{user?.email}</div>
                <div className="text-sm text-blue-700">Turno asignado a vos</div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Step 2 - Servicio */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Mostrar profesional seleccionado */}
          <Card className="bg-gray-50 border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Profesional seleccionado:</div>
            <div className="font-medium text-gray-900">
              {selectedProfesional?.nombre} @{selectedProfesional?.username}
            </div>
          </Card>
          
          {loadingServicios ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : servicios?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Este profesional no tiene servicios configurados</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {servicios?.map((servicio: ServicioProfesional) => (
                <Card
                  key={servicio.id}
                  className={`cursor-pointer hover:bg-blue-50 border-2 ${
                    selectedServicio?.id === servicio.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedServicio(servicio)}
                >
                  <div className="font-medium">{servicio.nombre}</div>
                  <div className="text-sm text-gray-500">{servicio.descripcion}</div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-sm font-medium">
                      ${servicio.precio || 0}
                    </span>
                    <span className="text-sm text-gray-500">
                      {servicio.duracion_minutos || 0} min
                    </span>
                  </div>
                </Card>
              ))}
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
                {selectedProfesional?.nombre} @{selectedProfesional?.username}
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
              <h4 className="font-medium mb-3">Horarios disponibles</h4>
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
                <span className="font-medium">{selectedProfesional?.nombre} @{selectedProfesional?.username}</span>
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
          disabled={step === 1}
        >
          Anterior
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            onClick={handleNextStep}
            disabled={
              (step === 1 && !selectedProfesional) ||
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
  );
};
