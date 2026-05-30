import React from 'react';
import { AlertCircle, User, Mail, Phone } from 'lucide-react';
import { Button } from '../ui';
import { Cliente } from '../../types/cliente.types';

interface ClienteDuplicadoModalProps {
  isOpen: boolean;
  mensaje: string;
  cliente: Cliente | null;
  onClose: () => void;
  /** Si se provee, muestra el botón "Usar este cliente" con el cliente existente. */
  onUsar?: (cliente: Cliente) => void;
}

/**
 * Aviso amable cuando se intenta crear un cliente con un email/teléfono que ya
 * existe. Muestra los datos del cliente existente y, opcionalmente, permite
 * usarlo en lugar de crear uno nuevo.
 */
export const ClienteDuplicadoModal: React.FC<ClienteDuplicadoModalProps> = ({
  isOpen,
  mensaje,
  cliente,
  onClose,
  onUsar
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">El cliente ya existe</h3>
        </div>

        <p className="text-sm text-gray-600 mb-3">{mensaje}</p>

        {cliente && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <User size={14} className="text-gray-400 shrink-0" />
              {cliente.nombre}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={13} className="text-gray-400 shrink-0" />
              {cliente.email}
            </div>
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
          <Button onClick={onClose} variant="secondary" className="w-full">
            {onUsar ? 'Cancelar' : 'Entendido'}
          </Button>
        </div>
      </div>
    </div>
  );
};
