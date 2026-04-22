import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, User, CheckCircle, XCircle, Search, Plus, X } from 'lucide-react';
import { TurnoConDetalle } from '../../types/turno.types';
import { Cliente, CreateClienteData } from '../../types/cliente.types';
import { UsuarioServicio } from '../../types/servicio.types';
import { turnoService, clienteService, servicioService, disponibilidadService } from '../../services';
import { useToast } from '../../hooks/useToast';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { cacheService } from '../../cache/cache.service';
import { Modal, Button, Card, Input, Spinner } from '../ui';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FinalizarTurnoModal } from '../turnos/FinalizarTurnoModal';

interface DashboardTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Para slot disponible
  profesionalNombre?: string;
  profesionalId?: string;
  fecha?: Date;
  hora?: Date;
  // Para slot ocupado
  turno?: TurnoConDetalle;
  onRefresh?: () => void;
}

type ModalType = 'disponible' | 'ocupado';

export function DashboardTurnoModal({
  isOpen,
  onClose,
  profesionalNombre,
  profesionalId,
  fecha,
  hora,
  turno,
  onRefresh
}: DashboardTurnoModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedServicio, setSelectedServicio] = useState<UsuarioServicio | null>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [newCliente, setNewCliente] = useState({ nombre: '', email: '', telefono: '' });
  const [creatingCliente, setCreatingCliente] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showEditarPagoModal, setShowEditarPagoModal] = useState(false);
  
  const toast = useToast();

  // Determinar tipo de modal
  const modalType: ModalType = turno ? 'ocupado' : 'disponible';

  // Formatear fecha y hora
  const fechaStr = fecha ? format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : '';
  const horaStr = hora ? format(hora, 'HH:mm', { locale: es }) : '';

  // Cargar clientes (todos, sin paginación para el selector)
  const { data: clientesResp, loading: loadingClientes } = useFetch(
    buildKey(ENTITIES.CLIENTES, 'all'),
    () => clienteService.getClientes(1, 1000),
    { ttl: 300 }
  );
  const clientes = clientesResp?.items;

  // Cargar servicios del profesional
  const { data: servicios, loading: loadingServicios } = useFetch(
    profesionalId ? buildKey(ENTITIES.SERVICIOS, profesionalId) : null,
    () => servicioService.getMisServicios(profesionalId),
    { ttl: 300 }
  );

  const fechaFormatted = fecha ? format(fecha, 'yyyy-MM-dd') : null;
  const horaFormatted = hora ? format(hora, 'HH:mm') : null;

  // Slots del día para detectar huecos entre turnos
  const { data: slotsData, loading: loadingSlots } = useFetch(
    profesionalId && fechaFormatted ? buildKey(ENTITIES.SLOTS, profesionalId, fechaFormatted, 'todos') : null,
    () => {
      if (!profesionalId || !fechaFormatted) return Promise.resolve([]);
      return disponibilidadService.getSlotsDisponibles(profesionalId, fechaFormatted, undefined);
    },
    { ttl: 5 }
  );
  const slots = (slotsData as string[]) || [];

  // Configuración del profesional (hora_fin, intervalo)
  const { data: configData, loading: loadingConfig } = useFetch(
    profesionalId ? buildKey(ENTITIES.CONFIGURACION, profesionalId) : null,
    () => profesionalId ? disponibilidadService.getConfiguracion(profesionalId) : Promise.resolve(null)
  );

  // Máxima duración que cabe desde el slot seleccionado:
  //   hardLimit = horaFin - horaSlot
  //   softLimit = primer slot posterior NO disponible - horaSlot (turno intermedio)
  //   resultado = min(hardLimit, softLimit)
  const maxDuracionDesdeSlot = useMemo(() => {
    if (!horaFormatted || !fecha || !(configData as any)?.disponibilidades) return Infinity;

    const toMin = (s: string) => {
      const [h, m] = s.slice(0, 5).split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };

    const dayOfWeek = fecha.getDay();
    const disp = ((configData as any).disponibilidades as any[]).find((d: any) =>
      d.activo && dayOfWeek >= d.dia_inicio && dayOfWeek <= d.dia_fin
    );
    // Sin disponibilidad semanal para este día (ej: slot por excepción o día sin configurar):
    // no filtrar en el frontend — el backend valida al crear el turno.
    if (!disp) return Infinity;

    const fromMin = toMin(horaFormatted);
    const horaFinMin = toMin(disp.hora_fin);
    const hardLimit = horaFinMin - fromMin;

    if (slots.length > 0) {
      const interval: number = disp.intervalo_minutos;
      const availableSet = new Set(slots);
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
  }, [horaFormatted, fecha, configData, slots]);

  // Filtrar clientes por búsqueda — solo mostrar si hay al menos 2 caracteres
  const filteredClientes = clienteSearch.trim().length >= 2
    ? (clientes?.filter(cliente =>
        cliente.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
        cliente.email.toLowerCase().includes(clienteSearch.toLowerCase())
      ) || [])
    : [];

  // Manejar creación de cliente
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

      setSelectedCliente(createdCliente);
      setNewCliente({ nombre: '', email: '', telefono: '' });
      setShowCreateCliente(false);
      setClienteSearch('');

      toast.success('Cliente creado y seleccionado');
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Error al crear cliente');
    } finally {
      setCreatingCliente(false);
    }
  };

  // Manejar cancelación de creación de cliente
  const handleCancelCreateCliente = () => {
    setShowCreateCliente(false);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    // No limpiar el cliente seleccionado existente
  };

  // Manejar confirmación de turno
  const handleConfirmar = async () => {
    if (!turno?.id) return;
    
    setLoading(true);
    try {
      await turnoService.confirmarTurno(turno.id);
      toast.success('Turno confirmado correctamente');
      onRefresh?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al confirmar turno');
    } finally {
      setLoading(false);
    }
  };

  // Manejar cancelación de turno
  const handleCancelar = async () => {
    if (!turno?.id) return;
    
    setLoading(true);
    try {
      await turnoService.cancelarTurno(turno.id);
      toast.success('Turno cancelado correctamente');
      onRefresh?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al cancelar turno');
    } finally {
      setLoading(false);
    }
  };

  // Manejar creación de turno
  const handleCreateTurno = async () => {
    if (!selectedCliente || !selectedServicio || !profesionalId || !fecha || !hora) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setConfirmLoading(true);
    try {
      await turnoService.createTurno({
        cliente_id: selectedCliente.id,
        usuario_id: profesionalId,
        servicio_id: selectedServicio.servicio_id,
        fecha: format(fecha, 'yyyy-MM-dd'),
        hora: format(hora, 'HH:mm'),
        notas: ''
      });

      toast.success('Turno creado correctamente. Está pendiente de confirmación por email.');
      // Invalidar slots para que la página pública vea el slot ocupado de inmediato
      cacheService.invalidate(buildKey(ENTITIES.SLOTS, profesionalId, format(fecha, 'yyyy-MM-dd')));
      setShowConfirmModal(false);
      onRefresh?.();
      handleClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Error al crear turno');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Resetear estado al cerrar
  const handleClose = () => {
    setSelectedCliente(null);
    setSelectedServicio(null);
    setClienteSearch('');
    setShowCreateCliente(false);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    setShowFinalizarModal(false);
    onClose();
  };

  const handleFinalizarSuccess = () => {
    setShowFinalizarModal(false);
    onRefresh?.();
    handleClose();
  };

  const handleEditarPagoSuccess = () => {
    setShowEditarPagoModal(false);
    onRefresh?.();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalType === 'disponible' ? 'Crear Nuevo Turno' : 'Detalles del Turno'}
      size="lg"
    >
      {modalType === 'disponible' ? (
        // Contenido para slot disponible
        <div className="space-y-4">
          <Card flat className="border-blue-200 bg-blue-50">
            <h3 className="font-medium text-blue-900 mb-3">Información del Turno</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Profesional</p>
                  <p className="font-medium text-gray-900">{profesionalNombre || 'No asignado'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium text-gray-900">{fechaStr || 'No seleccionada'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Hora</p>
                  <p className="font-medium text-gray-900">{horaStr || 'No seleccionada'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Selección de Cliente */}
          <Card flat>
            <h3 className="font-medium text-gray-900 mb-3">Seleccionar Cliente</h3>

            {/* Chip de cliente seleccionado */}
            {selectedCliente ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                <div>
                  <div className="font-medium text-blue-900">{selectedCliente.nombre}</div>
                  <div className="text-sm text-blue-600">{selectedCliente.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCliente(null); setClienteSearch(''); }}
                  className="text-blue-400 hover:text-blue-600 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingClientes ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : clienteSearch.trim().length < 2 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Escribí al menos 2 caracteres para buscar
                  </p>
                ) : filteredClientes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">Sin resultados</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {filteredClientes.map((cliente) => (
                      <Card
                        key={cliente.id}
                        className="cursor-pointer hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 transition-all"
                        onClick={() => { setSelectedCliente(cliente); setClienteSearch(''); }}
                      >
                        <div>
                          <div className="font-medium">{cliente.nombre}</div>
                          <div className="text-sm text-gray-500">{cliente.email}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              variant="secondary"
              onClick={() => { setSelectedCliente(null); setClienteSearch(''); setShowCreateCliente(true); }}
              leftIcon={Plus}
              block
              className="mt-3"
            >
              Crear Nuevo Cliente
            </Button>
          </Card>

          {/* Crear Cliente */}
          {showCreateCliente && (
            <Card flat className="border-green-200 bg-green-50">
              <h3 className="font-medium text-green-900 mb-3">Crear Nuevo Cliente</h3>
              
              <div className="space-y-3">
                <Input
                  placeholder="Nombre del cliente"
                  value={newCliente.nombre}
                  onChange={(e) => setNewCliente({ ...newCliente, nombre: e.target.value })}
                />
                <Input
                  placeholder="Email del cliente"
                  type="email"
                  value={newCliente.email}
                  onChange={(e) => setNewCliente({ ...newCliente, email: e.target.value })}
                />
                <Input
                  placeholder="Teléfono (opcional)"
                  value={newCliente.telefono}
                  onChange={(e) => setNewCliente({ ...newCliente, telefono: e.target.value })}
                />
                
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleCancelCreateCliente}
                    block
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateCliente}
                    loading={creatingCliente}
                    disabled={!newCliente.nombre.trim() || !newCliente.email.trim()}
                    block
                  >
                    Crear y Seleccionar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Selección de Servicio */}
          <Card flat>
            <h3 className="font-medium text-gray-900 mb-3">Seleccionar Servicio</h3>

            {loadingServicios || loadingConfig || loadingSlots ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : servicios?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Este profesional no tiene servicios configurados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {servicios?.filter(s => s.habilitado).map((servicio) => {
                  const duracion = servicio.duracion_personalizada || servicio.duracion_minutos || 0;
                  const noFit = duracion > maxDuracionDesdeSlot;
                  return (
                  <Card
                    key={servicio.id}
                    className={`border-2 transition-all ${
                      noFit
                        ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                        : selectedServicio?.id === servicio.id
                        ? 'cursor-pointer bg-blue-100 border-blue-500'
                        : 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-gray-200'
                    }`}
                    onClick={() => { if (!noFit) setSelectedServicio(servicio); }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{servicio.nombre}</div>
                        <div className="text-sm text-gray-500">
                          {servicio.duracion_personalizada || servicio.duracion_minutos} min •
                          ${servicio.precio_personalizado || servicio.precio || 'N/A'}
                        </div>
                        {noFit && (
                          <div className="text-xs text-amber-600 mt-1">
                            No disponible: el servicio requiere {duracion} min pero solo hay {maxDuracionDesdeSlot} min libres en este horario
                          </div>
                        )}
                      </div>
                      {selectedServicio?.id === servicio.id && !noFit && (
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                          ✓
                        </div>
                      )}
                    </div>
                  </Card>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Botón de Crear Turno */}
          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={!selectedCliente || !selectedServicio}
            block
          >
            Crear Turno
          </Button>
        </div>
      ) : (
        // Contenido para slot ocupado
        <div className="space-y-4">
          <Card flat className="border-purple-200 bg-purple-50">
            <h3 className="font-medium text-purple-900 mb-3">Información del Turno</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-medium text-gray-900">{turno?.cliente_nombre || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium text-gray-900">
                    {turno?.fecha ? format(new Date(turno.fecha.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Hora</p>
                  <p className="font-medium text-gray-900">{turno?.hora || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Servicio</p>
                  <p className="font-medium text-gray-900">{turno?.servicio || 'N/A'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Estado del turno */}
          <Card flat className={`${
            turno?.estado === 'pendiente' ? 'border-yellow-200 bg-yellow-50' :
            turno?.estado === 'confirmado' ? 'border-green-200 bg-green-50' :
            turno?.estado === 'cancelado' ? 'border-red-200 bg-red-50' :
            'border-gray-200 bg-gray-50'
          }`}>
            <p className={`text-sm ${
              turno?.estado === 'pendiente' ? 'text-yellow-800' :
              turno?.estado === 'confirmado' ? 'text-green-800' :
              turno?.estado === 'cancelado' ? 'text-red-800' :
              'text-gray-800'
            }`}>
              <span className="font-medium">Estado:</span> {turno?.estado || 'N/A'}
            </p>
          </Card>

          {/* Botones de acción según estado */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={onClose}
              block
            >
              Cerrar
            </Button>
            
            {turno?.estado === 'pendiente' && (
              <Button
                onClick={handleConfirmar}
                loading={loading}
                leftIcon={CheckCircle}
                block
              >
                {loading ? 'Confirmando...' : 'Confirmar'}
              </Button>
            )}
            
            {turno?.estado === 'confirmado' && (
              <Button
                variant="primary"
                onClick={() => setShowFinalizarModal(true)}
                loading={loading}
                leftIcon={CheckCircle}
                block
              >
                {loading ? 'Procesando...' : 'Finalizar Turno'}
              </Button>
            )}
            
            {turno?.estado === 'confirmado' && (
              <Button
                variant="danger"
                onClick={handleCancelar}
                loading={loading}
                leftIcon={XCircle}
                block
              >
                {loading ? 'Cancelando...' : 'Cancelar'}
              </Button>
            )}

            {turno?.estado === 'completado' && (
              <Button
                variant="secondary"
                onClick={() => setShowEditarPagoModal(true)}
                block
              >
                Editar pago
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleCreateTurno}
        title="Confirmar Creación de Turno"
        message={`
          ¿Deseas confirmar la creación del turno con los siguientes datos?
          
          <div style="margin: 16px 0; padding: 12px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <div style="margin-bottom: 8px;"><strong>Profesional:</strong> ${profesionalNombre}</div>
            <div style="margin-bottom: 8px;"><strong>Cliente:</strong> ${selectedCliente?.nombre}</div>
            <div style="margin-bottom: 8px;"><strong>Servicio:</strong> ${selectedServicio?.nombre}</div>
            <div style="margin-bottom: 8px;"><strong>Fecha:</strong> ${fechaStr}</div>
            <div style="margin-bottom: 0;"><strong>Hora:</strong> ${horaStr}</div>
          </div>
        `}
        confirmText="Confirmar Turno"
        cancelText="Cancelar"
        variant="primary"
        loading={confirmLoading}
      />

      {/* Modal de Finalizar Turno */}
      {turno && (
        <FinalizarTurnoModal
          isOpen={showFinalizarModal}
          onClose={() => setShowFinalizarModal(false)}
          turno={turno}
          onSuccess={handleFinalizarSuccess}
          comisionesConfig={{
            comision_turno: 20,
            comision_producto: 20
          }}
        />
      )}

      {/* Modal de Editar Pago */}
      {turno && (
        <FinalizarTurnoModal
          isOpen={showEditarPagoModal}
          onClose={() => setShowEditarPagoModal(false)}
          turno={turno}
          onSuccess={handleEditarPagoSuccess}
          mode="editar"
        />
      )}
    </Modal>
  );
}
