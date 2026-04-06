import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { usuarioService } from '../../services/usuario.service';
import { useToast } from '../../hooks/useToast';

interface CambiarPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function CambiarPasswordModal({ isOpen, onClose, userId }: CambiarPasswordModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    passwordActual: '',
    passwordNueva: '',
    passwordNuevaConfirm: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.passwordActual) newErrors.passwordActual = 'Ingresá tu contraseña actual';
    if (!form.passwordNueva) newErrors.passwordNueva = 'Ingresá la nueva contraseña';
    if (form.passwordNueva.length < 6) newErrors.passwordNueva = 'Mínimo 6 caracteres';
    if (form.passwordNueva !== form.passwordNuevaConfirm) {
      newErrors.passwordNuevaConfirm = 'Las contraseñas no coinciden';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await usuarioService.updatePassword(userId, {
        passwordActual: form.passwordActual,
        passwordNueva: form.passwordNueva
      });
      toast.success('Contraseña actualizada correctamente');
      setForm({ passwordActual: '', passwordNueva: '', passwordNuevaConfirm: '' });
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al cambiar la contraseña';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({ passwordActual: '', passwordNueva: '', passwordNuevaConfirm: '' });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cambiar contraseña"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Contraseña actual"
          type="password"
          prefix={Lock}
          value={form.passwordActual}
          onChange={handleChange('passwordActual')}
          error={errors.passwordActual}
          autoComplete="current-password"
        />
        <Input
          label="Nueva contraseña"
          type="password"
          prefix={Lock}
          value={form.passwordNueva}
          onChange={handleChange('passwordNueva')}
          error={errors.passwordNueva}
          help="Mínimo 6 caracteres"
          autoComplete="new-password"
        />
        <Input
          label="Confirmar nueva contraseña"
          type="password"
          prefix={Lock}
          value={form.passwordNuevaConfirm}
          onChange={handleChange('passwordNuevaConfirm')}
          error={errors.passwordNuevaConfirm}
          autoComplete="new-password"
        />
      </form>
    </Modal>
  );
}
