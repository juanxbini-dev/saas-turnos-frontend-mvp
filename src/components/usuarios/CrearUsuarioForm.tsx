import React, { useState } from 'react';
import { Card, Input, Select, Button } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { CreateUsuarioData, UsuarioRol } from '../../types/usuario.types';
import { useToast } from '../../hooks/useToast';
import { cacheService } from '../../cache/cache.service';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
import { ComisionesForm } from './ComisionesForm';

interface CrearUsuarioFormProps {
  onSuccess: () => void;
}

export const CrearUsuarioForm: React.FC<CrearUsuarioFormProps> = ({ onSuccess }) => {
  const { state } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    username: '',
    email: '',
    password: '',
    rol: 'staff' as UsuarioRol,
    comision_turno: 20,
    comision_producto: 20
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug
    console.log('FormData actual:', formData);
    
    // Validaciones
    if (!formData.nombre.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      console.log('Validación fallida:', {
        nombre: formData.nombre.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        nombreLength: formData.nombre.length,
        usernameLength: formData.username.length,
        emailLength: formData.email.length,
        passwordLength: formData.password.length
      });
      toastError('Todos los campos son requeridos');
      return;
    }

    if (formData.username.includes(' ')) {
      toastError('El username no puede contener espacios');
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      toastError('El username solo puede contener letras, números, guiones, guiones bajos y puntos');
      return;
    }

    if (formData.password.length < 8) {
      toastError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      const data: CreateUsuarioData = {
        nombre: formData.nombre.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        rol: formData.rol
      };

      await usuarioService.createUsuario(data);
      
      // Invalidar caché
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      
      toastSuccess('Usuario creado correctamente');
      
      // Resetear formulario
      setFormData({
        nombre: '',
        username: '',
        email: '',
        password: '',
        rol: 'staff',
        comision_turno: 20,
        comision_producto: 20
      });
      
      onSuccess();
    } catch (error: any) {
      toastError(error.response?.data?.message || error.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const stringValue = typeof value === 'string' ? value : value.target.value;
    setFormData(prev => ({ ...prev, [field]: stringValue }));
  };

  const handleComisionesChange = (comisiones: { comision_turno: number; comision_producto: number }) => {
    setFormData(prev => ({ ...prev, ...comisiones }));
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuevo Usuario</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => handleChange('nombre', e)}
            placeholder="Nombre completo"
            disabled={loading}
          />
        </div>

        <div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e)}
            placeholder="email@ejemplo.com"
            disabled={loading}
          />
        </div>

        <div>
          <Input
            label="Username"
            value={formData.username}
            onChange={(e) => handleChange('username', e)}
            placeholder="username"
            disabled={loading}
          />
          {formData.username && state.authUser?.tenant && (
            <p className="text-sm text-gray-400 mt-1">
              {formData.username}@{state.authUser.tenant}
            </p>
          )}
        </div>

        <div>
          <Input
            label="Contraseña"
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e)}
            placeholder="Mínimo 8 caracteres"
            disabled={loading}
          />
        </div>

        <div>
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
        </div>

        {/* Configuración de Comisiones - Para profesionales (staff y admin que atienden) */}
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
