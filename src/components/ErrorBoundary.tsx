import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

/**
 * Error Boundary que captura errores de render y muestra una pantalla de error genérica
 * sin romper toda la aplicación.
 * 
 * @param children - Componentes hijos a proteger
 * @param fallback - Componente personalizado para mostrar en caso de error (opcional)
 * @param onError - Callback para cuando se quiera agregar logging externo (opcional)
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.log('🛡️ getDerivedStateFromError - Error recibido:', error.message);
    // Actualiza el estado para mostrar la UI de error
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): ErrorBoundaryState | null {
  // Eliminado temporalmente para debugging
  return null;
}

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Llamar al callback de error si se proporcionó (para futuro logging con Sentry, etc.)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log en consola para desarrollo
    console.error('Error capturado por ErrorBoundary:', error);
    console.error('Error Info:', errorInfo);
  }

  handleRetry = () => {
    // Recargar la página para reiniciar el estado
    window.location.reload();
  };

  render() {
    console.log('🛡️ ErrorBoundary render - hasError:', this.state.hasError);
    console.log('🛡️ ErrorBoundary render - has fallback:', !!this.props.fallback);
    
    if (this.state.hasError) {
      console.log('🛡️ ErrorBoundary - Mostrando pantalla de error');
      
      // Si se proporcionó un fallback personalizado, usarlo
      if (this.props.fallback) {
        console.log('🛡️ ErrorBoundary - Usando fallback personalizado');
        return this.props.fallback;
      }

      console.log('🛡️ ErrorBoundary - Usando pantalla de error por defecto');
      
      // Si no, mostrar la pantalla de error por defecto
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
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
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h1>
            
            <p className="text-gray-600 mb-6">
              Ha ocurrido un error inesperado. Por favor, intenta nuevamente.
            </p>
            
            <button
              onClick={this.handleRetry}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    console.log('🛡️ ErrorBoundary - Renderizando children normalmente');
    // Si no hay error, renderizar los children normalmente
    return this.props.children;
  }
}

export default ErrorBoundary;

/*
Ejemplos de uso en la aplicación:

// 1. Envolver la aplicación principal
<ErrorBoundary>
  <App />
</ErrorBoundary>

// 2. Aislar un módulo específico
<ErrorBoundary fallback={<p>Error cargando productos</p>}>
  <ProductList />
</ErrorBoundary>

// 3. Con callback para logging futuro
<ErrorBoundary 
  onError={(error, info) => {
    // Futuro: enviar a Sentry
    console.log('Error para logging:', error, info);
  }}
>
  <CriticalComponent />
</ErrorBoundary>

// 4. Con fallback personalizado
<ErrorBoundary 
  fallback={
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
      <p>No se pudieron cargar los productos. Intente recargar la página.</p>
    </div>
  }
>
  <ProductCatalog />
</ErrorBoundary>
*/
