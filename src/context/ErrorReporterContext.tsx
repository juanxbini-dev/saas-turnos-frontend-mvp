import React, { createContext, useContext, useEffect, useState } from 'react';

export interface ErrorReport {
  requestId: string;
  status: number | null;
  message: string | null;
  url: string | null;
  timestamp: string;
  userAgent: string;
}

interface ErrorReporterContextValue {
  lastError: ErrorReport | null;
  clearError: () => void;
}

const ErrorReporterContext = createContext<ErrorReporterContextValue>({
  lastError: null,
  clearError: () => {},
});

export const ErrorReporterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastError, setLastError] = useState<ErrorReport | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Solo mostrar modal cuando hay requestId real del backend
      if (!detail?.requestId) return;
      setLastError({
        requestId: detail.requestId,
        status: detail.status ?? null,
        message: detail.message ?? null,
        url: detail.url ?? null,
        timestamp: new Date().toLocaleString('es-AR'),
        userAgent: navigator.userAgent,
      });
    };
    window.addEventListener('app:error', handler);
    return () => window.removeEventListener('app:error', handler);
  }, []);

  return (
    <ErrorReporterContext.Provider value={{ lastError, clearError: () => setLastError(null) }}>
      {children}
    </ErrorReporterContext.Provider>
  );
};

export const useErrorReporter = () => useContext(ErrorReporterContext);
