import React, { useEffect } from 'react';
import { useFetch } from '../../hooks/useFetch';
import type { CacheOptions } from '../../cache/types';

interface SeccionCardProps {
  titulo: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
  etiqueta?: string;
}

// Contenedor común de las secciones de la pantalla de Campañas
export function SeccionCard({ titulo, subtitulo, accion, children, etiqueta }: SeccionCardProps) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6" aria-label={etiqueta ?? titulo}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
          {subtitulo && <p className="text-sm text-gray-500 mt-0.5">{subtitulo}</p>}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {children}
    </section>
  );
}

interface SeccionErrorProps {
  mensaje: string;
  onReintentar: () => void;
}

// Bloque rojo con "Reintentar" (patrón de MetricasPage). El error de una
// sección no tumba a las demás: cada una pinta el suyo.
export function SeccionError({ mensaje, onReintentar }: SeccionErrorProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" role="alert">
      <p className="text-sm font-medium">Error de carga</p>
      <p className="text-sm mt-1">{mensaje}</p>
      <button
        type="button"
        onClick={onReintentar}
        className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}

interface ConClave<T> {
  clave: string;
  valor: T;
}

// useFetch no descarta respuestas viejas: si se cambia rápido de pestaña o de
// página, la respuesta del pedido anterior puede llegar última y quedar pintada
// bajo los filtros nuevos (contadores de una pestaña con filas de otra). Acá
// cada respuesta viaja con la clave que la pidió; si no coincide con la vigente
// se ignora y se vuelve a pedir.
export function useFetchVigente<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions) {
  const { data, loading, error, revalidate } = useFetch<ConClave<T>>(
    key,
    async () => ({ clave: key, valor: await fetcher() }),
    options
  );

  const desfasado = !!data && data.clave !== key;

  useEffect(() => {
    if (desfasado && !loading) revalidate();
  }, [desfasado, loading, revalidate]);

  return {
    data: data && !desfasado ? data.valor : null,
    loading: loading || desfasado,
    error,
    revalidate,
  };
}
