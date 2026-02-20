import React, { useState } from 'react';
import { Modal, Select, Button } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { Usuario, UsuarioRol } from '../../types/usuario.types';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';

interface CambiarRolModalProps {
  usuario: Usuario | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CambiarRolModal: React.FC<CambiarRolModalProps> = ({
  usuario,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { state } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [nuevoRol, setNuevoRol] = useState<UsuarioRol>('staff');

  // Reset form when usuario changes
  React.useEffect(() => {
    if (usuario) {
      setNuevoRol(usuario.roles.includes('admin') ? 'admin' : 'staff');
    }
  }, [usuario]);

  const handleConfirm = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      await usuarioService.updateRol(usuario.id, nuevoRol);
      
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      toastSuccess('Rol actualizado correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al actualizar rol');
    } finally {
      setLoading(false);
    }
  };

  const isOwnUser = usuario?.id === state.authUser?.id;
  const currentRol = usuario?.roles.includes('admin') ? 'admin' : 'staff';

  if (!usuario) return null;

  const rolOptions = [
    { value: 'staff' as UsuarioRol, label: 'Staff' },
    { value: 'admin' as UsuarioRol, label: 'Administrador' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={`Cambiar Rol - ${usuario.nombre}`}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Usuario: <span className="font-medium">{usuario.nombre}</span> (@{usuario.username})
          </p>
          
          <p className="text-sm text-gray-500 mb-4">
            Rol actual: <span className="font-medium">{currentRol === 'admin' ? 'Administrador' : 'Staff'}</span>
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">
            El rol Administrador incluye automáticamente permisos de Staff.
          </p>
        </div>

        {isOwnUser ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              No podés modificar tu propio rol
            </p>
          </div>
        ) : (
          <div>
            <Select
              label="Nuevo Rol"
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value as UsuarioRol)}
              options={rolOptions}
              disabled={loading}
            />
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <Button
            onClick={handleConfirm}
            disabled={loading || isOwnUser}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Actualizando...' : 'Confirmar'}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
