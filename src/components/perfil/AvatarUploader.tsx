import { useState, useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar, Button, Spinner } from '../ui';
import { perfilService } from '../../services/perfil.service';
import { useToast } from '../../hooks/useToast';
import { Usuario } from '../../types/usuario.types';

interface AvatarUploaderProps {
  currentUrl?: string | null;
  name: string;
  onUpdate: (profile: Usuario) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function AvatarUploader({ currentUrl, name, onUpdate }: AvatarUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Solo se permiten imagenes JPG, PNG o WebP');
      return;
    }

    // Validar tamano
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`La imagen no puede superar ${MAX_SIZE_MB}MB`);
      return;
    }

    // Preview local
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);

    try {
      const updatedProfile = await perfilService.uploadAvatar(file);
      onUpdate(updatedProfile);
      toast.success('Avatar actualizado correctamente');
    } catch (error) {
      toast.error('Error al subir la imagen');
      setPreview(null);
    } finally {
      setLoading(false);
      URL.revokeObjectURL(objectUrl);
      // Limpiar input para permitir subir el mismo archivo de nuevo
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentUrl && !preview) return;

    setLoading(true);
    try {
      const updatedProfile = await perfilService.deleteAvatar();
      onUpdate(updatedProfile);
      setPreview(null);
      toast.success('Avatar eliminado correctamente');
    } catch (error) {
      toast.error('Error al eliminar el avatar');
    } finally {
      setLoading(false);
    }
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar
          src={displayUrl || undefined}
          name={name}
          size="lg"
          className="!w-24 !h-24 !text-2xl"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={loading}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <Camera className="w-4 h-4 mr-1" />
          {currentUrl ? 'Cambiar' : 'Subir'}
        </Button>
        {(currentUrl || preview) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Eliminar
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        JPG, PNG o WebP. Maximo {MAX_SIZE_MB}MB.
      </p>
    </div>
  );
}
