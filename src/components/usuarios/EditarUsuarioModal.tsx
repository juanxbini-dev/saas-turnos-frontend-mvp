import React, { useState } from 'react';
import { Modal, Tabs, Input, Button } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { Usuario, UpdateDatosData, UpdatePasswordData } from '../../types/usuario.types';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
import { ComisionesForm } from './ComisionesForm';

interface EditarUsuarioModalProps {
  usuario: Usuario | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditarUsuarioModal: React.FC<EditarUsuarioModalProps> = ({
  usuario,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { state } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('datos');
  const [editMode, setEditMode] = useState(false);
  
  // Form data
  const [datosForm, setDatosForm] = useState<UpdateDatosData>({
    nombre: '',
    username: '',
    comision_turno: 20,
    comision_producto: 20
  });
  
  const [passwordForm, setPasswordForm] = useState<UpdatePasswordData>({
    passwordActual: '',
    passwordNueva: '',
    passwordNuevaRepetir: ''
  });
  
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Reset forms when usuario changes
  React.useEffect(() => {
    if (usuario) {
      setDatosForm({
        nombre: usuario.nombre,
        username: usuario.username,
        comision_turno: usuario.comision_turno || 20,
        comision_producto: usuario.comision_producto || 20
      });
      setPasswordForm({
        passwordActual: '',
        passwordNueva: '',
        passwordNuevaRepetir: ''
      });
      setPasswordErrors([]);
      setEditMode(false);
      setActiveTab('datos');
    }
  }, [usuario]);

  const validatePasswordForm = (): boolean => {
    const errors: string[] = [];
    
    if (!passwordForm.passwordActual) {
      errors.push('La contraseña actual es requerida');
    }
    
    if (!passwordForm.passwordNueva) {
      errors.push('La nueva contraseña es requerida');
    } else if (passwordForm.passwordNueva.length < 8) {
      errors.push('La nueva contraseña debe tener al menos 8 caracteres');
    }
    
    if (!passwordForm.passwordNuevaRepetir) {
      errors.push('Debe repetir la nueva contraseña');
    } else if (passwordForm.passwordNueva !== passwordForm.passwordNuevaRepetir) {
      errors.push('Las contraseñas nuevas no coinciden');
    }
    
    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleSaveDatos = async () => {
    if (!usuario) return;
    
    // Validaciones
    if (!datosForm.nombre.trim() || !datosForm.username.trim()) {
      toastError('Nombre y username son requeridos');
      return;
    }

    if (datosForm.username.includes(' ')) {
      toastError('El username no puede contener espacios');
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(datosForm.username)) {
      toastError('El username solo puede contener letras, números, guiones, guiones bajos y puntos');
      return;
    }

    setLoading(true);
    try {
      await usuarioService.updateDatos(usuario.id, {
        nombre: datosForm.nombre.trim(),
        username: datosForm.username.trim(),
        comision_turno: datosForm.comision_turno,
        comision_producto: datosForm.comision_producto
      });
      
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      toastSuccess('Datos actualizados correctamente');
      setEditMode(false);
      onSuccess();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleComisionesChange = (comisiones: { comision_turno: number; comision_producto: number }) => {
    setDatosForm(prev => ({ ...prev, ...comisiones }));
  };

  const handleSavePassword = async () => {
    if (!usuario || !validatePasswordForm()) return;

    setLoading(true);
    try {
      await usuarioService.updatePassword(usuario.id, {
        passwordActual: passwordForm.passwordActual,
        passwordNueva: passwordForm.passwordNueva
      });
      
      toastSuccess('Contraseña actualizada correctamente');
      setPasswordForm({
        passwordActual: '',
        passwordNueva: '',
        passwordNuevaRepetir: ''
      });
      setPasswordErrors([]);
      onClose();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (usuario) {
      setDatosForm({
        nombre: usuario.nombre,
        username: usuario.username
      });
      setEditMode(false);
    }
  };

  if (!usuario) return null;

  const tabs = [
    { id: 'datos', label: 'Datos' },
    { id: 'password', label: 'Contraseña' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={`Editar Usuario - ${usuario.nombre}`}
    >
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'datos' && (
        <div className="space-y-4">
          <div>
            <Input
              label="Nombre"
              value={editMode ? datosForm.nombre : usuario.nombre}
              onChange={(e) => setDatosForm(prev => ({ ...prev, nombre: e.target.value }))}
              disabled={!editMode || loading}
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <Input
              label="Username"
              value={editMode ? datosForm.username : usuario.username}
              onChange={(e) => setDatosForm(prev => ({ ...prev, username: e.target.value }))}
              disabled={!editMode || loading}
              placeholder="username"
            />
            {editMode && state.authUser?.tenant && (
              <p className="text-sm text-gray-400 mt-1">
                {datosForm.username}@{state.authUser.tenant}
              </p>
            )}
          </div>

          {/* Configuración de Comisiones - Para profesionales (staff y admin que atienden) */}
          {(usuario.roles.includes('staff') || usuario.roles.includes('admin')) && (
            <div>
              {editMode ? (
                <ComisionesForm
                  comisiones={{
                    comision_turno: datosForm.comision_turno || 20,
                    comision_producto: datosForm.comision_producto || 20
                  }}
                  onChange={handleComisionesChange}
                  disabled={loading}
                  showTitle={false}
                />
              ) : (
                <ComisionesForm
                  comisiones={{
                    comision_turno: usuario.comision_turno || 20,
                    comision_producto: usuario.comision_producto || 20
                  }}
                  onChange={() => {}}
                  disabled={true}
                  showTitle={false}
                />
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            {!editMode ? (
              <Button
                onClick={() => setEditMode(true)}
                disabled={loading}
              >
                Editar
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSaveDatos}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="space-y-4">
          <div>
            <Input
              label="Contraseña Actual"
              type="password"
              value={passwordForm.passwordActual}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, passwordActual: e.target.value }))}
              disabled={loading}
              placeholder="Ingrese su contraseña actual"
            />
          </div>

          <div>
            <Input
              label="Nueva Contraseña"
              type="password"
              value={passwordForm.passwordNueva}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, passwordNueva: e.target.value }))}
              disabled={loading}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <Input
              label="Repetir Nueva Contraseña"
              type="password"
              value={passwordForm.passwordNuevaRepetir}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, passwordNuevaRepetir: e.target.value }))}
              disabled={loading}
              placeholder="Repita la nueva contraseña"
            />
          </div>

          {passwordErrors.length > 0 && (
            <div className="space-y-1">
              {passwordErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="pt-2">
            <a 
              href="#" 
              className="text-sm text-blue-600 hover:text-blue-700"
              onClick={(e) => e.preventDefault()}
            >
              // TODO: implementar flujo de recuperación de contraseña
            </a>
          </div>

          {/* Configuración de Comisiones - Para profesionales (staff y admin que atienden) */}
          {(usuario.roles.includes('staff') || usuario.roles.includes('admin')) && (
            <div>
              {editMode ? (
                <ComisionesForm
                  comisiones={{
                    comision_turno: datosForm.comision_turno || 20,
                    comision_producto: datosForm.comision_producto || 20
                  }}
                  onChange={handleComisionesChange}
                  disabled={loading}
                  showTitle={false}
                />
              ) : (
                <ComisionesForm
                  comisiones={{
                    comision_turno: usuario.comision_turno || 20,
                    comision_producto: usuario.comision_producto || 20
                  }}
                  onChange={() => {}}
                  disabled={true}
                  showTitle={false}
                />
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleSavePassword}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPasswordForm({
                  passwordActual: '',
                  passwordNueva: '',
                  passwordNuevaRepetir: ''
                });
                setPasswordErrors([]);
              }}
              disabled={loading}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
