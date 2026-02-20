import { useState, useCallback, useRef } from 'react';

/**
 * Hook para capturar errores de red o de lógica async que el ErrorBoundary
 * no puede capturar por sí solo (errores en useEffect y fetchers).
 * 
 * Permite escalar errores al boundary más cercano usando el patrón
 * de setState con error, logrando que errores async sean manejados
 * por el sistema de error boundaries de React.
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);

  const throwError = useCallback((error: Error) => {
    console.log('🔥 useErrorHandler - throwError llamado con:', error.message);
    // Elevar el error al boundary más cercano
    console.log('🔥 useErrorHandler - Estableciendo error en estado');
    setError(error);
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Si hay un error, lanzarlo para que lo capture el ErrorBoundary
  if (error) {
    console.log('🔥 useErrorHandler - Lanzando error al ErrorBoundary');
    // Lanzar el error de forma síncrona para que lo capture el boundary
    throw error;
  }

  return { throwError, resetError };
}

/*
Ejemplos de uso con useFetch:

// Opción A — manejar localmente (default)
const { data, error } = useFetch(buildKey(ENTITIES.PRODUCTS), fetcher, { ttl: TTL.LONG });
if (error) return <p>Error local: {error.message}</p>;

// Opción B — escalar al boundary
const { throwError } = useErrorHandler();
const { data, error } = useFetch(buildKey(ENTITIES.PRODUCTS), fetcher, { ttl: TTL.LONG });
if (error) throwError(error);

// En useEffect con errores async
const { throwError } = useErrorHandler();
useEffect(() => {
  const fetchData = async () => {
    try {
      const data = await axiosInstance.get('/api/data');
      setData(data);
    } catch (error) {
      throwError(error instanceof Error ? error : new Error('Error fetching data'));
    }
  };
  fetchData();
}, [throwError]);
*/
