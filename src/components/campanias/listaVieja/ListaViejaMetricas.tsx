import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { SeccionCard, SeccionError, useFetchVigente } from '../CampaniaSeccion';
import { useBloqueoPorToken } from '../CampaniasGate';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { campaniasService } from '../../../services/campanias.service';
import { formatFechaDia } from '../campanias.utils';
import type { ListaViejaMetricas as ListaViejaMetricasData, ListaViejaMetricasPunto } from '../../../types/campanias.types';

const fmtNumero = new Intl.NumberFormat('es-AR');

// Porcentaje entero de una parte sobre un total (sin total → null, nunca NaN)
export function porcentajeDe(parte: number, total: number): number | null {
  if (!total || total <= 0 || !Number.isFinite(parte)) return null;
  return Math.round((parte / total) * 100);
}

// El embudo: cada paso con su número y el porcentaje sobre el paso anterior
export interface PasoEmbudo {
  id: string;
  titulo: string;
  valor: number;
  pct: number | null;   // sobre el paso anterior
}

export function armarEmbudo(m: ListaViejaMetricasData): PasoEmbudo[] {
  const pasos: { id: string; titulo: string; valor: number }[] = [
    { id: 'contactos', titulo: 'Contactos', valor: m.contactos.total },
    { id: 'enviados', titulo: 'Mails enviados', valor: m.mails.enviados },
    { id: 'entregados', titulo: 'Llegaron', valor: m.mails.entregados },
    { id: 'abiertos', titulo: 'Los abrieron', valor: m.mails.abiertos },
    { id: 'clics', titulo: 'Tocaron el botón', valor: m.mails.clics },
    { id: 'emitidos', titulo: 'Pidieron el código', valor: m.codigos.emitidos },
    { id: 'reservados', titulo: 'Reservaron turno', valor: m.codigos.reservados },
    { id: 'usados', titulo: 'Lo usaron en el salón', valor: m.codigos.usados },
  ];
  return pasos.map((p, i) => ({ ...p, pct: i === 0 ? null : porcentajeDe(p.valor, pasos[i - 1].valor) }));
}

// Solo los últimos días con datos, de más nuevo a más viejo
const MAX_DIAS_TABLA = 31;

export function ultimosDias(serie: ListaViejaMetricasPunto[]): ListaViejaMetricasPunto[] {
  return [...serie]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, MAX_DIAS_TABLA);
}

interface TarjetaProps {
  titulo: string;
  valor: number;
  detalle?: string;
  tono?: 'normal' | 'alerta';
}

function Tarjeta({ titulo, valor, detalle, tono = 'normal' }: TarjetaProps) {
  const clases = tono === 'alerta' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100';
  return (
    <div className={`rounded-lg border p-4 ${clases}`}>
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNumero.format(valor)}</span>
        {detalle && <span className="text-sm text-gray-500 tabular-nums">{detalle}</span>}
      </div>
    </div>
  );
}

// E. Resultados de la lista vieja (plan §4.3, GET /lista_vieja/metricas):
// el embudo de contactos a códigos usados, lo que salió mal aparte, y el día a día.
export function ListaViejaMetricas() {
  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, 'lista_vieja', 'metricas', 'todo'),
    () => campaniasService.getMetricasListaVieja(),
    { ttl: TTL.MEDIUM }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  const embudo = useMemo(() => (data ? armarEmbudo(data) : []), [data]);
  const dias = useMemo(() => (data ? ultimosDias(data.serie_diaria ?? []) : []), [data]);
  const maxEnviados = dias.reduce((max, d) => Math.max(max, d.enviados), 0);

  return (
    <SeccionCard titulo="Resultados" subtitulo="Qué pasó con los mails desde el primer envío.">
      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudieron cargar los resultados." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <ol className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Embudo: de contactos a códigos usados">
            {embudo.map((paso) => (
              <li key={paso.id} className="rounded-lg bg-gray-50 border border-gray-100 p-4" data-testid={`embudo-${paso.id}`}>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {paso.pct !== null && <ArrowRight size={12} aria-hidden="true" className="shrink-0" />}
                  <span>{paso.titulo}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNumero.format(paso.valor)}</span>
                  {paso.pct !== null && <span className="text-sm text-gray-500 tabular-nums">{paso.pct} %</span>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Lo que no salió bien</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Tarjeta titulo="Rebotaron" valor={data.contactos.rebotados} detalle="mails que no existen" tono="alerta" />
              <Tarjeta titulo="Lo marcaron como spam" valor={data.contactos.quejas} tono="alerta" />
              <Tarjeta titulo="Pidieron no recibir más" valor={data.contactos.bajas} />
              <Tarjeta titulo="No se pudieron enviar" valor={data.mails.fallidos} />
              <Tarjeta titulo="Recordatorios enviados" valor={data.mails.recordatorios} />
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Día por día</h4>
            {dias.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-sm text-gray-500">
                Todavía no salió ningún mail.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Día', 'Enviados', '', 'Llegaron', 'Abiertos', 'Clics', 'Pidieron el código'].map((h, i) => (
                        <th key={i} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dias.map((d) => (
                      <tr key={d.fecha}>
                        <td className="py-2 px-4 text-sm text-gray-700 whitespace-nowrap">{formatFechaDia(d.fecha)}</td>
                        <td className="py-2 px-4 text-sm text-gray-900 tabular-nums">{fmtNumero.format(d.enviados)}</td>
                        <td className="py-2 px-4 w-40">
                          <div className="h-2 bg-gray-100 rounded" aria-hidden="true">
                            <div
                              className="h-2 bg-blue-500 rounded"
                              style={{ width: `${maxEnviados > 0 ? Math.round((d.enviados / maxEnviados) * 100) : 0}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2 px-4 text-sm text-gray-700 tabular-nums">{fmtNumero.format(d.entregados)}</td>
                        <td className="py-2 px-4 text-sm text-gray-700 tabular-nums">{fmtNumero.format(d.abiertos)}</td>
                        <td className="py-2 px-4 text-sm text-gray-700 tabular-nums">{fmtNumero.format(d.clics)}</td>
                        <td className="py-2 px-4 text-sm text-gray-700 tabular-nums">{fmtNumero.format(d.convertidos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data.serie_diaria?.length ?? 0) > MAX_DIAS_TABLA && (
                  <p className="text-xs text-gray-500 mt-2">Se muestran los últimos {MAX_DIAS_TABLA} días con envíos.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        "Pidieron el código" cuenta a quien completó el formulario del mail. "Reservaron" y "Lo usaron" siguen a esos códigos: los más nuevos todavía pueden sumar.
      </p>
    </SeccionCard>
  );
}
