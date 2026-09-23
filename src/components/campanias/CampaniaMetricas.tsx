import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button } from '../ui';
import { SeccionCard, SeccionError, useFetchVigente } from './CampaniaSeccion';
import { useBloqueoPorToken } from './CampaniasGate';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { campaniasService } from '../../services/campanias.service';
import { diasDelPeriodo, etiquetaMes, formatPorcentaje, periodoDelMes } from './campanias.utils';
import type { CampaniaMetricasTotales, CampaniaTipo } from '../../types/campanias.types';

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

  // La barra de clics solo se dibuja si el backend manda el dato
  const serieTraeClics = (data?.serie ?? []).some((p) => typeof p.clics === 'number');

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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tarjeta titulo="Mensajes enviados" valor={totales.enviados} isLoading={cargando} />
            <Tarjeta titulo="Llegaron" valor={totales.entregados} detalle={formatPorcentaje(totales.tasa_entrega)} isLoading={cargando} />
            <Tarjeta titulo="Los leyeron" valor={totales.leidos} detalle={formatPorcentaje(totales.tasa_lectura)} isLoading={cargando} />
            <Tarjeta
              titulo="Tocaron el botón"
              valor={totales.clics}
              detalle={totales.tasa_clic !== undefined ? formatPorcentaje(totales.tasa_clic) : undefined}
              isLoading={cargando}
            />
            <Tarjeta titulo="Reservaron turno" valor={totales.conversiones} detalle={formatPorcentaje(totales.tasa_conversion)} isLoading={cargando} />
            <Tarjeta titulo="Pidieron no recibir más" valor={totales.bajas} isLoading={cargando} />
          </div>

          <div className="mt-5">
            {cargando ? (
              <div className="h-64 bg-gray-100 rounded-lg animate-pulse" aria-busy="true" />
            ) : sinDatos ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                No hay mensajes enviados en este mes.
              </div>
            ) : (
              <div className="h-64" role="img" aria-label="Mensajes enviados, toques en el botón y reservas por día">
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
                    <Bar dataKey="reservas" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Contamos que alguien reservó si sacó turno dentro de los {ventanaDias} días de recibir el mensaje. Los mensajes más nuevos todavía pueden sumar reservas.
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Tocaron el botón puede ser mayor que Los leyeron: hay personas que tienen desactivado el aviso de lectura.
      </p>
    </SeccionCard>
  );
}
