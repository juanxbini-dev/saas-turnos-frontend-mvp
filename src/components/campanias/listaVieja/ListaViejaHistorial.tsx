import { useState } from 'react';
import { Check } from 'lucide-react';
import { Badge, Pagination, Select, Spinner } from '../../ui';
import type { BadgeProps } from '../../ui';
import { SeccionCard, SeccionError, useFetchVigente } from '../CampaniaSeccion';
import { useBloqueoPorToken } from '../CampaniasGate';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { campaniasService } from '../../../services/campanias.service';
import { formatFechaHoraAR } from '../../../utils/fechasAR.utils';
import { ESTADOS_EMAIL } from '../../../types/campanias.types';
import type { EstadoEmail } from '../../../types/campanias.types';

const POR_PAGINA = 20;

export const ESTADO_EMAIL_TEXTO: Record<EstadoEmail, string> = {
  pendiente: 'Por enviar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  rebotado: 'Rebotó',
  queja: 'Lo marcó como spam',
  fallido: 'No se pudo enviar',
};

const VARIANTE: Record<EstadoEmail, NonNullable<BadgeProps['variant']>> = {
  pendiente: 'gray',
  enviado: 'blue',
  entregado: 'green',
  rebotado: 'red',
  queja: 'red',
  fallido: 'red',
};

const OPCIONES_ESTADO = [
  { value: '', label: 'Todos los estados' },
  ...ESTADOS_EMAIL.map((e) => ({ value: e, label: ESTADO_EMAIL_TEXTO[e] })),
];

// Qué mail es, en lenguaje llano
export function textoMail(plantilla: string): string {
  if (plantilla === 'lista_vieja_recordatorio') return 'Recordatorio';
  if (plantilla === 'lista_vieja_clic_sin_turno') return 'Recordatorio (tocó y no reservó)';
  if (plantilla === 'lista_vieja_ultimo_dia') return 'Último día';
  if (plantilla === 'lista_vieja') return 'Primer mail';
  return plantilla;
}

function Marca({ cuando }: { cuando: string | null }) {
  if (!cuando) return <span className="text-gray-400">—</span>;
  return <span className="text-gray-700 whitespace-nowrap">{formatFechaHoraAR(cuando)}</span>;
}

// D. Historial de mails de la lista vieja (plan §4.3, GET /lista_vieja/envios)
export function ListaViejaHistorial() {
  const [estado, setEstado] = useState<EstadoEmail | ''>('');
  const [pagina, setPagina] = useState(1);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, 'lista_vieja', 'envios', estado || 'todos', String(pagina)),
    () => campaniasService.getEnviosListaVieja({ estado, pagina, por_pagina: POR_PAGINA }),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const porPagina = data?.por_pagina || POR_PAGINA;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <SeccionCard
      titulo="Historial"
      subtitulo="Cada mail que salió, si llegó, si lo abrieron y si la persona pidió su código."
      accion={
        <div className="sm:w-60">
          <Select
            options={OPCIONES_ESTADO}
            value={estado}
            onChange={(e) => { setEstado(e.target.value as EstadoEmail | ''); setPagina(1); }}
            aria-label="Filtrar por estado"
          />
        </div>
      }
    >
      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudo cargar el historial." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center items-center h-40" aria-busy="true">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          {estado ? 'No hay mails con ese estado.' : 'Todavía no se envió ningún mail.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[860px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Nombre', 'Mail', 'Mensaje', 'Estado', 'Enviado', 'Entregado', 'Abierto', 'Clic', 'Pidió el código'].map((h) => (
                    <th key={h} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((envio) => (
                  <tr key={envio.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{envio.nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{envio.email_enmascarado || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{textoMail(envio.plantilla)}</td>
                    <td className="py-2.5 px-4 text-sm">
                      <Badge variant={VARIANTE[envio.estado] ?? 'gray'} size="sm">
                        {ESTADO_EMAIL_TEXTO[envio.estado] ?? envio.estado}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-sm"><Marca cuando={envio.enviado_at} /></td>
                    <td className="py-2.5 px-4 text-sm"><Marca cuando={envio.entregado_at} /></td>
                    <td className="py-2.5 px-4 text-sm"><Marca cuando={envio.abierto_at} /></td>
                    <td className="py-2.5 px-4 text-sm"><Marca cuando={envio.primer_clic_at} /></td>
                    <td className="py-2.5 px-4 text-sm">
                      {envio.convertido ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium" aria-label="Sí, pidió el código">
                          <Check size={16} aria-hidden="true" /> Sí
                        </span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            className="mt-4"
            page={pagina}
            totalPages={totalPaginas}
            total={total}
            limit={porPagina}
            onPageChange={setPagina}
          />
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        "Abierto" depende del programa de mail de cada persona: algunos no lo avisan. "Clic" es cuando tocó el botón del mail.
      </p>
    </SeccionCard>
  );
}
