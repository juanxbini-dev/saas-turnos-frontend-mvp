import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '../ui';
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
  const slotsRef = useRef<HTMLDivElement>(null);

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

  // Scroll automático a los slots cuando se selecciona una fecha
  useEffect(() => {
    if (selectedDate && slotsRef.current) {
      setTimeout(() => {
        slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedDate]);

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

  if (!isOpen) return null;

  // ── helpers de estilo ──────────────────────────────────────────────────────
  const darkCard = 'bg-[#1a1a1a] border border-white/10 p-4';
  const darkLabel = 'block text-xs tracking-[0.15em] uppercase text-white/50 mb-1.5';
  const darkInput = 'w-full bg-[#1a1a1a] border border-white/20 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-white/50 placeholder:text-white/20 disabled:opacity-40';
  const ghostBtn = 'border border-white text-white text-xs tracking-[0.2em] uppercase font-medium px-6 py-2.5 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white';
  const ghostBtnSm = 'border border-white/30 text-white/60 text-xs tracking-[0.15em] uppercase px-4 py-1.5 rounded-full bg-transparent hover:border-white hover:text-white transition-colors duration-300';

  return (
    <>
      {/* ── Modal principal ── */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative w-full max-w-lg bg-[#111] border border-white/15 max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-white/40 mb-0.5">
                {profesionalNombre}
              </p>
              <h3
                className="text-xl font-bold uppercase text-white tracking-wide"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                {step === 1 && 'Elegí tu servicio'}
                {step === 2 && 'Fecha y hora'}
                {step === 3 && 'Tus datos'}
              </h3>
            </div>
            <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center px-6 py-3 gap-2 border-b border-white/5 flex-shrink-0">
            {[1, 2, 3].map((stepNumber) => (
              <React.Fragment key={stepNumber}>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === stepNumber
                      ? 'bg-white text-black'
                      : isStepComplete(stepNumber)
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/30'
                  }`}>
                    {isStepComplete(stepNumber) && step !== stepNumber ? '✓' : stepNumber}
                  </div>
                  <span className={`text-xs tracking-wider uppercase hidden sm:block ${step === stepNumber ? 'text-white' : 'text-white/30'}`}>
                    {stepNumber === 1 ? 'Servicio' : stepNumber === 2 ? 'Horario' : 'Datos'}
                  </span>
                </div>
                {stepNumber < 3 && (
                  <div className={`flex-1 h-px ${isStepComplete(stepNumber) ? 'bg-white/30' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5">

            {/* Step 1 - Servicio */}
            {step === 1 && (
              <div className="space-y-3">
                {loadingServicios ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : servicios?.length === 0 ? (
                  <p className="text-center text-white/40 text-sm py-8">
                    Sin servicios configurados por el momento.
                  </p>
                ) : (
                  servicios?.map((servicio: ServicioProfesional) => (
                    <div
                      key={servicio.id}
                      onClick={() => setSelectedServicio(servicio)}
                      className={`cursor-pointer p-4 border transition-colors ${
                        selectedServicio?.id === servicio.id
                          ? 'border-white bg-white/5'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white uppercase tracking-wide">{servicio.nombre}</p>
                          {servicio.descripcion && (
                            <p className="text-xs text-white/40 mt-0.5 italic">{servicio.descripcion}</p>
                          )}
                          <p className="text-xs text-white/30 mt-1">{servicio.duracion_minutos} min</p>
                        </div>
                        <p className="text-lg font-bold text-white" style={{ fontFamily: 'Oswald, sans-serif' }}>
                          ${servicio.precio}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Step 2 - Fecha y hora */}
            {step === 2 && (
              <div className="space-y-5">
                <div className={darkCard}>
                  <p className={darkLabel}>Servicio</p>
                  <p className="text-sm text-white font-medium">{selectedServicio?.nombre}</p>
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
                  <div ref={slotsRef}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={darkLabel}>Horarios disponibles</p>
                      <button onClick={forceRefresh} className={ghostBtnSm}>
                        🔄 Refresh
                      </button>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className={darkCard}>
                    <p className={darkLabel}>Servicio</p>
                    <p className="text-sm text-white font-medium">{selectedServicio?.nombre}</p>
                  </div>
                  <div className={darkCard}>
                    <p className={darkLabel}>Fecha y hora</p>
                    <p className="text-sm text-white font-medium">
                      {selectedDate && formatFecha(selectedDate)} {selectedSlot}
                    </p>
                  </div>
                </div>

                <div>
                  <label className={darkLabel}>Nombre completo *</label>
                  <input
                    type="text"
                    value={clienteData.nombre}
                    onChange={(e) => setClienteData(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Tu nombre completo"
                    disabled={loading}
                    className={darkInput}
                  />
                </div>

                <div>
                  <label className={darkLabel}>Email *</label>
                  <input
                    type="email"
                    value={clienteData.email}
                    onChange={(e) => setClienteData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="tu@email.com"
                    disabled={loading}
                    className={darkInput}
                  />
                </div>

                <div>
                  <label className={darkLabel}>Teléfono</label>
                  <input
                    type="tel"
                    value={clienteData.telefono}
                    onChange={(e) => setClienteData(prev => ({ ...prev, telefono: e.target.value }))}
                    placeholder="+54 9 11 1234-5678"
                    disabled={loading}
                    className={darkInput}
                  />
                </div>

                <div>
                  <label className={darkLabel}>Notas (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Alguna indicación especial..."
                    rows={3}
                    disabled={loading}
                    className={`${darkInput} resize-none`}
                  />
                </div>

                {/* Resumen */}
                <div className={darkCard}>
                  <p className="text-xs tracking-[0.2em] uppercase text-white/50 mb-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Resumen del turno
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      ['Profesional', profesionalNombre],
                      ['Servicio', selectedServicio?.nombre],
                      ['Duración', `${selectedServicio?.duracion_minutos || 0} min`],
                      ['Precio', `$${selectedServicio?.precio || 0}`],
                      ['Fecha', selectedDate ? formatFecha(selectedDate) : ''],
                      ['Hora', selectedSlot],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Navigation */}
          <div className="flex justify-between px-6 py-4 border-t border-white/10 flex-shrink-0 gap-3">
            <button
              onClick={handlePrevStep}
              disabled={step === 1}
              className={ghostBtn}
            >
              Anterior
            </button>

            {step < 3 ? (
              <button
                onClick={handleNextStep}
                disabled={
                  (step === 1 && !selectedServicio) ||
                  (step === 2 && (!selectedDate || !selectedSlot))
                }
                className={ghostBtn}
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleValidateAndCreateTurno}
                disabled={loading || !clienteData.nombre || !clienteData.email}
                className={ghostBtn}
              >
                {loading ? 'Confirmando...' : 'Confirmar turno'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal cliente existente ── */}
      {showMatchModal && existingCliente && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMatchModal(false)} />
          <div className="relative w-full max-w-sm bg-[#111] border border-white/15 p-6">
            <div className="text-center mb-5">
              <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-lg">✓</span>
              </div>
              <p
                className="text-lg font-bold uppercase text-white tracking-wide mb-2"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                Te reconocemos
              </p>
              <p className="text-sm text-white/50">
                Tus datos ya están registrados. ¿Confirmamos con ellos?
              </p>
            </div>

            <div className="bg-[#1a1a1a] border border-white/10 p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Nombre</span>
                <span className="text-white">{existingCliente.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Email</span>
                <span className="text-white">{existingCliente.email}</span>
              </div>
              {existingCliente.telefono && (
                <div className="flex justify-between">
                  <span className="text-white/40">Teléfono</span>
                  <span className="text-white">{existingCliente.telefono}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleConfirmExistingCliente} className={`${ghostBtn} flex-1`}>
                Confirmar
              </button>
              <button onClick={handleCreateNewCliente} className={`${ghostBtn} flex-1`}>
                Otros datos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
