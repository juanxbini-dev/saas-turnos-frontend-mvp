import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !turno) return null;

  const handleCancelar = () => {
    onCancelar(turno);
    onClose();
  };

  const puedeCancelar = turno.estado === 'pendiente' || turno.estado === 'confirmado';

  // Contenido compartido entre ambas variantes
  const content = (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-gray-500">Cliente</p>
        <p className="font-medium text-gray-900">{turno.cliente_nombre}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">Servicio</p>
        <p className="font-medium text-gray-900">{turno.servicio}</p>
      </div>
      <div className="flex gap-4">
        <div>
          <p className="text-sm text-gray-500">Hora</p>
          <p className="font-medium text-gray-900">{turno.hora}</p>
        </div>
        {turno.duracion_minutos && (
          <div>
            <p className="text-sm text-gray-500">Duración</p>
            <p className="font-medium text-gray-900">{turno.duracion_minutos} min</p>
          </div>
        )}
        {turno.precio != null && (
          <div>
            <p className="text-sm text-gray-500">Precio</p>
            <p className="font-medium text-gray-900">${turno.precio}</p>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500">Estado</p>
        <TurnoEstadoBadge estado={turno.estado} />
      </div>
      {turno.notas && (
        <div>
          <p className="text-sm text-gray-500">Notas</p>
          <p className="text-sm text-gray-700 italic">{turno.notas}</p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
        <div className="turno-popover fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />
          <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Detalles del Turno</h3>
            <button onClick={onClose} className="text-gray-400 active:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4">
            {content}
          </div>
          {puedeCancelar && (
            <div className="px-5 pb-4 pt-2 border-t border-gray-100">
              <Button variant="danger" size="sm" onClick={handleCancelar} className="w-full">
                Cancelar Turno
              </Button>
            </div>
          )}
          <div className="pb-6" />
        </div>
      </>,
      document.body
    );
  }

  // Desktop: popover flotante con clamping de posición
  const popoverW = 288; // min-w-72
  const clampedLeft = Math.max(8, Math.min(position.x - popoverW / 2, window.innerWidth - popoverW - 8));
  const clampedTop  = Math.min(position.y, window.innerHeight - 320);

  return (
    <div
      className="turno-popover fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-72"
      style={{ left: clampedLeft, top: clampedTop }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900">Detalles del Turno</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      {content}
      {puedeCancelar && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Button variant="danger" size="sm" onClick={handleCancelar} className="w-full">
            Cancelar Turno
          </Button>
        </div>
      )}
    </div>
  );
}
