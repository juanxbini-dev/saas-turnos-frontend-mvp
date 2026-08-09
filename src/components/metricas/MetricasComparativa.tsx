import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Trophy } from 'lucide-react';
import { Card, Avatar } from '../ui';
import { formatCurrency } from '../../utils/calculos.utils';
import {
  MetricasComparativaItem,
  MetricasAgrupacion,
} from '../../types/metricas.types';

interface MetricasComparativaProps {
  comparativa: MetricasComparativaItem[];
  agrupar: MetricasAgrupacion;
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  isLoading: boolean;
}

// Paleta estable por profesional (según orden por facturación)
const COLORES = ['#2563eb', '#9333ea', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#be185d'];

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatEntero = (v: number) => new Intl.NumberFormat('es-AR').format(Math.round(v));
const formatPorcentaje = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;
const formatHoras = (v: number) => `${v.toFixed(1).replace('.', ',')} h`;
const formatMonedaCompacta = (valor: number): string =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);

const formatEje = (fecha: string, agrupar: MetricasAgrupacion): string => {
  if (agrupar === 'dia') return fecha.slice(8);
  const mes = parseInt(fecha.slice(5), 10);
  return MESES_CORTOS[mes - 1] ?? fecha;
};

// Todos los buckets del rango, para que los períodos sin ventas queden en 0
const generarBuckets = (agrupar: MetricasAgrupacion, fechaDesde: string, fechaHasta: string): string[] => {
  const buckets: string[] = [];
  if (agrupar === 'dia') {
    const [y1, m1, d1] = fechaDesde.split('-').map(Number);
    const [y2, m2, d2] = fechaHasta.split('-').map(Number);
    const cursor = new Date(y1, m1 - 1, d1);
    const fin = new Date(y2, m2 - 1, d2);
    while (cursor <= fin) {
      buckets.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      );
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const [y1, m1] = fechaDesde.split('-').map(Number);
    const [y2, m2] = fechaHasta.split('-').map(Number);
    let anio = y1;
    let mes = m1;
    while (anio < y2 || (anio === y2 && mes <= m2)) {
      buckets.push(`${anio}-${String(mes).padStart(2, '0')}`);
      mes++;
      if (mes > 12) { mes = 1; anio++; }
    }
  }
  return buckets;
};

// Definición de filas de la tabla comparativa
interface FilaMetrica {
  label: string;
  seccion?: string; // encabezado de grupo (solo en la primera fila del grupo)
  valor: (item: MetricasComparativaItem) => number;
  formato: (v: number) => string;
  mejor: 'mayor' | 'menor' | 'ninguno';
}

const FILAS: FilaMetrica[] = [
  { seccion: 'Facturación', label: 'Facturado total', valor: i => i.facturado, formato: formatCurrency, mejor: 'mayor' },
  { label: 'Servicios', valor: i => i.facturado_servicios, formato: formatCurrency, mejor: 'mayor' },
  { label: 'Productos', valor: i => i.facturado_productos, formato: formatCurrency, mejor: 'mayor' },
  { label: 'Neto profesional', valor: i => i.neto_profesional, formato: formatCurrency, mejor: 'mayor' },
  { label: 'Comisión empresa', valor: i => i.comision_empresa, formato: formatCurrency, mejor: 'mayor' },
  { label: 'Pendiente de cobro', valor: i => i.pendiente_cobro, formato: formatCurrency, mejor: 'menor' },
  { label: 'Ticket promedio', valor: i => i.ticket_promedio, formato: formatCurrency, mejor: 'mayor' },
  { seccion: 'Turnos', label: 'Completados', valor: i => i.turnos_completados, formato: formatEntero, mejor: 'mayor' },
  { label: 'Cancelados', valor: i => i.turnos_cancelados, formato: formatEntero, mejor: 'menor' },
  { label: 'Tasa de cancelación', valor: i => i.tasa_cancelacion, formato: formatPorcentaje, mejor: 'menor' },
  { label: 'Productos vendidos (unid.)', valor: i => i.productos_vendidos, formato: formatEntero, mejor: 'mayor' },
  { seccion: 'Clientes', label: 'Atendidos', valor: i => i.clientes_atendidos, formato: formatEntero, mejor: 'mayor' },
  { label: 'Nuevos captados', valor: i => i.clientes_nuevos, formato: formatEntero, mejor: 'mayor' },
  { label: 'Recurrentes', valor: i => i.clientes_recurrentes, formato: formatEntero, mejor: 'mayor' },
  { label: 'Tasa de recurrencia', valor: i => i.tasa_recurrencia, formato: formatPorcentaje, mejor: 'mayor' },
  { seccion: 'Tiempo', label: 'Horas trabajadas', valor: i => i.horas_trabajadas, formato: formatHoras, mejor: 'ninguno' },
  { label: 'Facturación por hora', valor: i => i.facturacion_por_hora, formato: formatCurrency, mejor: 'mayor' },
];

export const MetricasComparativa: React.FC<MetricasComparativaProps> = ({
  comparativa,
  agrupar,
  fechaDesde,
  fechaHasta,
  isLoading,
}) => {
  // null = selección por defecto (hasta 4 con mayor facturación)
  const [seleccionManual, setSeleccionManual] = useState<string[] | null>(null);

  const colorPorProfesional = useMemo(() => {
    const map = new Map<string, string>();
    comparativa.forEach((item, i) => map.set(item.profesional_id, COLORES[i % COLORES.length]));
    return map;
  }, [comparativa]);

  const idsSeleccionados = useMemo(() => {
    if (seleccionManual !== null) {
      return seleccionManual.filter(id => comparativa.some(c => c.profesional_id === id));
    }
    return comparativa.slice(0, 4).map(c => c.profesional_id);
  }, [seleccionManual, comparativa]);

  const seleccionados = useMemo(
    () => comparativa.filter(c => idsSeleccionados.includes(c.profesional_id)),
    [comparativa, idsSeleccionados]
  );

  const toggle = (id: string) => {
    const actual = new Set(idsSeleccionados);
    if (actual.has(id)) {
      if (actual.size === 1) return; // siempre al menos uno seleccionado
      actual.delete(id);
    } else {
      actual.add(id);
    }
    // Mantener el orden por facturación de la lista original
    setSeleccionManual(comparativa.map(c => c.profesional_id).filter(pid => actual.has(pid)));
  };

  // Serie del chart: un punto por bucket con el total de cada profesional seleccionado
  const serieEvolucion = useMemo(() => {
    const buckets = generarBuckets(agrupar, fechaDesde, fechaHasta);
    const porProfesional = new Map(
      seleccionados.map(s => [s.profesional_id, new Map(s.evolucion.map(p => [p.fecha, p.total]))])
    );
    return buckets.map(fecha => {
      const punto: Record<string, number | string> = { fecha };
      for (const s of seleccionados) {
        punto[s.profesional_id] = porProfesional.get(s.profesional_id)?.get(fecha) ?? 0;
      }
      return punto;
    });
  }, [seleccionados, agrupar, fechaDesde, fechaHasta]);

  const hayFacturacion = seleccionados.some(s => s.facturado > 0);

  // Mejor valor por fila (solo si hay más de un seleccionado y los valores difieren)
  const mejorDeFila = (fila: FilaMetrica): number | null => {
    if (fila.mejor === 'ninguno' || seleccionados.length < 2) return null;
    const valores = seleccionados.map(fila.valor);
    const unicos = new Set(valores.map(v => v.toFixed(2)));
    if (unicos.size <= 1) return null;
    return fila.mejor === 'mayor' ? Math.max(...valores) : Math.min(...valores);
  };

  if (isLoading) {
    return (
      <Card title="Comparar profesionales">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (comparativa.length === 0) {
    return (
      <Card title="Comparar profesionales">
        <p className="text-sm text-gray-500 text-center py-6">No hay profesionales activos</p>
      </Card>
    );
  }

  return (
    <Card
      title="Comparar profesionales"
      subtitle="Elegí a quiénes comparar; el mejor valor de cada fila queda resaltado"
      noPadding
    >
      {/* Selector de profesionales */}
      <div className="px-6 pt-4 pb-3 flex flex-wrap gap-2 border-b border-gray-100">
        {comparativa.map((item) => {
          const activo = idsSeleccionados.includes(item.profesional_id);
          const color = colorPorProfesional.get(item.profesional_id);
          return (
            <button
              key={item.profesional_id}
              onClick={() => toggle(item.profesional_id)}
              className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                activo
                  ? 'border-transparent text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              style={activo ? { backgroundColor: color } : undefined}
            >
              <Avatar name={item.nombre} src={item.avatar_url ?? undefined} size="sm" />
              {item.nombre}
            </button>
          );
        })}
      </div>

      {/* Tabla comparativa lado a lado */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-44">
                Métrica
              </th>
              {seleccionados.map((item) => (
                <th key={item.profesional_id} className="px-4 py-3 min-w-32">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorPorProfesional.get(item.profesional_id) }}
                      />
                      <span className="text-xs font-semibold text-gray-700 truncate max-w-28">
                        {item.nombre}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((fila) => {
              const mejor = mejorDeFila(fila);
              return (
                <React.Fragment key={fila.label}>
                  {fila.seccion && (
                    <tr className="bg-gray-50">
                      <td
                        colSpan={seleccionados.length + 1}
                        className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {fila.seccion}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-2.5 text-sm text-gray-600">{fila.label}</td>
                    {seleccionados.map((item) => {
                      const valor = fila.valor(item);
                      const esMejor = mejor !== null && valor === mejor;
                      return (
                        <td key={item.profesional_id} className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-sm tabular-nums ${
                              esMejor
                                ? 'font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md'
                                : 'text-gray-800'
                            }`}
                          >
                            {esMejor && <Trophy className="w-3 h-3" />}
                            {fila.formato(valor)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Evolución comparada */}
      <div className="px-6 py-5 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Evolución de facturación {agrupar === 'dia' ? 'por día' : 'por mes'}
        </h4>
        {!hayFacturacion ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-500">
            Sin facturación registrada en este período
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieEvolucion} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(f: string) => formatEje(f, agrupar)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatMonedaCompacta}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value) || 0),
                    seleccionados.find(s => s.profesional_id === name)?.nombre ?? String(name),
                  ]}
                  labelFormatter={(f: string) =>
                    agrupar === 'dia' ? `Día ${f.slice(8)}/${f.slice(5, 7)}` : formatEje(f, agrupar)
                  }
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-600">
                      {seleccionados.find(s => s.profesional_id === value)?.nombre ?? value}
                    </span>
                  )}
                />
                {seleccionados.map((item) => (
                  <Line
                    key={item.profesional_id}
                    type="monotone"
                    dataKey={item.profesional_id}
                    stroke={colorPorProfesional.get(item.profesional_id)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Desglose por servicio */}
      <div className="px-6 py-5 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Servicios más facturados (cobrados)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {seleccionados.map((item) => (
            <div key={item.profesional_id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: colorPorProfesional.get(item.profesional_id) }}
                />
                <span className="text-sm font-semibold text-gray-800 truncate">{item.nombre}</span>
              </div>
              {item.servicios.length === 0 ? (
                <p className="text-xs text-gray-400">Sin servicios cobrados</p>
              ) : (
                <ul className="space-y-2">
                  {item.servicios.slice(0, 5).map((s) => (
                    <li key={s.servicio} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-gray-600 truncate">
                        {s.servicio}
                        <span className="text-xs text-gray-400 ml-1">×{s.cantidad}</span>
                      </span>
                      <span className="font-medium text-gray-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(s.facturado)}
                      </span>
                    </li>
                  ))}
                  {item.servicios.length > 5 && (
                    <li className="text-xs text-gray-400">
                      +{item.servicios.length - 5} servicios más
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
