import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, XCircle, Search, Plus, X, AlertCircle } from 'lucide-react';
import { TurnoConDetalle } from '../../types/turno.types';
import { Cliente, CreateClienteData } from '../../types/cliente.types';
import { UsuarioServicio } from '../../types/servicio.types';
import { turnoService, clienteService, servicioService, disponibilidadService } from '../../services';
import { calcularMaxDuracionDesdeSlot } from '../../utils/calculos.utils';
import { useToast } from '../../hooks/useToast';
import { useFetch } from '../../hooks/useFetch';
import { useDebounce } from '../../hooks/useDebounce';
import { getClienteDuplicado } from '../../services/cliente.service';
import { ClienteDuplicadoModal } from '../clientes/ClienteDuplicadoModal';
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
  const [clienteDuplicado, setClienteDuplicado] = useState<{ isOpen: boolean; cliente: Cliente | null; mensaje: string }>({
    isOpen: false,
    cliente: null,
    mensaje: ''
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showEditarPagoModal, setShowEditarPagoModal] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const toast = useToast();

  // Determinar tipo de modal
  const modalType: ModalType = turno ? 'ocupado' : 'disponible';

  // Formatear fecha y hora
  const fechaStr = fecha ? format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : '';
  const horaStr = hora ? format(hora, 'HH:mm', { locale: es }) : '';

  // Búsqueda de clientes server-side: solo consultamos al backend cuando hay al
  // menos 2 caracteres. El servidor filtra por nombre/email/teléfono, así que ya
  // no cargamos solo los primeros 100 clientes alfabéticos en memoria.
  const debouncedClienteSearch = useDebounce(clienteSearch.trim(), 350);
  const { data: clientesResp, loading: loadingClientes } = useFetch(
    debouncedClienteSearch.length >= 2
      ? buildKey(ENTITIES.CLIENTES, `selector:${debouncedClienteSearch}`)
      : null,
    () => clienteService.getClientes(1, 20, debouncedClienteSearch),
    { ttl: 300 }
  );

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
    return calcularMaxDuracionDesdeSlot({
      horaFormatted,
      dayOfWeek: fecha.getDay(),
      disponibilidades: (configData as any).disponibilidades,
      slots,
    });
  }, [horaFormatted, fecha, configData, slots]);

  // El backend ya devuelve los clientes filtrados por la búsqueda
  const filteredClientes = clienteSearch.trim().length >= 2
    ? (clientesResp?.items || [])
    : [];

  // "Buscando" incluye la ventana de debounce (todavía no se consultó al backend)
  const clienteBuscando = clienteSearch.trim().length >= 2 &&
    (loadingClientes || debouncedClienteSearch !== clienteSearch.trim());

  // Manejar creación de cliente
  const handleCreateCliente = async () => {
    if (!newCliente.nombre.trim() || !newCliente.email.trim()) {
      setErrorModal('El nombre y el email del cliente son requeridos.');
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
      const dup = getClienteDuplicado(error);
      if (dup) {
        setClienteDuplicado({ isOpen: true, cliente: dup.cliente, mensaje: dup.mensaje });
      } else {
        setErrorModal(error.response?.data?.message || error.message || 'Error al crear cliente');
      }
    } finally {
      setCreatingCliente(false);
    }
  };

  const usarClienteExistente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    setShowCreateCliente(false);
    setClienteSearch('');
    setClienteDuplicado({ isOpen: false, cliente: null, mensaje: '' });
    toast.success('Cliente existente seleccionado');
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
      setErrorModal(error.response?.data?.message || error.message || 'Error al confirmar turno');
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
      setErrorModal(error.response?.data?.message || error.message || 'Error al cancelar turno');
    } finally {
      setLoading(false);
    }
  };

  // Manejar creación de turno
  const handleCreateTurno = async () => {
    if (!selectedCliente || !selectedServicio || !profesionalId || !fecha || !hora) {
      setErrorModal('Por favor completá todos los campos antes de continuar.');
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
      setShowConfirmModal(false);
      setErrorModal(error.response?.data?.message || error.message || 'Error al crear turno');
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
          {/* Info del turno — strip horizontal con separadores */}
          <div className="flex items-center justify-center gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Profesional</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{profesionalNombre || 'No asignado'}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{fechaStr || 'No seleccionada'}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Hora</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{horaStr || 'No seleccionada'}</p>
            </div>
          </div>

          {/* Selección de Cliente */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seleccionar Cliente</p>

            {/* Chip de cliente seleccionado */}
            {selectedCliente ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {selectedCliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 truncate">{selectedCliente.nombre}</div>
                  <div className="text-sm text-blue-600 truncate">{selectedCliente.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCliente(null); setClienteSearch(''); }}
                  className="text-blue-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-100 transition-colors shrink-0"
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

                {clienteBuscando ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : clienteSearch.trim().length < 2 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Escribí al menos 2 caracteres para buscar
                  </p>
                ) : filteredClientes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">Sin resultados</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-50 rounded-xl border border-gray-100">
                    {filteredClientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => { setSelectedCliente(cliente); setClienteSearch(''); }}
                      >
                        <div className="font-medium text-gray-900">{cliente.nombre}</div>
                        <div className="text-sm text-gray-500">{cliente.email}</div>
                      </button>
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
          </div>

          {/* Crear Cliente */}
          {showCreateCliente && (
            <div className="border border-dashed border-green-200 rounded-xl p-4 bg-green-50/50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Crear Nuevo Cliente</p>

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
                    variant="ghost"
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
            </div>
          )}

          {/* Selección de Servicio */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seleccionar Servicio</p>

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
                    <div
                      key={servicio.id}
                      className={`rounded-xl border p-3 transition-all ${
                        noFit
                          ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                          : selectedServicio?.id === servicio.id
                          ? 'cursor-pointer border-blue-500 bg-blue-50 shadow-sm'
                          : 'cursor-pointer border-gray-100 hover:border-blue-200 hover:shadow-sm'
                      }`}
                      onClick={() => { if (!noFit) setSelectedServicio(servicio); }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{servicio.nombre}</div>
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
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">
                            ✓
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón de Crear Turno */}
          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={!selectedCliente || !selectedServicio}
            block
            className="h-11 text-base font-semibold"
          >
            Crear Turno
          </Button>
        </div>
      ) : (
        // Contenido para slot ocupado
        <div className="space-y-4">
          {/* Grid de info del turno */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Cliente</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno?.cliente_nombre || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Servicio</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno?.servicio || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {turno?.fecha ? format(new Date(turno.fecha.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Hora</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno?.hora || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Estado</p>
              <p className={`text-sm font-semibold mt-0.5 ${
                turno?.estado === 'pendiente' ? 'text-yellow-600' :
                turno?.estado === 'confirmado' ? 'text-green-600' :
                turno?.estado === 'cancelado' ? 'text-red-600' :
                'text-gray-700'
              }`}>
                {turno?.estado ? turno.estado.charAt(0).toUpperCase() + turno.estado.slice(1) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Botones de acción según estado */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              block
              className="h-10"
            >
              Cerrar
            </Button>

            {turno?.estado === 'pendiente' && (
              <Button
                onClick={handleConfirmar}
                loading={loading}
                leftIcon={CheckCircle}
                block
                className="h-10"
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
                className="h-10"
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
                className="h-10"
              >
                {loading ? 'Cancelando...' : 'Cancelar'}
              </Button>
            )}

            {turno?.estado === 'completado' && (
              <Button
                variant="secondary"
                onClick={() => setShowEditarPagoModal(true)}
                block
                className="h-10"
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

      {/* Modal de Error */}
      {errorModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setErrorModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-xl p-6 text-center">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-sm text-gray-600 mb-4">{errorModal}</p>
            <Button onClick={() => setErrorModal(null)} variant="primary" className="w-full">
              Entendido
            </Button>
          </div>
        </div>
      )}

      <ClienteDuplicadoModal
        isOpen={clienteDuplicado.isOpen}
        mensaje={clienteDuplicado.mensaje}
        cliente={clienteDuplicado.cliente}
        onClose={() => setClienteDuplicado({ isOpen: false, cliente: null, mensaje: '' })}
        onUsar={usarClienteExistente}
      />
    </Modal>
  );
}
