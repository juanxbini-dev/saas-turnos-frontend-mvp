import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Spinner } from '../ui';
import { campaniasService } from '../../services/campanias.service';
import { CAMPANIA_LABELS, MetricasCampanias } from '../../types/campania.types';

const toLocalStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ESTADO_ENTREGA_LABEL: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'Falló',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

function KPI({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'warn' | 'good' }) {
  const tones = {
    default: 'text-gray-900',
    warn: 'text-red-600',
    good: 'text-green-700',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function CampaniasMetricasTab() {
  const [base, setBase] = useState(() => new Date());
  const [data, setData] = useState<MetricasCampanias | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const periodo = useMemo(() => ({
    desde: toLocalStr(new Date(base.getFullYear(), base.getMonth(), 1)),
    hasta: toLocalStr(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
  }), [base]);

  const now = new Date();
  const esMesActual = base.getFullYear() === now.getFullYear() && base.getMonth() === now.getMonth();
  const etiquetaMes = useMemo(() => {
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(base);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [base]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(false);
    campaniasService.getMetricas(periodo.desde, periodo.hasta)
      .then(d => { if (!cancelado) setData(d); })
      .catch(() => { if (!cancelado) setError(true); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [periodo]);

  const navegar = (dir: -1 | 1) => setBase(new Date(base.getFullYear(), base.getMonth() + dir, 1));

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        <Button variant="ghost" size="sm" leftIcon={ChevronLeft} onClick={() => navegar(-1)}>Anterior</Button>
        <h2 className="text-lg font-semibold text-gray-900 min-w-40 text-center">{etiquetaMes}</h2>
        <Button variant="ghost" size="sm" rightIcon={ChevronRight} disabled={esMesActual} onClick={() => navegar(1)}>Siguiente</Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
          No se pudieron cargar las métricas.
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <KPI label="Enviados" value={data.totales.enviados} hint={data.totales.simulados > 0 ? `+ ${data.totales.simulados} simulados` : undefined} />
            <KPI label="Entregados" value={data.totales.entregados} hint={data.totales.leidos > 0 ? `${data.totales.leidos} leídos` : undefined} />
            <KPI
              label="Volvieron"
              value={pct(data.totales.tasa_conversion)}
              hint={`${data.totales.convertidos} agendaron en ${data.ventana_conversion_dias} días`}
              tone={data.totales.convertidos > 0 ? 'good' : 'default'}
            />
            <KPI
              label="Bajas"
              value={data.opt_outs_periodo}
              hint={`${data.opt_outs_total} en total`}
              tone={data.opt_outs_periodo > 0 ? 'warn' : 'default'}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Campaña</th>
                  <th className="text-right px-4 py-2">Enviados</th>
                  <th className="text-right px-4 py-2">Fallidos</th>
                  <th className="text-right px-4 py-2">Simulados</th>
                  <th className="text-right px-4 py-2">Entregados</th>
                  <th className="text-right px-4 py-2">Leídos</th>
                  <th className="text-right px-4 py-2">Volvieron</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.por_tipo.map(m => (
                  <tr key={m.tipo} className={m.enviados + m.simulados === 0 ? 'text-gray-400' : 'text-gray-800'}>
                    <td className="px-4 py-2">{CAMPANIA_LABELS[m.tipo].titulo}</td>
                    <td className="px-4 py-2 text-right">{m.enviados}</td>
                    <td className={`px-4 py-2 text-right ${m.fallidos > 0 ? 'text-red-600' : ''}`}>{m.fallidos}</td>
                    <td className="px-4 py-2 text-right">{m.simulados}</td>
                    <td className="px-4 py-2 text-right">{m.entregados}</td>
                    <td className="px-4 py-2 text-right">{m.leidos}</td>
                    <td className="px-4 py-2 text-right">
                      {m.enviados > 0 ? `${m.convertidos} (${pct(m.tasa_conversion)})` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-2">Últimos mensajes</h3>
          {data.ultimos_mensajes.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay mensajes registrados.</p>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {data.ultimos_mensajes.map(m => (
                    <tr key={m.id} className="text-gray-800">
                      <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                        {new Date(m.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2">{m.cliente_nombre ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{CAMPANIA_LABELS[m.tipo].titulo}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          m.estado === 'fallido' ? 'bg-red-100 text-red-700'
                          : m.estado === 'simulado' ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                        }`}>
                          {m.estado === 'enviado' && m.estado_entrega
                            ? ESTADO_ENTREGA_LABEL[m.estado_entrega] ?? m.estado_entrega
                            : m.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">
            "Volvieron" es una aproximación: clientes que agendaron un turno dentro de los {data.ventana_conversion_dias} días
            posteriores al mensaje. Las bajas por campaña son la señal temprana de que un mensaje molesta.
          </p>
        </>
      )}
    </div>
  );
}
