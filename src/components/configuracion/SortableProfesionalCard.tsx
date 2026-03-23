import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Camera } from 'lucide-react';
import { Avatar, Spinner } from '../ui';
import { LandingProfesional } from '../../types/landing.types';
import { configuracionService } from '../../services/configuracion.service';
import { useToast } from '../../hooks/useToast';

interface SortableProfesionalCardProps {
  profesional: LandingProfesional;
  onUpdate: (updated: Partial<LandingProfesional>) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function SortableProfesionalCard({ profesional, onUpdate }: SortableProfesionalCardProps) {
  const [subtitulo, setSubtitulo] = useState(profesional.subtitulo || '');
  const [descripcion, setDescripcion] = useState(profesional.descripcion || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [togglingVisible, setTogglingVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: profesional.usuario_id,
    disabled: !profesional.visible
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const handleToggleVisible = async () => {
    setTogglingVisible(true);
    try {
      await configuracionService.updateProfesional(profesional.usuario_id, {
        visible: !profesional.visible
      });
      onUpdate({ visible: !profesional.visible });
    } catch {
      toast.error('Error al cambiar visibilidad');
    } finally {
      setTogglingVisible(false);
    }
  };

  const handleSubtituloBlur = async () => {
    if (subtitulo === (profesional.subtitulo || '')) return;
    try {
      await configuracionService.updateProfesional(profesional.usuario_id, { subtitulo });
      onUpdate({ subtitulo });
    } catch {
      toast.error('Error al guardar subtitulo');
    }
  };

  const handleDescripcionBlur = async () => {
    if (descripcion === (profesional.descripcion || '')) return;
    setSavingDesc(true);
    try {
      await configuracionService.updateProfesional(profesional.usuario_id, { descripcion });
      onUpdate({ descripcion });
    } catch {
      toast.error('Error al guardar descripcion');
    } finally {
      setSavingDesc(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Solo se permiten imagenes JPG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await configuracionService.uploadAvatarProfesional(profesional.usuario_id, file);
      onUpdate({ avatar_url: result.avatar_url });
      toast.success('Foto actualizada');
    } catch {
      toast.error('Error al subir la foto');
    } finally {
      setUploadingAvatar(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border-2 transition-colors ${
        profesional.visible
          ? 'border-gray-200 shadow-sm'
          : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle — solo si es visible */}
          <div
            {...(profesional.visible ? { ...attributes, ...listeners } : {})}
            className={`mt-1 flex-shrink-0 ${
              profesional.visible
                ? 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none'
                : 'text-gray-200 cursor-not-allowed'
            }`}
          >
            <GripVertical className="w-5 h-5" />
          </div>

          {/* Avatar */}
          <div
            className="flex-shrink-0 relative group cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <Avatar src={profesional.avatar_url || undefined} name={profesional.nombre} size="md" />
            {uploadingAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Camera className="w-3 h-3 text-white" />
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleAvatarChange}
              className="hidden"
              disabled={uploadingAvatar}
            />
          </div>

          {/* Info y descripcion */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900 text-sm">{profesional.nombre}</p>
                <p className="text-xs text-gray-400">@{profesional.username}</p>
              </div>

              {/* Toggle visible */}
              <button
                onClick={handleToggleVisible}
                disabled={togglingVisible}
                title={profesional.visible ? 'Ocultar de la landing' : 'Mostrar en la landing'}
                className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                  profesional.visible
                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {profesional.visible
                  ? <Eye className="w-4 h-4" />
                  : <EyeOff className="w-4 h-4" />
                }
              </button>
            </div>

            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              onBlur={handleSubtituloBlur}
              placeholder="Subtitulo (ej: CEO, Colorista...)"
              maxLength={100}
              className="mt-2 w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              onBlur={handleDescripcionBlur}
              placeholder="Descripcion para la landing (ej: Especialista en...)"
              rows={2}
              className="mt-2 w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {savingDesc && <p className="text-xs text-gray-400 mt-1">Guardando...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
