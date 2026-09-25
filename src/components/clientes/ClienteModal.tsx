import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { Cliente, CreateClienteData, UpdateClienteData } from '../../types/cliente.types';
import { clienteService, getClienteDuplicado } from '../../services/cliente.service';
import { ClienteDuplicadoModal } from './ClienteDuplicadoModal';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';

interface ClienteModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClienteModal: React.FC<ClienteModalProps> = ({
  cliente,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: ''
  });
  // Solo en el alta: el cliente autorizó de palabra las novedades por WhatsApp
  const [autorizoNovedades, setAutorizoNovedades] = useState(false);
  const [duplicado, setDuplicado] = useState<{ isOpen: boolean; cliente: Cliente | null; mensaje: string }>({
    isOpen: false,
    cliente: null,
    mensaje: ''
  });
  const { state: authState } = useAuth();
  const toast = useToast();

  const isEditing = cliente !== null;
  const title = isEditing ? 'Editar cliente' : 'Nuevo cliente';

  useEffect(() => {
    if (isEditing && cliente) {
      setFormData({
        nombre: cliente.nombre,
        email: cliente.email || '',
        telefono: cliente.telefono || ''
      });
    } else {
      setFormData({
        nombre: '',
        email: '',
        telefono: ''
      });
    }
  }, [cliente, isEditing]);

  // El tilde nunca se hereda de un alta anterior: quedaría registrado un
  // permiso que esta persona no dio.
  useEffect(() => {
    if (isOpen) setAutorizoNovedades(false);
  }, [isOpen, cliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && cliente) {
        const updateData: UpdateClienteData = {
          nombre: formData.nombre,
          email: formData.email.trim() || null,
          telefono: formData.telefono || null
        };
        await clienteService.updateCliente(cliente.id, updateData);
        toast.success('Cliente actualizado');
      } else {
        const createData: CreateClienteData = {
          nombre: formData.nombre,
          email: formData.email.trim() || undefined,
          telefono: formData.telefono || undefined,
          // Solo viaja si lo tildaron: sin tilde no se afirma nada sobre la
          // persona (ni permiso ni baja).
          marketing_consentimiento: autorizoNovedades ? true : undefined
        };
        await clienteService.createCliente(createData);
        toast.success('Cliente creado');
      }

      // Invalidar caché. Un cambio de teléfono cambia a quién le llega la
      // campaña de WhatsApp, así que también se tira lo de Campañas.
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
      
      onSuccess();
      onClose();
    } catch (error: any) {
      const dup = getClienteDuplicado(error);
      if (dup) {
        setDuplicado({ isOpen: true, cliente: dup.cliente, mensaje: dup.mensaje });
      } else {
        toast.error(error.response?.data?.message || error.message || 'Error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>
          <Input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleInputChange('nombre', e.target.value)}
            placeholder="Nombre del cliente"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@ejemplo.com (opcional)"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono
          </label>
          <Input
            type="tel"
            value={formData.telefono}
            onChange={(e) => handleInputChange('telefono', e.target.value)}
            placeholder="+54 9 11 1234-5678"
            disabled={loading}
          />
        </div>

        {!isEditing && (
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autorizoNovedades}
              onChange={(e) => setAutorizoNovedades(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Me autorizó a enviarle novedades por WhatsApp</span>
          </label>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            {isEditing ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>

    <ClienteDuplicadoModal
      isOpen={duplicado.isOpen}
      mensaje={duplicado.mensaje}
      cliente={duplicado.cliente}
      onClose={() => setDuplicado({ isOpen: false, cliente: null, mensaje: '' })}
    />
    </>
  );
};
