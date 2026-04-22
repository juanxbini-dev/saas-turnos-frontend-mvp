import React, { useRef, useState } from 'react';
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
    email: '',
    comision_turno: 0,
    comision_producto: 0,
    telefono: null
  });

  const [passwordForm, setPasswordForm] = useState<UpdatePasswordData>({
    passwordActual: '',
    passwordNueva: '',
    passwordNuevaRepetir: ''
  });

  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset forms when usuario changes
  React.useEffect(() => {
    if (usuario) {
      setDatosForm({
        nombre: usuario.nombre,
        username: usuario.username,
        email: usuario.email,
        comision_turno: usuario.comision_turno ?? 0,
        comision_producto: usuario.comision_producto ?? 0,
        telefono: usuario.telefono ?? null
      });
      setPasswordForm({
        passwordActual: '',
        passwordNueva: '',
        passwordNuevaRepetir: ''
      });
      setPasswordErrors([]);
      setEditMode(false);
      setActiveTab('datos');
      setAvatarPreview(null);
      setAvatarFile(null);
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

    if (!datosForm.nombre.trim() || !datosForm.username.trim() || !datosForm.email.trim()) {
      toastError('Nombre, username y email son requeridos');
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datosForm.email.trim())) {
      toastError('El email no tiene un formato válido');
      return;
    }

    setLoading(true);
    try {
      await usuarioService.updateDatos(usuario.id, {
        nombre: datosForm.nombre.trim(),
        username: datosForm.username.trim(),
        email: datosForm.email.trim(),
        comision_turno: datosForm.comision_turno,
        comision_producto: datosForm.comision_producto,
        telefono: datosForm.telefono?.trim() || null
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
        username: usuario.username,
        email: usuario.email,
        comision_turno: usuario.comision_turno ?? 0,
        comision_producto: usuario.comision_producto ?? 0,
        telefono: usuario.telefono ?? null
      });
      setEditMode(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toastError('Solo se aceptan imágenes JPG, PNG o WebP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toastError('La imagen no puede superar los 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!usuario || !avatarFile) return;

    setLoading(true);
    try {
      await usuarioService.uploadAvatarAdmin(usuario.id, avatarFile);
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      toastSuccess('Foto actualizada correctamente');
      setAvatarFile(null);
      setAvatarPreview(null);
      onSuccess();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al subir la foto');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      await usuarioService.deleteAvatarAdmin(usuario.id);
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      toastSuccess('Foto eliminada correctamente');
      setAvatarPreview(null);
      setAvatarFile(null);
      onSuccess();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al eliminar la foto');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!usuario) return null;

  const currentAvatarUrl = avatarPreview ?? usuario.avatar_url ?? null;

  const tabs = [
    { id: 'datos', label: 'Datos' },
    { id: 'foto', label: 'Foto' },
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

          <div>
            <Input
              label="Email"
              type="email"
              value={editMode ? datosForm.email : usuario.email}
              onChange={(e) => setDatosForm(prev => ({ ...prev, email: e.target.value }))}
              disabled={!editMode || loading}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <Input
              label="Teléfono"
              type="tel"
              value={editMode ? (datosForm.telefono ?? '') : (usuario.telefono ?? '')}
              onChange={(e) => setDatosForm(prev => ({ ...prev, telefono: e.target.value }))}
              disabled={!editMode || loading}
              placeholder="2915123123"
            />
          </div>

          {/* Configuración de Comisiones - Para profesionales (staff y admin que atienden) */}
          {(usuario.roles.includes('staff') || usuario.roles.includes('admin')) && (
            <div>
              {editMode ? (
                <ComisionesForm
                  comisiones={{
                    comision_turno: datosForm.comision_turno ?? 0,
                    comision_producto: datosForm.comision_producto ?? 0
                  }}
                  onChange={handleComisionesChange}
                  disabled={loading}
                  showTitle={false}
                />
              ) : (
                <ComisionesForm
                  comisiones={{
                    comision_turno: usuario.comision_turno ?? 0,
                    comision_producto: usuario.comision_producto ?? 0
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

      {activeTab === 'foto' && (
        <div className="space-y-5">
          {/* Avatar actual o preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={usuario.nombre}
                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-600"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                  <span className="text-4xl text-gray-400 font-semibold select-none">
                    {usuario.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {avatarPreview && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  Preview
                </span>
              )}
            </div>

            <p className="text-sm text-gray-400 text-center">
              {avatarPreview
                ? 'Vista previa — guardá para confirmar'
                : currentAvatarUrl
                ? 'Foto de perfil actual'
                : 'Sin foto de perfil'}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-3">
            {/* Seleccionar nueva foto */}
            {!avatarFile ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full"
                >
                  {currentAvatarUrl ? 'Cambiar foto' : 'Subir foto'}
                </Button>
                <p className="text-xs text-gray-500 mt-1 text-center">JPG, PNG o WebP — máx. 5MB</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleUploadAvatar}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Subiendo...' : 'Guardar foto'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancelAvatar}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Eliminar foto actual */}
            {usuario.avatar_url && !avatarFile && (
              <Button
                variant="ghost"
                onClick={handleDeleteAvatar}
                disabled={loading}
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-800/40"
              >
                {loading ? 'Eliminando...' : 'Eliminar foto'}
              </Button>
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
