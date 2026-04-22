import React, { useState } from 'react';
import { Card, Input, Select, Button } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { CreateUsuarioData, UsuarioRol } from '../../types/usuario.types';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { ComisionesForm } from './ComisionesForm';

interface CrearUsuarioFormProps {
  onSuccess: () => void;
}

interface FormErrors {
  nombre?: string;
  email?: string;
  username?: string;
  telefono?: string;
  password?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(data: {
  nombre: string;
  email: string;
  username: string;
  telefono: string;
  password: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!data.nombre.trim()) {
    errors.nombre = 'El nombre es requerido';
  }

  if (!data.email.trim()) {
    errors.email = 'El email es requerido';
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'El email no es válido';
  }

  if (!data.username.trim()) {
    errors.username = 'El username es requerido';
  } else if (!USERNAME_REGEX.test(data.username.trim())) {
    errors.username = 'Solo letras, números, puntos, guiones y guiones bajos (sin espacios)';
  }

  if (!data.telefono.trim()) {
    errors.telefono = 'El teléfono es requerido';
  }

  if (!data.password) {
    errors.password = 'La contraseña es requerida';
  } else if (data.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres';
  }

  return errors;
}

export const CrearUsuarioForm: React.FC<CrearUsuarioFormProps> = ({ onSuccess }) => {
  const { state } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    nombre: '',
    username: '',
    email: '',
    telefono: '',
    password: '',
    rol: 'staff' as UsuarioRol,
    comision_turno: 0,
    comision_producto: 0
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar el error del campo al editar
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: keyof FormErrors) => {
    const fieldErrors = validateForm(formData);
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldErrors = validateForm(formData);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const data: CreateUsuarioData = {
        nombre: formData.nombre.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim() || null,
        password: formData.password,
        rol: formData.rol,
        comision_turno: formData.comision_turno,
        comision_producto: formData.comision_producto
      };

      await usuarioService.createUsuario(data);

      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      toastSuccess('Usuario creado correctamente');

      setFormData({
        nombre: '',
        username: '',
        email: '',
        telefono: '',
        password: '',
        rol: 'staff',
        comision_turno: 0,
        comision_producto: 0
      });
      setErrors({});

      onSuccess();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleComisionesChange = (comisiones: { comision_turno: number; comision_producto: number }) => {
    setFormData(prev => ({ ...prev, ...comisiones }));
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuevo Usuario</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          onBlur={() => handleBlur('nombre')}
          placeholder="Nombre completo"
          error={errors.nombre}
          disabled={loading}
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="email@ejemplo.com"
          error={errors.email}
          disabled={loading}
        />

        <Input
          label="Teléfono"
          type="tel"
          value={formData.telefono}
          onChange={(e) => handleChange('telefono', e.target.value)}
          onBlur={() => handleBlur('telefono')}
          placeholder="+54 11 2345-6789"
          error={errors.telefono}
          disabled={loading}
        />

        <Input
          label="Username"
          value={formData.username}
          onChange={(e) => handleChange('username', e.target.value)}
          onBlur={() => handleBlur('username')}
          placeholder="username"
          error={errors.username}
          help={
            formData.username && state.authUser?.tenant && !errors.username
              ? `${formData.username}@${state.authUser.tenant}`
              : undefined
          }
          disabled={loading}
        />

        <Input
          label="Contraseña"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          placeholder="Mínimo 8 caracteres"
          error={errors.password}
          disabled={loading}
        />

        <Select
          label="Rol"
          value={formData.rol}
          onChange={(e) => handleChange('rol', e.target.value as UsuarioRol)}
          options={[
            { value: 'staff', label: 'Staff' },
            { value: 'admin', label: 'Administrador' }
          ]}
          disabled={loading}
        />

        {(formData.rol === 'staff' || formData.rol === 'admin') && (
          <ComisionesForm
            comisiones={{
              comision_turno: formData.comision_turno,
              comision_producto: formData.comision_producto
            }}
            onChange={handleComisionesChange}
            disabled={loading}
          />
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creando...' : 'Crear Usuario'}
        </Button>
      </form>
    </Card>
  );
};
