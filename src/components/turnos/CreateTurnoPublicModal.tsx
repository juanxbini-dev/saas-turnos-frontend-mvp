import React, { useState } from 'react';
import { Modal, Button, Input, Textarea, Card, Spinner } from '../ui';
import { Calendar, TimeSlots } from '../ui';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { cacheService } from '../../cache/cache.service';
import { turnoPublicService, servicioPublicService } from '../../services/public';
import { useToast } from '../../hooks/useToast';
import { DateHelper } from '../../shared/utils/DateHelper';

interface CreateTurnoPublicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profesionalId: string;
  profesionalNombre: string;
  empresaSlug: string;
  empresaId: string;
}

interface ClienteFormData {
  nombre: string;
  email: string;
  telefono: string;
}

interface ExistingCliente {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
}

interface ServicioProfesional {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
}

export const CreateTurnoPublicModal: React.FC<CreateTurnoPublicModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  profesionalId,
  profesionalNombre,
  empresaId
}) => {
  // Estados del wizard (3 pasos para público)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedServicio, setSelectedServicio] = useState<ServicioProfesional | null>(null);
  const [clienteData, setClienteData] = useState<ClienteFormData>({
    nombre: '',
    email: '',
    telefono: ''
  });
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para validación de cliente
  const [existingCliente, setExistingCliente] = useState<ExistingCliente | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [useExistingCliente, setUseExistingCliente] = useState(false);
  
  const toast = useToast();

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
    reset: resetDisponibilidad,
    forceRefresh
  } = useDisponibilidad(profesionalId);

  // Obtener servicios del profesional
  const {
    data: serviciosResponse,
    loading: loadingServicios
  } = useFetch(
    profesionalId ? buildKey(ENTITIES.SERVICIOS, profesionalId) : null,
    () => {
      return profesionalId ? servicioPublicService.getServiciosProfesional(profesionalId) : Promise.resolve([]);
    }
  );

  // Acceder al array de servicios desde la respuesta anidada
  const servicios = serviciosResponse ? (serviciosResponse as any).data?.data || [] : [];

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1 as 1 | 2 | 3);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1 as 1 | 2 | 3);
    }
  };

  const handleValidateAndCreateTurno = async () => {
    // Validar datos del cliente
    if (!clienteData.nombre.trim() || !clienteData.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    setLoading(true);
    
    try {
      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clienteData.email)) {
        toast.error('Email inválido');
        return;
      }


      // Buscar cliente existente por email o teléfono
      const response = await turnoPublicService.validateCliente({
        email: clienteData.email,
        telefono: clienteData.telefono || undefined,
        empresa_id: empresaId
      });


      if ((response.data as any).data?.exists) {
        // Si existe, mostrar confirmación
        setExistingCliente((response.data as any).data.cliente);
        setShowMatchModal(true);
      } else {
        // Si no existe, crear nuevo y continuar
        await createNewClienteAndTurno();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al validar cliente');
    } finally {
      setLoading(false);
    }
  };

  const createNewClienteAndTurno = async (useExisting = false) => {
    try {
      setLoading(true);

      const turnoData = {
        profesional_id: profesionalId,
        servicio_id: selectedServicio?.id,
        fecha: selectedDate,
        hora: selectedSlot,
        cliente_data: clienteData,
        cliente_id: useExisting ? existingCliente?.id : undefined,
        notas
      };

      const response = await turnoPublicService.createTurno(turnoData);
      
      toast.success('Turno creado correctamente. Revisa tu email para confirmación.');
      
      // Invalidar caché de disponibilidad
      if (profesionalId && selectedDate) {
        const specificSlotKey = buildKey(ENTITIES.SLOTS, profesionalId, selectedDate);
        cacheService.invalidate(specificSlotKey);
      }
      
      onSuccess();
      onClose();
      resetModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear turno');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExistingCliente = () => {
    setUseExistingCliente(true);
    setShowMatchModal(false);
    createNewClienteAndTurno(true);
  };

  const handleCreateNewCliente = () => {
    setUseExistingCliente(false);
    setShowMatchModal(false);
    createNewClienteAndTurno(false);
  };

  const resetModal = () => {
    setStep(1);
    setSelectedServicio(null);
    setClienteData({ nombre: '', email: '', telefono: '' });
    setNotas('');
    setExistingCliente(null);
    setShowMatchModal(false);
    setUseExistingCliente(false);
    resetDisponibilidad();
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  const isStepComplete = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!selectedServicio;
      case 2: return !!selectedDate && !!selectedSlot;
      case 3: return !!clienteData.nombre && !!clienteData.email;
      default: return false;
    }
  };

  const formatFecha = (fecha: string) => {
    const date = DateHelper.parseDate(fecha);
    return DateHelper.formatDisplay(date);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Sacar turno"
        size="lg"
      >
        {/* Progress indicator (3 pasos) */}
        <div className="flex items-center justify-center mb-6">
          {[1, 2, 3].map((stepNumber) => {
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
                  {isStepComplete(stepNumber) && !isCurrentStep ? '✓' : stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div
                    className={`
                      w-12 h-1 mx-2
                      ${isStepComplete(stepNumber) ? 'bg-green-500' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-center">
            {step === 1 && 'Servicio'}
            {step === 2 && 'Fecha y hora'}
            {step === 3 && 'Tus datos'}
          </h3>
        </div>

        {/* Mostrar profesional seleccionado */}
        <Card className="bg-gray-50 border-gray-200 mb-4">
          <div className="text-sm text-gray-600 mb-1">Profesional seleccionado:</div>
          <div className="font-medium text-gray-900">
            {profesionalNombre}
          </div>
        </Card>

        {/* Step 1 - Servicio */}
        {step === 1 && (
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

        {/* Step 2 - Fecha y hora */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Mostrar servicio seleccionado */}
            <Card className="bg-gray-50 border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Servicio seleccionado:</div>
              <div className="font-medium text-gray-900">
                {selectedServicio?.nombre}
              </div>
            </Card>

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

        {/* Step 3 - Datos del cliente */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Mostrar servicio y fecha seleccionados */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-50 border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Servicio:</div>
                <div className="font-medium text-gray-900">
                  {selectedServicio?.nombre}
                </div>
              </Card>
              <Card className="bg-gray-50 border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Fecha y hora:</div>
                <div className="font-medium text-gray-900">
                  {selectedDate && formatFecha(selectedDate)} {selectedSlot}
                </div>
              </Card>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <Input
                type="text"
                value={clienteData.nombre}
                onChange={(e) => setClienteData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Tu nombre completo"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <Input
                type="email"
                value={clienteData.email}
                onChange={(e) => setClienteData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <Input
                type="tel"
                value={clienteData.telefono}
                onChange={(e) => setClienteData(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder="+54 9 11 1234-5678"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Alguna indicación especial..."
                rows={3}
                disabled={loading}
              />
            </div>

            {/* Resumen */}
            <Card className="bg-gray-50 border-gray-200">
              <h4 className="font-medium mb-3 text-gray-900">Resumen del turno</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Profesional:</span>
                  <span className="font-medium">{profesionalNombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Servicio:</span>
                  <span className="font-medium">{selectedServicio?.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duración:</span>
                  <span className="font-medium">{selectedServicio?.duracion_minutos || 0} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio:</span>
                  <span className="font-medium">${selectedServicio?.precio || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha:</span>
                  <span className="font-medium">{selectedDate && formatFecha(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hora:</span>
                  <span className="font-medium">{selectedSlot}</span>
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

          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              disabled={
                (step === 1 && !selectedServicio) ||
                (step === 2 && (!selectedDate || !selectedSlot))
              }
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleValidateAndCreateTurno}
              loading={loading}
              disabled={!clienteData.nombre || !clienteData.email}
            >
              Confirmar turno
            </Button>
          )}
        </div>
      </Modal>

      {/* Modal de confirmación de cliente existente */}
      {showMatchModal && existingCliente && (
        <Modal
          isOpen={showMatchModal}
          onClose={() => setShowMatchModal(false)}
          title="Cliente Identificado"
          size="md"
        >
          <div className="text-center">
            <div className="mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Hola! Te identificamos como cliente existente
              </h3>
              <p className="text-gray-600">
                Tus datos ya están registrados en nuestro sistema. Usaremos tu información existente para agendar este turno.
              </p>
            </div>

            {/* Datos existentes */}
            <Card className="bg-green-50 border-green-200 mb-4">
              <h4 className="font-medium text-green-900 mb-2">Tus datos registrados:</h4>
              <div className="text-sm space-y-1">
                <div><strong>Nombre:</strong> {existingCliente.nombre}</div>
                <div><strong>Email:</strong> {existingCliente.email}</div>
                {existingCliente.telefono && (
                  <div><strong>Teléfono:</strong> {existingCliente.telefono}</div>
                )}
              </div>
            </Card>

            {/* Botones de acción */}
            <div className="flex space-x-3">
              <Button 
                onClick={handleConfirmExistingCliente}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Confirmar y Continuar
              </Button>
              <Button 
                variant="secondary"
                onClick={handleCreateNewCliente}
                className="flex-1"
              >
                Usar otros datos
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
