import React, { useEffect } from 'react';
import { TurnoConDetalle } from '../../types/turno.types';
import { TurnoEstadoBadge } from '../ui/TurnoEstadoBadge';
import { Button } from '../ui';
import { X } from 'lucide-react';

interface TurnoPopoverProps {
  turno: TurnoConDetalle | null
  isOpen: boolean
  onClose: () => void
  onCancelar: (turno: TurnoConDetalle) => void
  position: { x: number; y: number }
}

export function TurnoPopover({ 
  turno, 
  isOpen, 
  onClose, 
  onCancelar,
  position 
}: TurnoPopoverProps) {
  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.turno-popover')) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !turno) return null;

  const handleCancelar = () => {
    onCancelar(turno);
    onClose();
  };

  const puedeCancelar = turno.estado === 'pendiente' || turno.estado === 'confirmado';

  return (
    <div
      className="turno-popover fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-72"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, 0)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900">Detalles del Turno</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div>
          <p className="text-sm text-gray-600">Cliente</p>
          <p className="font-medium text-gray-900">{turno.cliente_nombre}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Servicio</p>
          <p className="font-medium text-gray-900">{turno.servicio}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Hora</p>
          <p className="font-medium text-gray-900">{turno.hora}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Estado</p>
          <TurnoEstadoBadge estado={turno.estado} />
        </div>

        {turno.notas && (
          <div>
            <p className="text-sm text-gray-600">Notas</p>
            <p className="text-sm text-gray-700">{turno.notas}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {puedeCancelar && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Button
            variant="danger"
            size="sm"
            onClick={handleCancelar}
            className="w-full"
          >
            Cancelar Turno
          </Button>
        </div>
      )}
    </div>
  );
}
