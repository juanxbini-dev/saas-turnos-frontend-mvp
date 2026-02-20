import React, { useState, useEffect } from 'react';
import { toastService } from '../services/toast.service';
import { Toast } from '../types/toast.types';
import ToastItem from './ToastItem';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Suscribirse al servicio de toasts
    const unsubscribe = toastService.subscribe((newToasts) => {
      setToasts(newToasts);
    });

    // Limpiar suscripción al desmontar
    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    toastService.dismiss(id);
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
