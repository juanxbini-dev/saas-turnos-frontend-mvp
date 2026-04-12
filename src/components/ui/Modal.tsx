import React, { useEffect, forwardRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Modal con overlay oscuro y panel centrado con animaciones
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    footer, 
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true
  }, ref) => {
    useEffect(() => {
      if (!isOpen || !closeOnEscape) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, closeOnEscape]);

    if (!isOpen) return null;

    const sizeClasses = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl'
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    };

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleOverlayClick}
        />
        
        {/* Modal container */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            ref={ref}
            className={`
              relative w-full bg-white rounded-lg shadow-xl 
              transform transition-all duration-300 scale-100 opacity-100
              ${sizeClasses[size]}
            `}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            {!title && onClose && (
              <div className="flex justify-end px-6 py-4">
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
            {/* Body */}
            <div className="px-6 py-4">
              {children}
            </div>
            
            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

/*
Ejemplos de uso:

// Modal básico
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Confirmar acción"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleConfirm}>
        Confirmar
      </Button>
    </div>
  }
>
  <p>¿Estás seguro de que deseas realizar esta acción?</p>
</Modal>

// Modal grande con formulario
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Nuevo usuario"
  size="lg"
>
  <form className="space-y-4">
    <Input label="Nombre" value={name} onChange={setName} />
    <Input label="Email" type="email" value={email} onChange={setEmail} />
    <Select 
      label="Rol" 
      options={roleOptions} 
      value={role} 
      onChange={setRole} 
    />
  </form>
</Modal>

// Modal sin título (solo overlay)
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  size="sm"
>
  <div className="text-center">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
      <CheckIcon size={24} className="text-green-600" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">¡Éxito!</h3>
    <p className="text-sm text-gray-500">La operación se completó correctamente.</p>
  </div>
</Modal>

// Modal que no cierra con overlay ni escape
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Formulario crítico"
  closeOnOverlayClick={false}
  closeOnEscape={false}
>
  <p>Este modal requiere acción explícita para cerrarse.</p>
</Modal>
*/
