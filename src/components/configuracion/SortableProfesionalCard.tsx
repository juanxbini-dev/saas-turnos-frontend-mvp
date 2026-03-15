import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Avatar } from '../ui';
import { AvatarUploader } from '../perfil';
import { LandingProfesional } from '../../types/landing.types';
import { configuracionService } from '../../services/configuracion.service';
import { perfilService } from '../../services/perfil.service';
import { useToast } from '../../hooks/useToast';
import { Usuario } from '../../types/usuario.types';

interface SortableProfesionalCardProps {
  profesional: LandingProfesional;
  onUpdate: (updated: Partial<LandingProfesional>) => void;
}

export function SortableProfesionalCard({ profesional, onUpdate }: SortableProfesionalCardProps) {
  const [descripcion, setDescripcion] = useState(profesional.descripcion || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [togglingVisible, setTogglingVisible] = useState(false);
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

  const handleAvatarUpdate = (updatedUser: Usuario) => {
    onUpdate({ avatar_url: updatedUser.avatar_url });
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
          <div className="flex-shrink-0">
            <AvatarUploader
              currentUrl={profesional.avatar_url}
              name={profesional.nombre}
              onUpdate={handleAvatarUpdate}
              compact
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
