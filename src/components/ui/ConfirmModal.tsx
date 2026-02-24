import React from 'react';
import { Modal, Button } from './index';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'secondary';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar acción',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  loading = false
}) => {
  const handleConfirm = () => {
    onConfirm();
    // No cerrar automáticamente, dejar que la acción lo cierre
  };

  const handleCancel = () => {
    onClose();
  };

  const footer = (
    <div className="flex justify-end gap-3">
      <Button
        variant="secondary"
        onClick={handleCancel}
        disabled={loading}
      >
        {cancelText}
      </Button>
      <Button
        variant={variant}
        onClick={handleConfirm}
        loading={loading}
        disabled={loading}
      >
        {confirmText}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size="sm"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
    >
      <div className="text-gray-600">
        {typeof message === 'string' ? (
          <div dangerouslySetInnerHTML={{ __html: message }} />
        ) : (
          message
        )}
      </div>
    </Modal>
  );
};

/*
Ejemplos de uso:

// Confirmación básica
<ConfirmModal
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  onConfirm={handleDelete}
  message="¿Estás seguro de que deseas eliminar este elemento?"
  confirmText="Eliminar"
  variant="danger"
/>

// Confirmación de turno
<ConfirmModal
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  onConfirm={handleConfirmTurno}
  title="Confirmar turno"
  message="¿Estás seguro de que deseas confirmar el turno de Juan Pérez?"
  confirmText="Confirmar turno"
  variant="primary"
/>

// Confirmación con loading
<ConfirmModal
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  onConfirm={handleAsyncAction}
  message="Esta acción no se puede deshacer. ¿Deseas continuar?"
  loading={isProcessing}
  variant="danger"
/>
*/
