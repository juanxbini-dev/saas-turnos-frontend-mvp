import { useEffect } from 'react';
import { Badge, Spinner } from '../../ui';
import { SeccionCard, SeccionError, useFetchVigente } from '../CampaniaSeccion';
import { useBloqueoPorToken } from '../CampaniasGate';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { campaniasService } from '../../../services/campanias.service';
import type { ListaViejaMotivos } from '../../../types/campanias.types';

interface ListaViejaVistaPreviaProps {
  // Cambia cuando se guarda la campaña: la lista se recalcula al instante
  refresco: number;
}

const fmtNumero = new Intl.NumberFormat('es-AR');

export const MOTIVO_TEXTO_LISTA_VIEJA: Record<keyof ListaViejaMotivos, string> = {
  apagada: 'La campaña está apagada: hoy no sale ningún mail.',
  sin_beneficio: 'No hay beneficio activo: hoy no sale ningún mail.',
  fuera_de_horario: 'Fuera del horario de envío: los mails salen a las 11:00.',
};

export function motivosListaVieja(motivos: ListaViejaMotivos | undefined): string[] {
  if (!motivos) return [];
  return (Object.keys(MOTIVO_TEXTO_LISTA_VIEJA) as (keyof ListaViejaMotivos)[])
    .filter((m) => motivos[m])
    .map((m) => MOTIVO_TEXTO_LISTA_VIEJA[m]);
}

interface TarjetaProps {
  titulo: string;
  valor: number;
  detalle?: string;
}

function Tarjeta({ titulo, valor, detalle }: TarjetaProps) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{fmtNumero.format(valor)}</div>
      {detalle && <div className="text-xs text-gray-500 mt-0.5">{detalle}</div>}
    </div>
  );
}

// C. Vista previa de la lista vieja: cuántos faltan, cuántos saldrían hoy y una
// muestra de los primeros 20 (plan §4.3, GET /lista_vieja/vista-previa).
export function ListaViejaVistaPrevia({ refresco }: ListaViejaVistaPreviaProps) {
  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, 'lista_vieja', 'preview'),
    () => campaniasService.getVistaPreviaListaVieja(),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  useEffect(() => {
    if (refresco > 0) revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresco]);

  const motivos = motivosListaVieja(data?.motivos);

  return (
    <SeccionCard titulo="A quién le llegaría hoy" subtitulo="Calculado en el momento." etiqueta="Vista previa">
      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudo calcular la vista previa." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center items-center h-40" aria-busy="true">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Tarjeta titulo="Todavía no recibieron el mail" valor={data.pendientes} />
            <Tarjeta titulo="Recordatorios por mandar" valor={data.recordatorios_pendientes} />
            <Tarjeta titulo="Saldrían hoy" valor={data.saldrian_hoy} />
            <Tarjeta titulo="Cupo que queda hoy" valor={data.cupo_restante} />
            <Tarjeta titulo="Mails dudosos" valor={data.mails_dudosos} detalle="Parecen mal escritos: no se les manda." />
          </div>

          {motivos.length > 0 && (
            <ul className="mt-4 space-y-1" aria-label="Por qué hoy no sale nada">
              {motivos.map((m) => (
                <li key={m} className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2 text-sm">{m}</li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900">Los primeros que saldrían</h3>
            {data.muestra.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Hoy no hay nadie para escribir.</p>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left min-w-[480px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mail</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mail que sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.muestra.map((item, i) => (
                      <tr key={`${item.email_enmascarado}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{item.nombre || '—'}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{item.email_enmascarado || '—'}</td>
                        <td className="py-2.5 px-4 text-sm">
                          <Badge variant={item.tipo === 'recordatorio' ? 'yellow' : 'blue'} size="sm">
                            {item.tipo === 'recordatorio' ? 'Recordatorio' : 'Primer mail'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Los mails salen de a tandas, los contactos más viejos primero. Si alguien pide no recibir más, deja de aparecer.
      </p>
    </SeccionCard>
  );
}
