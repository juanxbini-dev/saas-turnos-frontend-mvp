import React from 'react';

interface ErrorFallbackProps {
  onRetry?: () => void;
  title?: string;
  message?: string;
}

/**
 * Pantalla de error genérica y profesional que usa el ErrorBoundary internamente.
 * Diseño limpio con Tailwind CSS, sin tecnicismos ni stack traces.
 * 
 * @param onRetry - Función para reintentar (por defecto: window.location.reload)
 * @param title - Título personalizado (opcional)
 * @param message - Mensaje personalizado (opcional)
 */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  onRetry,
  title = "Algo salió mal",
  message = "Ha ocurrido un error inesperado. Por favor, intenta nuevamente."
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Icono de error */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {title}
        </h1>
        
        {/* Mensaje */}
        <p className="text-gray-600 mb-6">
          {message}
        </p>
        
        {/* Botón de reintentar */}
        <button
          onClick={handleRetry}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Reintentar
        </button>
        
        {/* Texto de ayuda adicional */}
        <p className="text-sm text-gray-500 mt-4">
          Si el problema persiste, contacta al soporte técnico.
        </p>
      </div>
    </div>
  );
};

export default ErrorFallback;
