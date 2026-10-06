import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, RotateCcw, Star } from 'lucide-react';
import { Badge, Button, Card, Pagination, Spinner } from '../ui';
import { useFetchVigente } from '../campanias/CampaniaSeccion';
import { formatFechaDia, formatFechaHoraAR } from '../campanias/campanias.utils';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { useContadorParaRevisar } from '../../hooks/useContadorParaRevisar';
import {
  NIVELES,
  NIVEL_TEXTO,
  esBajo,
  formatPromedio,
  puntuacionesService,
} from '../../services/puntuaciones.service';
import { toastService } from '../../services/toast.service';
import type {
  FiltroRevision,
  NivelPuntaje,
  PorNivel,
  Puntuacion,
  PuntuacionesPeriodo,
} from '../../types/puntuaciones.types';

// "Puntuaciones" dentro de Métricas (solo super admin). Spec post-servicio §7:
// arriba lo que hay que revisar (Regular y Malo), debajo los números del
// período y la lista completa con los comentarios.

interface MetricasPuntuacionesProps {
  periodo: PuntuacionesPeriodo;
  etiquetaPeriodo: string;
}

const POR_PAGINA_REVISAR = 10;
const POR_PAGINA_LISTA = 20;

const COLOR_NIVEL: Record<NivelPuntaje, 'green' | 'blue' | 'yellow' | 'red'> = {
  4: 'green',
  3: 'blue',
  2: 'yellow',
  1: 'red',
};

const BARRA_NIVEL: Record<NivelPuntaje, string> = {
  4: 'bg-green-500',
  3: 'bg-blue-500',
  2: 'bg-yellow-400',
  1: 'bg-red-500',
};

const nivelSeguro = (puntaje: number): NivelPuntaje =>
  (puntaje >= 1 && puntaje <= 4 ? Math.round(puntaje) : 1) as NivelPuntaje;

export function NivelBadge({ puntaje }: { puntaje: number }) {
  const nivel = nivelSeguro(puntaje);
  return <Badge variant={COLOR_NIVEL[nivel]} size="sm">{NIVEL_TEXTO[nivel]}</Badge>;
}

const totalPaginas = (total: number, porPagina: number) => Math.max(1, Math.ceil(total / porPagina));

const ERROR_GENERICO = 'No se pudo guardar. Probá de nuevo.';

function mensajeDeError(error: unknown): string {
  return (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message || ERROR_GENERICO;
}

function BloqueError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
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

// Hook compartido por "Para revisar" y la lista: marcar/desmarcar y avisar
function useMarcarRevisado(onListo: () => void) {
  const [procesando, setProcesando] = useState<string | null>(null);

  const marcar = async (item: Puntuacion, revisado: boolean) => {
    if (procesando) return;
    setProcesando(item.id);
    try {
      await puntuacionesService.marcarRevisado(item.id, revisado);
      toastService.success(revisado ? 'Marcado como revisado' : 'Volvió a la lista para revisar');
      onListo();
    } catch (err) {
      toastService.error(mensajeDeError(err));
    } finally {
      setProcesando(null);
    }
  };

  return { procesando, marcar };
}

// --------------------------------------------------------------- Para revisar

interface ParaRevisarProps {
  onCambio: () => void;
  refresco: number;
}

function ParaRevisar({ onCambio, refresco }: ParaRevisarProps) {
  const [revision, setRevision] = useState<FiltroRevision>('pendientes');
  const [pagina, setPagina] = useState(1);
  const { pendientes } = useContadorParaRevisar(true);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.PUNTUACIONES, 'revisar', revision, String(pagina)),
    () => puntuacionesService.getLista({ solo_bajos: true, revision, pagina, por_pagina: POR_PAGINA_REVISAR }),
    { ttl: TTL.SHORT }
  );

  useEffect(() => {
    if (refresco > 0) revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresco]);

  // `onCambio` sube el `refresco`, que recarga esta lista y las demás
  const { procesando, marcar } = useMarcarRevisado(onCambio);

  const cambiarRevision = (nueva: FiltroRevision) => {
    setRevision(nueva);
    setPagina(1);
  };

  const items = data?.items ?? [];

  // Si se marcó el último de la última página, esa página queda vacía: volver a la anterior
  const paginaVacia = !!data && items.length === 0 && pagina > 1;
  useEffect(() => {
    if (paginaVacia) setPagina((p) => Math.max(1, p - 1));
  }, [paginaVacia]);

  return (
    <Card
      title="Para revisar"
      subtitle="Las visitas puntuadas Regular o Malo, de la más nueva a la más vieja."
      headerAction={
        <div className="flex items-center gap-3">
          {pendientes > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-semibold rounded-full px-3 py-0.5">
              {pendientes} sin revisar
            </span>
          )}
          <select
            aria-label="Qué mostrar"
            value={revision}
            onChange={(e) => cambiarRevision(e.target.value as FiltroRevision)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pendientes">Sin revisar</option>
            <option value="todos">Todos (también los revisados)</option>
            <option value="revisados">Solo los revisados</option>
          </select>
        </div>
      }
    >
      {error ? (
        <BloqueError mensaje="No se pudo cargar la lista para revisar." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center py-8" aria-busy="true"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          {revision === 'pendientes'
            ? 'No hay nada para revisar. Todas las visitas con Regular o Malo ya se revisaron.'
            : 'No hay puntuaciones para mostrar.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 -mx-6">
            {items.map((item) => {
              const revisado = !!item.revisado_at;
              return (
                <li key={item.id} className="px-6 py-4" data-testid="para-revisar-item">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <NivelBadge puntaje={item.puntaje} />
                        <span className="text-sm font-medium text-gray-900">{item.cliente || 'Cliente sin nombre'}</span>
                        <span className="text-xs text-gray-500">{formatFechaHoraAR(item.fecha)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.servicio || 'Servicio sin nombre'} · con {item.profesional || 'profesional sin nombre'}
                        {item.fecha_turno ? ` · turno del ${formatFechaDia(item.fecha_turno)}` : ''}
                      </p>
                      {item.comentario ? (
                        <blockquote className="mt-2 text-sm text-gray-800 bg-gray-50 border-l-4 border-gray-300 px-3 py-2 rounded-r whitespace-pre-line break-words">
                          {item.comentario}
                        </blockquote>
                      ) : (
                        <p className="mt-2 text-sm text-gray-400 italic">Sin comentario</p>
                      )}
                      {revisado && (
                        <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Revisado{item.revisado_por ? ` por ${item.revisado_por}` : ''} el {formatFechaHoraAR(item.revisado_at)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {revisado ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={RotateCcw}
                          loading={procesando === item.id}
                          disabled={!!procesando}
                          onClick={() => { void marcar(item, false); }}
                        >
                          Volver a pendientes
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          leftIcon={CheckCircle2}
                          loading={procesando === item.id}
                          disabled={!!procesando}
                          onClick={() => { void marcar(item, true); }}
                        >
                          Marcar como revisado
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {data.total > POR_PAGINA_REVISAR && (
            <Pagination
              className="mt-4"
              page={data.pagina}
              totalPages={totalPaginas(data.total, data.por_pagina)}
              total={data.total}
              limit={data.por_pagina}
              onPageChange={setPagina}
            />
          )}
        </>
      )}
    </Card>
  );
}

// --------------------------------------------------------------- Números

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
      {detalle && <p className="text-xs text-gray-500 mt-0.5">{detalle}</p>}
    </div>
  );
}

function Distribucion({ porNivel, total }: { porNivel: PorNivel; total: number }) {
  return (
    <ul className="space-y-2" aria-label="Cuántos de cada nivel">
      {NIVELES.map((nivel) => {
        const cantidad = porNivel?.[String(nivel) as keyof PorNivel] ?? 0;
        const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        return (
          <li key={nivel} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-gray-700">{NIVEL_TEXTO[nivel]}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${BARRA_NIVEL[nivel]}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-gray-700 tabular-nums">
              {cantidad} <span className="text-gray-400">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const fmtMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

// 'YYYY-MM' → 'Octubre de 2026', armado a mano (sin corrimiento por huso)
function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  if (!y || !m) return mes;
  const texto = fmtMes.format(new Date(y, m - 1, 1));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// --------------------------------------------------------------- Lista completa

interface ListaCompletaProps {
  periodo: PuntuacionesPeriodo;
  profesionales: { usuario_id: string; nombre: string }[];
  // La lista de profesionales sale del resumen: si el resumen falló, no hay con qué filtrar
  errorProfesionales: boolean;
  refresco: number;
  onCambio: () => void;
}

function ListaCompleta({ periodo, profesionales, errorProfesionales, refresco, onCambio }: ListaCompletaProps) {
  const [pagina, setPagina] = useState(1);
  const [usuarioId, setUsuarioId] = useState('');
  const [soloBajos, setSoloBajos] = useState(false);

  useEffect(() => { setPagina(1); }, [periodo.fecha_desde, periodo.fecha_hasta]);

  // Sin la lista de profesionales el filtro no se puede usar: se muestran todos
  useEffect(() => {
    if (errorProfesionales) { setUsuarioId(''); setPagina(1); }
  }, [errorProfesionales]);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(
      ENTITIES.PUNTUACIONES, 'lista', periodo.fecha_desde, periodo.fecha_hasta,
      usuarioId || 'todos', soloBajos ? 'bajos' : 'todos', String(pagina)
    ),
    () => puntuacionesService.getLista({
      fecha_desde: periodo.fecha_desde,
      fecha_hasta: periodo.fecha_hasta,
      revision: 'todos',
      solo_bajos: soloBajos,
      usuario_id: usuarioId || undefined,
      pagina,
      por_pagina: POR_PAGINA_LISTA,
    }),
    { ttl: TTL.SHORT }
  );

  useEffect(() => {
    if (refresco > 0) revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresco]);

  // `onCambio` sube el `refresco`, que recarga esta lista y las demás
  const { procesando, marcar } = useMarcarRevisado(onCambio);

  const items = data?.items ?? [];

  return (
    <Card title="Todas las puntuaciones del período" subtitle="Con los comentarios que dejaron los clientes.">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <select
            aria-label="Filtrar por profesional"
            aria-describedby={errorProfesionales ? 'ayuda-filtro-profesional' : undefined}
            value={errorProfesionales ? '' : usuarioId}
            disabled={errorProfesionales}
            onChange={(e) => { setUsuarioId(e.target.value); setPagina(1); }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Todos los profesionales</option>
            {!errorProfesionales && profesionales.map((p) => <option key={p.usuario_id} value={p.usuario_id}>{p.nombre}</option>)}
          </select>
          {errorProfesionales && (
            <p id="ayuda-filtro-profesional" className="text-xs text-gray-500">
              No se pudo cargar la lista de profesionales.
            </p>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={soloBajos}
            onChange={(e) => { setSoloBajos(e.target.checked); setPagina(1); }}
            className="rounded border-gray-300"
          />
          Solo Regular y Malo
        </label>
      </div>

      {error ? (
        <BloqueError mensaje="No se pudieron cargar las puntuaciones." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center py-8" aria-busy="true"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No hay puntuaciones en este período.</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Fecha', 'Puntaje', 'Cliente', 'Profesional', 'Servicio', 'Comentario', ''].map((h, i) => (
                    <th key={i} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{formatFechaHoraAR(item.fecha)}</td>
                    <td className="py-2.5 px-4 text-sm">
                      <NivelBadge puntaje={item.puntaje} />
                      {item.resena_click_at && (
                        <span className="block text-xs text-gray-500 mt-1 whitespace-nowrap">Fue a dejar la reseña</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-sm text-gray-900">{item.cliente || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{item.profesional || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{item.servicio || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-700 max-w-xs whitespace-pre-line break-words">
                      {item.comentario || <span className="text-gray-400 italic">Sin comentario</span>}
                    </td>
                    <td className="py-2.5 px-4 text-sm whitespace-nowrap">
                      {esBajo(item.puntaje) && (
                        item.revisado_at ? (
                          <button
                            type="button"
                            disabled={!!procesando}
                            onClick={() => { void marcar(item, false); }}
                            className="text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-50"
                            title="Volver a la lista para revisar"
                          >
                            Revisado
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!!procesando}
                            onClick={() => { void marcar(item, true); }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                          >
                            Marcar como revisado
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            className="mt-4"
            page={data.pagina}
            totalPages={totalPaginas(data.total, data.por_pagina)}
            total={data.total}
            limit={data.por_pagina}
            onPageChange={setPagina}
          />
        </>
      )}
    </Card>
  );
}

// --------------------------------------------------------------- Sección

export function MetricasPuntuaciones({ periodo, etiquetaPeriodo }: MetricasPuntuacionesProps) {
  // Cualquier "revisado" refresca las demás partes (la otra lista y los pendientes por profesional)
  const [refresco, setRefresco] = useState(0);

  const { data: resumen, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.PUNTUACIONES, 'resumen', periodo.fecha_desde, periodo.fecha_hasta),
    () => puntuacionesService.getResumen(periodo),
    { ttl: TTL.SHORT }
  );

  const huboCambio = () => {
    setRefresco((n) => n + 1);
    revalidate();
  };

  const general = resumen?.general;
  const porProfesional = resumen?.por_profesional ?? [];
  const porMes = resumen?.por_mes ?? [];

  return (
    <div className="space-y-6">
      <ParaRevisar onCambio={huboCambio} refresco={refresco} />

      <section aria-label="Números del período" className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Cómo puntuaron · {etiquetaPeriodo}</h2>

        {error ? (
          <BloqueError mensaje="No se pudieron cargar los números de las puntuaciones." onReintentar={revalidate} />
        ) : loading || !general ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : general.cantidad === 0 ? (
          <Card>
            <p className="text-sm text-gray-500 text-center py-6">Todavía no hay puntuaciones en este período.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Tarjeta titulo="Promedio general" valor={formatPromedio(general.promedio)} />
              <Tarjeta titulo="Puntuaciones" valor={general.cantidad} />
              <Tarjeta
                titulo="Dejaron comentario"
                valor={general.con_comentario}
                detalle={`${Math.round((general.con_comentario / general.cantidad) * 100)}% del total`}
              />
              <Tarjeta titulo="Fueron a dejar la reseña en Google" valor={general.resenas_clic} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Cuántos de cada nivel">
                <Distribucion porNivel={general.por_nivel} total={general.cantidad} />
              </Card>

              <Card title="Evolución por mes">
                {porMes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Sin datos.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide">
                        <th className="py-1.5 font-semibold">Mes</th>
                        <th className="py-1.5 font-semibold text-right">Promedio</th>
                        <th className="py-1.5 font-semibold text-right">Puntuaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {porMes.map((m) => (
                        <tr key={m.mes}>
                          <td className="py-2 text-sm text-gray-700">{etiquetaMes(m.mes)}</td>
                          <td className="py-2 text-sm text-gray-900 text-right font-medium">{formatPromedio(m.promedio)}</td>
                          <td className="py-2 text-sm text-gray-600 text-right">{m.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            <Card title="Por profesional" noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Profesional', 'Promedio', 'Puntuaciones', ...NIVELES.map((n) => NIVEL_TEXTO[n]), 'Sin revisar'].map((h) => (
                        <th key={h} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {porProfesional.map((p) => (
                      <tr key={p.usuario_id}>
                        <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{p.nombre}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            <Star size={14} className="text-yellow-500" aria-hidden="true" />
                            {formatPromedio(p.promedio)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-gray-600">{p.cantidad}</td>
                        {NIVELES.map((n) => (
                          <td key={n} className="py-2.5 px-4 text-sm text-gray-600">{p.por_nivel?.[String(n) as keyof PorNivel] ?? 0}</td>
                        ))}
                        <td className="py-2.5 px-4 text-sm">
                          {p.bajos_pendientes > 0
                            ? <span className="text-red-600 font-medium">{p.bajos_pendientes}</span>
                            : <span className="text-gray-400">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>

      <ListaCompleta
        periodo={periodo}
        profesionales={porProfesional.map((p) => ({ usuario_id: p.usuario_id, nombre: p.nombre }))}
        errorProfesionales={!!error}
        refresco={refresco}
        onCambio={huboCambio}
      />

      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <MessageSquare size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Cada profesional ve en su perfil solo su promedio y cuántas puntuaciones tiene; los comentarios los ves solo vos.
      </p>
    </div>
  );
}
