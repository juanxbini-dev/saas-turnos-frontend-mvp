import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button } from '../ui';
import { SeccionCard, SeccionError, useFetchVigente } from './CampaniaSeccion';
import { useBloqueoPorToken } from './CampaniasGate';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { campaniasService } from '../../services/campanias.service';
import { diasDelPeriodo, etiquetaMes, formatPorcentaje, NOMBRE_CAMPANIA, periodoDelMes } from './campanias.utils';
import { formatFechaHoraAR } from '../../utils/fechasAR.utils';
import type {
  CampaniaMetricasRespuestas,
  CampaniaMetricasSeguimiento,
  CampaniaMetricasTotales,
  CampaniaTipo,
  OpinionProducto,
} from '../../types/campanias.types';

interface CampaniaMetricasProps {
  tipo: CampaniaTipo;
}

// Nombres de las series del gráfico, para la leyenda y el tooltip
const NOMBRE_SERIE: Record<string, string> = {
  enviados: 'Enviados',
  clics: 'Tocaron el botón',
  reservas: 'Reservas',
};

const VENTANA_DIAS_DEFAULT = 14;

const TOTALES_VACIOS: CampaniaMetricasTotales = {
  enviados: 0, entregados: 0, leidos: 0, fallidos: 0, bajas: 0, conversiones: 0, con_ventana_abierta: 0,
  tasa_entrega: null, tasa_lectura: null, tasa_conversion: null,
};

interface TarjetaProps {
  titulo: string;
  // Sin dato (el backend no manda el campo) se muestra una raya, no un 0 inventado
  valor: number | null | undefined;
  detalle?: string;
  isLoading: boolean;
}

function Tarjeta({ titulo, valor, detalle, isLoading }: TarjetaProps) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
      <div className="text-xs text-gray-500">{titulo}</div>
      {isLoading ? (
        <div className="h-7 w-16 bg-gray-200 rounded animate-pulse mt-1" />
      ) : (
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">
            {typeof valor === 'number' && Number.isFinite(valor) ? new Intl.NumberFormat('es-AR').format(valor) : '—'}
          </span>
          {detalle !== undefined && <span className="text-sm text-gray-500 tabular-nums">{detalle}</span>}
        </div>
      )}
    </div>
  );
}

const fmtNumero = new Intl.NumberFormat('es-AR');

// Porcentaje entero de una parte sobre un total (sin total → null, nunca NaN)
export function porcentaje(parte: number, total: number): number | null {
  if (!total || total <= 0 || !Number.isFinite(parte)) return null;
  return Math.round((parte / total) * 100);
}

interface MetricasRespuestasProps {
  tipo: CampaniaTipo;
  respuestas: CampaniaMetricasRespuestas;
  enviados: number;
}

// Qué hizo la gente con el mensaje (spec de productos §11.3): contestaron, pidieron, compraron
// en N días (solo las campañas que lo miden: null no se muestra) y ventas por avisos.
export function MetricasRespuestas({ tipo, respuestas, enviados }: MetricasRespuestasProps) {
  const dias = respuestas.ventana_compra_dias;
  const pctContestaron = porcentaje(respuestas.contestaron, enviados);
  const tituloCompraron = tipo === 'seguimiento_producto'
    ? `Compraron o reservaron en ${dias} días`
    : `Compraron el producto en ${dias} días`;
  const detalleCompraron = tipo === 'seguimiento_producto'
    ? 'de los que dijeron «No me funcionó»'
    : 'después de recibir el mensaje';

  return (
    <div className="mt-4" aria-label="Qué respondieron">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">Qué respondieron</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tarjeta
          titulo="Contestaron"
          valor={respuestas.contestaron}
          detalle={pctContestaron !== null ? `${pctContestaron} %` : undefined}
          isLoading={false}
        />
        {tipo === 'reposicion_producto' && (
          <Tarjeta titulo="Pidieron el producto («Quiero uno»)" valor={respuestas.pidieron} isLoading={false} />
        )}
        {respuestas.compraron !== null && respuestas.compraron !== undefined && (
          <div data-testid="metrica-compraron">
            <Tarjeta titulo={tituloCompraron} valor={respuestas.compraron} detalle={detalleCompraron} isLoading={false} />
          </div>
        )}
        <Tarjeta
          titulo="Ventas por avisos"
          valor={respuestas.ventas_por_avisos}
          detalle="compras o reservas desde Para contactar"
          isLoading={false}
        />
      </div>
    </div>
  );
}

const OPINIONES: { id: OpinionProducto; label: string }[] = [
  { id: 'encanta', label: 'Me encanta' },
  { id: 'mas_o_menos', label: 'Más o menos' },
  { id: 'no_funciono', label: 'No me funcionó' },
];

// Satisfacción por producto (spec de productos §11.2): opiniones del período y % de cada
// respuesta, más los rescatados ("No me funcionó" que terminaron comprando o reservando).
export function SatisfaccionPorProducto({ seguimiento }: { seguimiento: CampaniaMetricasSeguimiento }) {
  const filas = [...seguimiento.satisfaccion].sort((a, b) =>
    b.total - a.total || a.producto_nombre.localeCompare(b.producto_nombre, 'es-AR'));

  return (
    <div className="mt-4 rounded-lg border border-gray-100 p-4" aria-label="Satisfacción por producto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Satisfacción por producto</h4>
          <p className="text-xs text-gray-500 mt-0.5">Qué contestaron cuando les preguntamos cómo les está resultando.</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800" data-testid="rescatados">
          <span className="font-semibold tabular-nums">{fmtNumero.format(seguimiento.rescatados)}</span>{' '}
          {seguimiento.rescatados === 1 ? 'rescatado' : 'rescatados'}
          <span className="block text-xs text-green-700">Les dijo «No me funcionó» y terminaron comprando otro producto o reservando turno.</span>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Todavía nadie opinó sobre un producto en este mes.</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="bg-gray-50">
                {['Producto', 'Opiniones', ...OPINIONES.map((o) => o.label)].map((h) => (
                  <th key={h} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((f) => (
                <tr key={f.producto_id}>
                  <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{f.producto_nombre || '—'}</td>
                  <td className="py-2.5 px-4 text-sm text-gray-700 tabular-nums">{fmtNumero.format(f.total)}</td>
                  {OPINIONES.map((o) => {
                    const cantidad = f.por_opinion?.[o.id] ?? 0;
                    const pct = porcentaje(cantidad, f.total);
                    return (
                      <td key={o.id} className="py-2.5 px-4 text-sm text-gray-700 tabular-nums whitespace-nowrap">
                        {pct !== null ? `${pct} %` : '—'}{' '}
                        <span className="text-gray-400">({fmtNumero.format(cantidad)})</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// E. Resultados del mes. Textos: spec §4.3 E.
export function CampaniaMetricas({ tipo }: CampaniaMetricasProps) {
  const [base, setBase] = useState(() => new Date());

  const periodo = useMemo(() => periodoDelMes(base), [base]);
  const ahora = new Date();
  const esMesActual = base.getFullYear() === ahora.getFullYear() && base.getMonth() === ahora.getMonth();

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, tipo, 'metricas', periodo.fecha_desde),
    () => campaniasService.getMetricas(tipo, periodo),
    { ttl: TTL.MEDIUM }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  const navegar = (direccion: -1 | 1) => {
    setBase(new Date(base.getFullYear(), base.getMonth() + direccion, 1));
  };

  const totales = data?.totales ?? TOTALES_VACIOS;
  const bajas = data?.bajas_detalle ?? [];
  const ventanaDias = data?.ventana_dias ?? VENTANA_DIAS_DEFAULT;
  const cargando = loading || !data;

  // Un punto por día del mes: los días sin mensajes quedan en 0
  const serie = useMemo(() => {
    const porFecha = new Map((data?.serie ?? []).map((p) => [p.fecha.slice(0, 10), p]));
    return diasDelPeriodo(periodo).map((fecha) => {
      const punto = porFecha.get(fecha);
      return { fecha, enviados: punto?.enviados ?? 0, clics: punto?.clics ?? 0, reservas: punto?.conversiones ?? 0 };
    });
  }, [data, periodo]);

  // Reservas y toques en el botón del mensaje son la medida de las campañas que
  // invitan a reservar ("Ya te toca volver" y "Turno cancelado"); en la encuesta
  // de después de la visita no aplican.
  // Seguimiento de producto tampoco: pide una opinión, sin botón para reservar.
  const mideReservas = tipo !== 'post_servicio' && tipo !== 'seguimiento_producto';

  // La barra de clics solo se dibuja si el backend manda el dato
  const serieTraeClics = mideReservas && (data?.serie ?? []).some((p) => typeof p.clics === 'number');

  const sinDatos = !cargando && totales.enviados === 0 && serie.every((p) => p.enviados === 0 && p.reservas === 0);

  const selectorMes = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" leftIcon={ChevronLeft} onClick={() => navegar(-1)}>
        Anterior
      </Button>
      <h3 className="text-base font-semibold text-gray-900 min-w-36 text-center">{etiquetaMes(base)}</h3>
      <Button
        variant="ghost"
        size="sm"
        rightIcon={ChevronRight}
        disabled={esMesActual}
        onClick={() => navegar(1)}
      >
        Siguiente
      </Button>
    </div>
  );

  return (
    <SeccionCard titulo="Resultados" subtitulo="Qué pasó con los mensajes del mes." accion={selectorMes}>
      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudieron cargar los resultados." onReintentar={revalidate} />
      ) : (
        <>
          <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${mideReservas ? 'xl:grid-cols-6' : 'xl:grid-cols-4'}`}>
            <Tarjeta titulo="Mensajes enviados" valor={totales.enviados} isLoading={cargando} />
            <Tarjeta titulo="Llegaron" valor={totales.entregados} detalle={formatPorcentaje(totales.tasa_entrega)} isLoading={cargando} />
            <Tarjeta titulo="Los leyeron" valor={totales.leidos} detalle={formatPorcentaje(totales.tasa_lectura)} isLoading={cargando} />
            {mideReservas && (
              <Tarjeta
                titulo="Tocaron el botón"
                valor={totales.clics}
                detalle={totales.tasa_clic !== undefined ? formatPorcentaje(totales.tasa_clic) : undefined}
                isLoading={cargando}
              />
            )}
            {mideReservas && (
              <Tarjeta titulo="Reservaron turno" valor={totales.conversiones} detalle={formatPorcentaje(totales.tasa_conversion)} isLoading={cargando} />
            )}
            <Tarjeta titulo="Pidieron no recibir más" valor={totales.bajas} isLoading={cargando} />
          </div>

          {!cargando && data?.respuestas && (
            <MetricasRespuestas tipo={tipo} respuestas={data.respuestas} enviados={totales.enviados} />
          )}

          {!cargando && tipo === 'seguimiento_producto' && data?.seguimiento && (
            <SatisfaccionPorProducto seguimiento={data.seguimiento} />
          )}

          {!cargando && bajas.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Quiénes pidieron no recibir más</h4>
              <ul className="mt-2 divide-y divide-gray-100">
                {bajas.map((baja) => (
                  <li key={baja.cliente_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="text-gray-900">{baja.nombre}</div>
                      {baja.campania_tipo !== undefined && (
                        <div className="text-xs text-gray-500">
                          {baja.campania_tipo
                            ? `Después de recibir "${NOMBRE_CAMPANIA[baja.campania_tipo] ?? baja.campania_tipo}"`
                            : 'Sin mensaje de campaña antes'}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-500 tabular-nums shrink-0">{formatFechaHoraAR(baja.baja_at)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Pedir no recibir más corta todas las campañas, por eso la lista es la misma en cada pestaña. Los avisos de sus turnos le siguen llegando. Si alguien lo pidió por error, se le vuelven a activar los mensajes desde su ficha en Clientes.
              </p>
            </div>
          )}

          <div className="mt-5">
            {cargando ? (
              <div className="h-64 bg-gray-100 rounded-lg animate-pulse" aria-busy="true" />
            ) : sinDatos ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                No hay mensajes enviados en este mes.
              </div>
            ) : (
              <div className="h-64" role="img" aria-label={mideReservas ? "Mensajes enviados, toques en el botón y reservas por día" : "Mensajes enviados por día"}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="fecha"
                      tickFormatter={(f: string) => f.slice(8)}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      formatter={(valor, nombre) => [Number(valor) || 0, NOMBRE_SERIE[String(nombre)] ?? String(nombre)]}
                      labelFormatter={(f) => {
                        const fecha = String(f);
                        return `Día ${fecha.slice(8)}/${fecha.slice(5, 7)}`;
                      }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend
                      formatter={(valor: string) => (
                        <span className="text-xs text-gray-600">{NOMBRE_SERIE[valor] ?? valor}</span>
                      )}
                    />
                    <Bar dataKey="enviados" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    {serieTraeClics && <Bar dataKey="clics" fill="#f59e0b" radius={[3, 3, 0, 0]} />}
                    {mideReservas && <Bar dataKey="reservas" fill="#16a34a" radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {mideReservas ? (
        <>
      <p className="text-xs text-gray-500 mt-4">
        Contamos que alguien reservó si sacó turno dentro de los {ventanaDias} días de recibir el mensaje. Los mensajes más nuevos todavía pueden sumar reservas.
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Tocaron el botón puede ser mayor que Los leyeron: hay personas que tienen desactivado el aviso de lectura.
      </p>
        </>
      ) : tipo === 'seguimiento_producto' ? (
        <p className="text-xs text-gray-500 mt-4">
          Lo que escribió cada cliente y los que dijeron «No me funcionó» le llegan a recepción en Para contactar.
        </p>
      ) : (
        <p className="text-xs text-gray-500 mt-4">
          Las puntuaciones y los comentarios de cada visita están en Métricas → Puntuaciones.
        </p>
      )}
    </SeccionCard>
  );
}
