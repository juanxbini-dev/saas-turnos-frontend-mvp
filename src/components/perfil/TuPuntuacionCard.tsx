import { Star } from 'lucide-react';
import { Card, Spinner } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { formatPromedio, puntuacionesService } from '../../services/puntuaciones.service';
import type { PromedioPropio } from '../../types/puntuaciones.types';

// "Tu puntuación" en el Perfil: lo que los clientes contestaron en la encuesta
// de después de cada visita. Solo el promedio y la cantidad, del mes en curso
// y de siempre; nunca puntajes sueltos ni comentarios (spec post-servicio §7).

const cantidadTexto = (n: number) => `${n} ${n === 1 ? 'puntuación' : 'puntuaciones'}`;

function Bloque({ titulo, datos, vacio }: { titulo: string; datos: PromedioPropio; vacio: string }) {
  return (
    <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-500">{titulo}</p>
      {datos.cantidad > 0 ? (
        <>
          <p className="text-2xl font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
            <Star size={20} className="text-yellow-500 fill-yellow-400" aria-hidden="true" />
            {formatPromedio(datos.promedio)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{cantidadTexto(datos.cantidad)}</p>
        </>
      ) : (
        <p className="text-sm text-gray-400 mt-1">{vacio}</p>
      )}
    </div>
  );
}

export function TuPuntuacionCard() {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.PUNTUACIONES, 'mia'),
    () => puntuacionesService.getMia(),
    { ttl: TTL.MEDIUM }
  );

  return (
    <Card title="Tu puntuación" subtitle="Lo que contestaron tus clientes después de cada visita">
      {error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
          No se pudo cargar tu puntuación.{' '}
          <button type="button" onClick={() => revalidate()} className="underline font-medium">
            Reintentar
          </button>
        </div>
      ) : loading || !data ? (
        <div className="flex justify-center py-4" aria-busy="true"><Spinner size="sm" /></div>
      ) : (data.historico?.cantidad ?? 0) === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Todavía no tenés puntuaciones</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <Bloque titulo="Este mes" datos={data.mes} vacio="Todavía no tenés puntuaciones este mes" />
          <Bloque titulo="Desde siempre" datos={data.historico} vacio="Todavía no tenés puntuaciones" />
        </div>
      )}
    </Card>
  );
}
