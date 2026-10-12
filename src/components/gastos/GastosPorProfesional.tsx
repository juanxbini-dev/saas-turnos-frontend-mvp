import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Avatar, Button } from '../ui';
import { formatMoneda } from './gastos.utils';
import type { GastosDetalleMes, GastosProfesionalMes } from '../../types/gastos.types';

interface GastosPorProfesionalProps {
  detalle: GastosDetalleMes | null;
  isLoading: boolean;
  error?: unknown;
  onReintentar?: () => void;
}

// Diseño: backend/docs/gastos-ganancias-spec.md §4.6 (P2, P9).
// Una fila por persona: cuánto facturó, cuánto hay que pagarle y cuánto le queda
// al salón (facturó = pagarle + salón). El dueño va primero, no se le "paga":
// todo lo suyo queda en el salón. En celular, cards en lugar de tabla.

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Línea chica debajo del nombre: turnos, productos y, si hay, canjes y lo hecho sin cobrar
export function detalleProfesional(p: GastosProfesionalMes): string {
  const partes = [
    plural(p.turnos_cobrados, 'turno cobrado', 'turnos cobrados'),
    plural(p.unidades_vendidas, 'producto vendido', 'productos vendidos'),
  ];
  if (p.canjes > 0) partes.push(plural(p.canjes, 'canje', 'canjes'));
  if (p.pendiente_cobro > 0) partes.push(`${formatMoneda(p.pendiente_cobro)} hecho sin cobrar`);
  return partes.join(' · ');
}

// Ganancia negativa (un % mal cargado) se muestra tal cual, en rojo, sin truncar
const Monto: React.FC<{ valor: number; fuerte?: boolean }> = ({ valor, fuerte = false }) => (
  <span className={`tabular-nums ${valor < 0 ? 'text-red-700' : 'text-gray-900'} ${fuerte ? 'font-semibold' : ''}`}>
    {valor < 0 ? '−' : ''}{formatMoneda(Math.abs(valor))}
  </span>
);

const ChipDuenio = () => (
  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none bg-indigo-50 text-indigo-700 shrink-0">
    Dueño
  </span>
);

const ChipBaja = () => (
  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none bg-gray-100 text-gray-600 shrink-0">
    dado de baja
  </span>
);

const Persona: React.FC<{ p: GastosProfesionalMes }> = ({ p }) => (
  <div className="flex items-center gap-2 min-w-0">
    <Avatar src={p.avatar_url ?? undefined} name={p.nombre} size="sm" className="!w-7 !h-7 !text-[11px] shrink-0" />
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-gray-900 truncate">{p.nombre}</span>
        {p.es_duenio && <ChipDuenio />}
        {!p.activo && <ChipBaja />}
      </div>
      <div className="text-xs text-gray-500" data-testid="prof-detalle">{detalleProfesional(p)}</div>
    </div>
  </div>
);

const SinPagar = () => <span className="text-gray-400" aria-label="No se le paga">—</span>;

const LineaDuenio: React.FC<{ monto: number }> = ({ monto }) => (
  <div className="text-xs font-normal text-gray-500" data-testid="prof-linea-duenio">
    de eso, {formatMoneda(monto)} lo atendiste vos
  </div>
);

export const GastosPorProfesional: React.FC<GastosPorProfesionalProps> = ({ detalle, isLoading, error, onReintentar }) => {
  const encabezado = (
    <div className="px-4 py-3 border-b border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900">Por profesional</h3>
      <p className="text-xs text-gray-500">Lo que facturó cada uno, lo que hay que pagarle y lo que le queda al salón</p>
    </div>
  );

  if (error && !detalle) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-por-profesional">
        {encabezado}
        <div className="px-4 py-5 flex flex-col items-center text-center gap-2" role="alert">
          <AlertTriangle size={20} className="text-red-500" aria-hidden="true" />
          <p className="text-sm text-gray-700">No se pudo cargar el detalle por profesional.</p>
          {onReintentar && <Button size="sm" variant="secondary" onClick={onReintentar}>Reintentar</Button>}
        </div>
      </section>
    );
  }

  if (isLoading || !detalle) {
    return <div className="bg-white border border-gray-200 rounded-xl h-40 animate-pulse" data-testid="gastos-por-profesional-cargando" />;
  }

  const filas = detalle.profesionales;
  if (filas.length === 0) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-por-profesional">
        {encabezado}
        <p className="px-4 py-4 text-sm text-gray-500 text-center">Todavía no se cobró nada este mes.</p>
      </section>
    );
  }

  // Los totales vienen del backend (redondeados una sola vez); si no, los arma
  // normalizarDetalle sumando las filas en centavos
  const tot = detalle.totales;
  const clave = (p: GastosProfesionalMes) => p.profesional_id ?? 'sin-asignar';
  const th = 'px-4 py-2 text-xs font-medium text-gray-500 uppercase';

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-por-profesional">
      {encabezado}

      {/* Escritorio: tabla */}
      <div className="hidden md:block overflow-x-auto" data-testid="por-profesional-tabla">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>Profesional</th>
              <th className={`${th} text-right`}>Facturó</th>
              <th className={`${th} text-right`}>Hay que pagarle</th>
              <th className={`${th} text-right`}>Le queda al salón</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.map((p) => (
              <tr key={clave(p)} data-testid={`prof-fila-${clave(p)}`} className={p.es_duenio ? 'bg-indigo-50/30' : ''}>
                <td className="px-4 py-2"><Persona p={p} /></td>
                <td className="px-4 py-2 text-right" data-testid="col-facturo"><Monto valor={p.facturado} /></td>
                <td className="px-4 py-2 text-right" data-testid="col-pagarle">{p.es_duenio ? <SinPagar /> : <Monto valor={p.a_pagar} />}</td>
                <td className="px-4 py-2 text-right" data-testid="col-salon"><Monto valor={p.ganancia_salon} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold" data-testid="prof-total">
              <td className="px-4 py-2 text-gray-900">Total</td>
              <td className="px-4 py-2 text-right" data-testid="col-facturo"><Monto valor={tot.facturado} fuerte /></td>
              <td className="px-4 py-2 text-right" data-testid="col-pagarle"><Monto valor={tot.a_pagar} fuerte /></td>
              <td className="px-4 py-2 text-right align-top" data-testid="col-salon">
                <Monto valor={tot.ganancia_salon} fuerte />
                {tot.facturado_duenio > 0 && <LineaDuenio monto={tot.facturado_duenio} />}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Celular: cards */}
      <div className="md:hidden divide-y divide-gray-100" data-testid="por-profesional-cards">
        {filas.map((p) => (
          <div key={clave(p)} className={`px-4 py-3 space-y-2 ${p.es_duenio ? 'bg-indigo-50/30' : ''}`} data-testid={`prof-card-${clave(p)}`}>
            <Persona p={p} />
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-gray-500">Facturó</dt>
                <dd className="text-sm" data-testid="col-facturo"><Monto valor={p.facturado} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Hay que pagarle</dt>
                <dd className="text-sm" data-testid="col-pagarle">{p.es_duenio ? <SinPagar /> : <Monto valor={p.a_pagar} />}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Le queda al salón</dt>
                <dd className="text-sm" data-testid="col-salon"><Monto valor={p.ganancia_salon} /></dd>
              </div>
            </dl>
          </div>
        ))}
        <div className="px-4 py-3 bg-gray-50 space-y-1" data-testid="prof-total-card">
          <div className="text-sm font-semibold text-gray-900">Total</div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-gray-500">Facturó</dt>
              <dd className="text-sm" data-testid="col-facturo"><Monto valor={tot.facturado} fuerte /></dd>
            </div>
            <div>
              <dt className="text-gray-500">Hay que pagarle</dt>
              <dd className="text-sm" data-testid="col-pagarle"><Monto valor={tot.a_pagar} fuerte /></dd>
            </div>
            <div>
              <dt className="text-gray-500">Le queda al salón</dt>
              <dd className="text-sm" data-testid="col-salon"><Monto valor={tot.ganancia_salon} fuerte /></dd>
            </div>
          </dl>
          {tot.facturado_duenio > 0 && <LineaDuenio monto={tot.facturado_duenio} />}
        </div>
      </div>
    </section>
  );
};
