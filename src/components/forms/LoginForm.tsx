import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .regex(/^[a-zA-Z0-9_]+@[a-zA-Z0-9.-]+$/, 'Formato inválido. Use: usuario@empresa'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginForm({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  // Sincronizar valores externos con react-hook-form
  React.useEffect(() => {
    setValue('email', email);
    setValue('password', password);
  }, [email, password, setValue]);

  const onFormSubmit = () => {
    // Validar antes de enviar
    trigger().then((isValid) => {
      if (isValid) {
        onSubmit();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" autoComplete="off">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => {
          const value = e.target.value;
          onEmailChange(value);
          setValue('email', value);
          trigger('email');
        }}
        error={errors.email?.message}
        placeholder="usuario@empresa"
        disabled={loading}
        autoComplete="off"
        readOnly={loading}
      />

      <Input
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => {
          const value = e.target.value;
          onPasswordChange(value);
          setValue('password', value);
          trigger('password');
        }}
        error={errors.password?.message}
        placeholder="••••••••"
        disabled={loading}
        autoComplete="new-password"
        readOnly={loading}
      />

      {error && <ErrorMessage message={error} />}

      <Button
        type="submit"
        loading={loading}
        disabled={loading}
      >
        Iniciar Sesión
      </Button>
    </form>
  );
}
