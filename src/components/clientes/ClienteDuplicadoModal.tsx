import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, User, Mail, Phone } from 'lucide-react';
import { Button } from '../ui';
import { Cliente } from '../../types/cliente.types';
import { MotivoDuplicado } from '../../services/cliente.service';

interface ClienteDuplicadoModalProps {
  isOpen: boolean;
  mensaje: string;
  cliente: Cliente | null;
  onClose: () => void;
  /** Si se provee, muestra el botón "Usar este cliente" con el cliente existente. */
  onUsar?: (cliente: Cliente) => void;
  motivo?: MotivoDuplicado;
  /** Si se provee, muestra el botón para seguir igual porque es otra persona. */
  onCrearIgual?: () => void;
  textoCrearIgual?: string;
}

const tituloPorMotivo = (motivo?: MotivoDuplicado) => {
  if (motivo === 'telefono_otro_nombre') return 'Ese teléfono ya está cargado';
  if (motivo === 'nombre') return '¿Es la misma persona?';
  return 'El cliente ya existe';
};

/**
 * Aviso amable cuando se intenta crear un cliente con datos que ya tiene otra
 * ficha. Muestra la ficha existente y, opcionalmente, permite usarla en lugar de
 * crear una nueva, o seguir igual si es otra persona (una familia comparte número).
 */
export const ClienteDuplicadoModal: React.FC<ClienteDuplicadoModalProps> = ({
  isOpen,
  mensaje,
  cliente,
  onClose,
  onUsar,
  motivo,
  onCrearIgual,
  textoCrearIgual = 'Es otra persona, crear igual'
}) => {
  if (!isOpen) return null;

  // Por portal: dentro de un Modal, el transform del panel haría que "fixed" se centre en el panel
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{tituloPorMotivo(motivo)}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-3">{mensaje}</p>

        {cliente && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <User size={14} className="text-gray-400 shrink-0" />
              {cliente.nombre}
            </div>
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={13} className="text-gray-400 shrink-0" />
                {cliente.email}
              </div>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={13} className="text-gray-400 shrink-0" />
                {cliente.telefono}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {onUsar && cliente && (
            <Button onClick={() => onUsar(cliente)} variant="primary" className="w-full">
              Usar este cliente
            </Button>
          )}
          {onCrearIgual && (
            <Button onClick={onCrearIgual} variant="outline" className="w-full">
              {textoCrearIgual}
            </Button>
          )}
          <Button onClick={onClose} variant="secondary" className="w-full">
            {onUsar || onCrearIgual ? 'Cancelar' : 'Entendido'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
