import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Pagination, Select, Spinner } from '../ui';
import { SeccionCard, SeccionError, useFetchVigente } from './CampaniaSeccion';
import { useBloqueoPorToken } from './CampaniasGate';
import { EstadoEnvioBadge, ESTADO_ENVIO_TEXTO } from './EstadoEnvioBadge';
import { useDebounce } from '../../hooks/useDebounce';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { campaniasService } from '../../services/campanias.service';
import { formatFechaDia, formatFechaHoraAR } from './campanias.utils';
import type { CampaniaEnvio, EstadoEnvio } from '../../types/campanias.types';

const POR_PAGINA = 20;

// Sin filtro el backend ya deja afuera los "No salió" (liberado): solo se ven
// si se los pide a propósito.
const ESTADOS_FILTRO: EstadoEnvio[] = ['reservado', 'enviado', 'entregado', 'leido', 'fallido', 'liberado'];
const OPCIONES_ESTADO = [
  { value: '', label: 'Todos los estados' },
  ...ESTADOS_FILTRO.map((e) => ({ value: e, label: ESTADO_ENVIO_TEXTO[e] })),
];

const ESTADOS_QUE_SALIERON: EstadoEnvio[] = ['enviado', 'entregado', 'leido'];

function Reservo({ envio }: { envio: CampaniaEnvio }) {
  if (envio.convirtio) {
    const turno = envio.turno_conversion;
    return (
      <span className="text-green-700 font-medium">
        Sí
        {turno && (
          <span className="text-gray-500 font-normal">
            {' '}· turno del {formatFechaDia(turno.fecha)}{turno.hora ? ` ${turno.hora.slice(0, 5)}` : ''}
          </span>
        )}
      </span>
    );
  }
  // Si el mensaje nunca salió, la pregunta no aplica
  return <span className="text-gray-500">{ESTADOS_QUE_SALIERON.includes(envio.estado) ? 'No' : '—'}</span>;
}

// D. Historial de mensajes. Textos: spec §4.3 D.
export function CampaniaHistorial() {
  const [estado, setEstado] = useState<EstadoEnvio | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const busquedaFinal = useDebounce(busqueda.trim(), 350);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, 'recencia', 'envios', estado || 'todos', String(pagina), busquedaFinal),
    () => campaniasService.getEnvios('recencia', { estado, busqueda: busquedaFinal, pagina, por_pagina: POR_PAGINA }),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  useEffect(() => { setPagina(1); }, [busquedaFinal]);

  const items = data?.items ?? [];
  const meta = data?.meta;
  const hayFiltro = busquedaFinal !== '' || estado !== '';

  return (
    <SeccionCard titulo="Historial" subtitulo="Cada mensaje que salió, si llegó y si la persona reservó.">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <Input
            type="search"
            prefix={Search}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar en el historial"
          />
        </div>
        <div className="sm:w-60">
          <Select
            options={OPCIONES_ESTADO}
            value={estado}
            onChange={(e) => { setEstado(e.target.value as EstadoEnvio | ''); setPagina(1); }}
            aria-label="Filtrar por estado"
          />
        </div>
      </div>

      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudo cargar el historial." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center items-center h-40" aria-busy="true">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          {hayFiltro ? 'No hay mensajes con ese filtro.' : 'Todavía no se envió ningún mensaje.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha y hora</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicio</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Reservó?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((envio) => (
                  <tr key={envio.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-sm text-gray-700 whitespace-nowrap">
                      {formatFechaHoraAR(envio.enviado_at ?? envio.reservado_at)}
                    </td>
                    <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{envio.cliente_nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{envio.servicio || '—'}</td>
                    <td className="py-2.5 px-4 text-sm">
                      <EstadoEnvioBadge estado={envio.estado} errorCodigo={envio.error_codigo} />
                    </td>
                    <td className="py-2.5 px-4 text-sm"><Reservo envio={envio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <Pagination
              className="mt-4"
              page={meta.pagina}
              totalPages={meta.total_paginas}
              total={meta.total}
              limit={meta.por_pagina}
              onPageChange={setPagina}
            />
          )}
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Si la persona tiene desactivado el aviso de lectura en su WhatsApp, vas a verlo como Entregado aunque lo haya leído.
      </p>
    </SeccionCard>
  );
}
