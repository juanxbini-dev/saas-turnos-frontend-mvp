import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { Cliente, CreateClienteData, UpdateClienteData } from '../../types/cliente.types';
import { clienteService } from '../../services/cliente.service';
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
  const { state: authState } = useAuth();
  const toast = useToast();

  const isEditing = cliente !== null;
  const title = isEditing ? 'Editar cliente' : 'Nuevo cliente';

  useEffect(() => {
    if (isEditing && cliente) {
      setFormData({
        nombre: cliente.nombre,
        email: cliente.email,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim() || !formData.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && cliente) {
        const updateData: UpdateClienteData = {
          nombre: formData.nombre,
          email: formData.email,
          telefono: formData.telefono || null
        };
        await clienteService.updateCliente(cliente.id, updateData);
        toast.success('Cliente actualizado');
      } else {
        const createData: CreateClienteData = {
          nombre: formData.nombre,
          email: formData.email,
          telefono: formData.telefono || undefined
        };
        await clienteService.createCliente(createData);
        toast.success('Cliente creado');
      }

      // Invalidar caché
      cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Error inesperado');
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
            Email *
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@ejemplo.com"
            required
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
  );
};
