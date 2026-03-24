import { useState, useEffect, useCallback, useRef } from 'react';
import { CacheOptions, FetchState } from '../cache/types';
import { cacheService } from '../cache/cache.service';

// IMPORTANTE: Siempre construir keys usando buildKey de key.builder.ts
// Nunca escribir keys a mano en los componentes para garantizar el aislamiento por tenant
import { buildKey } from '../cache/key.builder';

export function useFetch<T>(
  key: string | null, 
  fetcher: () => Promise<T>, 
  options?: CacheOptions
): FetchState<T> & { revalidate: () => void } {
  const { ttl, persist, revalidateOnFocus } = options || {};
  
  const [state, setState] = useState<FetchState<T>>(() => {
    // Si no hay key, no usar caché
    if (!key) {
      return {
        data: null,
        loading: true,
        error: null
      };
    }
    
    // Si hay ttl, inicializar con datos del caché si existen
    if (ttl) {
      const cachedData = cacheService.get<T>(key, persist);
      return {
        data: cachedData,
        loading: !cachedData,
        error: null
      };
    }
    
    // Si no hay ttl, comportamiento normal sin caché
    return {
      data: null,
      loading: true,
      error: null
    };
  });

  // Usar useRef para evitar que el callback cambie
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async (showLoading: boolean) => {
    setState(prev => ({ ...prev, loading: showLoading || !prev.data, error: null }));

    try {
      const data = await fetcherRef.current();

      if (ttl && key) {
        cacheService.set(key, data, ttl, persist);
      }

      setState({ data, loading: false, error: null });
    } catch (error) {
      console.error(' [useFetch] Fetcher error for key:', key, error);
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [key, ttl, persist]);

  const revalidate = useCallback(() => fetchData(false), [fetchData]);

  // Ejecutar fetcher al montar y cuando cambian las dependencias clave
  useEffect(() => {
    fetchData(true);
  }, [key, ttl, persist]);

  // Revalidar on focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      revalidate();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [revalidateOnFocus, revalidate]);

  return { ...state, revalidate };
}

/*
Ejemplos de uso:

// Sin caché — datos operativos
const { data } = useFetch(
  buildKey(ENTITIES.ORDERS), 
  () => axiosInstance.get('/orders').then(r => r.data.data)
);

// Con caché en memoria — catálogo
const { data } = useFetch(
  buildKey(ENTITIES.PRODUCTS), 
  () => axiosInstance.get('/products').then(r => r.data.data), 
  { ttl: TTL.LONG }
);

// Con caché persistido — perfil
const { data } = useFetch(
  buildKey(ENTITIES.USER, 'profile'), 
  () => axiosInstance.get('/user/profile').then(r => r.data.data), 
  { ttl: TTL.MEDIUM, persist: true }
);
*/
