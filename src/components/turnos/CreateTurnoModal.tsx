import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Card, Spinner } from '../ui';
import { Calendar, TimeSlots } from '../ui';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
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
  
  const { state: authUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = authUser?.roles.includes('admin');

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
  } = useDisponibilidad(selectedProfesional?.id || '');

  // Obtener profesionales (solo admin)
  const {
    data: profesionalesData,
    loading: loadingProfesionales
  } = useFetch(
    buildKey(ENTITIES.PROFESIONALES),
    () => disponibilidadService.getProfesionales({ limit: 100 }),
    { enabled: isAdmin }
  );

  // Obtener servicios del profesional
  const {
    data: servicios,
    loading: loadingServicios,
    revalidate: revalidateServicios
  } = useFetch(
    selectedProfesional ? buildKey(ENTITIES.SERVICIOS, selectedProfesional.id) : null,
    () => selectedProfesional ? disponibilidadService.getServiciosProfesional(selectedProfesional.id) : Promise.resolve([]),
    { enabled: !!selectedProfesional }
  );

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
        servicio_id: selectedServicio.id,
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
    const date = new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPrecio = () => {
    return selectedServicio?.precio_personalizado || selectedServicio?.precio || 0;
  };

  const getDuracion = () => {
    return selectedServicio?.duracion_personalizada || selectedServicio?.duracion_minutos || 0;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear nuevo turno"
      size="xl"
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
                      className="cursor-pointer hover:bg-blue-50 border-2 hover:border-blue-300"
                      onClick={() => setSelectedProfesional(profesional)}
                    >
                      <div className="font-medium">{profesional.nombre}</div>
                      <div className="text-sm text-gray-500">@{profesional.username}</div>
                    </Card>
                  ))
                )}
              </div>
            </>
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <div className="text-center">
                <div className="font-medium text-blue-900">{user?.nombre}</div>
                <div className="text-sm text-blue-700">Turno asignado a vos</div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Step 2 - Servicio */}
      {step === 2 && (
        <div className="space-y-4">
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
                      ${getPrecio()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {getDuracion()} min
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
          <Card className="bg-gray-50">
            <h4 className="font-medium mb-3">Resumen del turno</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Profesional:</strong> {selectedProfesional?.nombre}</div>
              <div><strong>Servicio:</strong> {selectedServicio?.nombre} - ${getPrecio()}</div>
              <div><strong>Fecha:</strong> {selectedDate && formatFecha(selectedDate)}</div>
              <div><strong>Hora:</strong> {selectedSlot}</div>
              <div><strong>Cliente:</strong> {selectedCliente?.nombre}</div>
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
