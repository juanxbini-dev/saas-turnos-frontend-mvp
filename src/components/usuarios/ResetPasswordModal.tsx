import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { usuarioService } from '../../services/usuario.service';
import { Usuario } from '../../types/usuario.types';
import { useToast } from '../../hooks/useToast';

interface ResetPasswordModalProps {
  usuario: Usuario | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  usuario,
  isOpen,
  onClose
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setNuevaPassword('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!usuario) return;

    if (nuevaPassword.length < 6) {
      toastError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await usuarioService.resetPasswordSuperAdmin(usuario.id, nuevaPassword);
      toastSuccess(`Contraseña de ${usuario.nombre} reseteada correctamente`);
      handleClose();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al resetear contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!usuario) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      title="Resetear contraseña"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Estás reseteando la contraseña de{' '}
          <span className="font-medium">{usuario.nombre}</span>{' '}
          (@{usuario.username}). El usuario deberá usar esta nueva contraseña para ingresar.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <input
            type="text"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            La contraseña se mostrará en texto plano para que puedas comunicársela al usuario.
          </p>
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            onClick={handleConfirm}
            disabled={loading || nuevaPassword.length < 6}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Reseteando...' : 'Confirmar reset'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
