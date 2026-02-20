import React, { useEffect, useState } from 'react';
import { Toast } from '../types/toast.types';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animación de entrada
    const enterTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    if (toast.options?.persistent) {
      return; // No mostrar barra de progreso para toasts persistentes
    }

    const interval = 100; // Actualizar cada 100ms
    const decrement = (interval / toast.duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        const newValue = prev - decrement;
        if (newValue <= 0) {
          clearInterval(timer);
          return 0;
        }
        return newValue;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.duration, toast.options?.persistent]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Pequeña espera para la animación de salida
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const getIcon = () => {
    const iconClass = "w-5 h-5 flex-shrink-0";
    
    switch (toast.type) {
      case 'success':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: 'text-green-600',
          progress: 'bg-green-500'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'text-red-600',
          progress: 'bg-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600',
          progress: 'bg-yellow-500'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600',
          progress: 'bg-blue-500'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600',
          progress: 'bg-gray-500'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} ${colors.text}
        border rounded-lg shadow-lg p-4 mb-3 min-w-[300px] max-w-md
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start">
        {/* Icono */}
        <div className={`${colors.icon} mr-3 mt-0.5`}>
          {getIcon()}
        </div>

        {/* Mensaje */}
        <div className="flex-1 text-sm font-medium">
          {toast.message}
        </div>

        {/* Botón de cerrar */}
        <button
          onClick={handleDismiss}
          className={`${colors.icon} ml-3 hover:opacity-70 transition-opacity`}
          aria-label="Cerrar notificación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Barra de progreso (solo si no es persistente) */}
      {!toast.options?.persistent && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className={`${colors.progress} h-1 rounded-full transition-all duration-100 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ToastItem;
