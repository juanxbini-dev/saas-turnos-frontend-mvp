import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Package, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui';
import { formatMoneda } from './gastos.utils';
import type { GastosDetalleMes } from '../../types/gastos.types';

interface GastosDetalleAutomaticoProps {
  detalle: GastosDetalleMes | null;
  isLoading: boolean;
}

// Lo que el sistema ya sabe del mes, explicado: cuánto entró y por qué, y cuánto
// salió solo en comisiones (por profesional) y mercadería. Nada de esto se carga
// a mano, por eso va después de la lista y no adentro.
export const GastosDetalleAutomatico: React.FC<GastosDetalleAutomaticoProps> = ({ detalle, isLoading }) => {
  if (isLoading || !detalle) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl h-40 animate-pulse" />
        <div className="bg-white border border-gray-200 rounded-xl h-40 animate-pulse" />
      </div>
    );
  }

  const { ingresos, comisiones, comisiones_total, mercaderia_costo, mercaderia_unidades } = detalle;
  const salioSolo = comisiones_total + mercaderia_costo;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Qué entró */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <ArrowDownToLine size={16} className="text-green-600" />
          <span className="text-sm font-semibold text-gray-900">Qué entró</span>
          <span className="ml-auto text-sm font-semibold text-gray-900 tabular-nums">{formatMoneda(ingresos.total)}</span>
        </div>
        {ingresos.total === 0 && ingresos.pendiente_cobro === 0 ? (
          <div className="px-4 py-5 text-sm text-gray-500 text-center">Todavía no se cobró nada este mes.</div>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-gray-900">Servicios</div>
                <div className="text-xs text-gray-500">{plural(ingresos.turnos_cobrados, 'turno cobrado', 'turnos cobrados')}</div>
              </div>
              <span className="font-medium text-gray-900 tabular-nums">{formatMoneda(ingresos.servicios)}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-gray-900">Productos vendidos</div>
                <div className="text-xs text-gray-500">{plural(ingresos.productos_vendidos, 'unidad', 'unidades')}</div>
              </div>
              <span className="font-medium text-gray-900 tabular-nums">{formatMoneda(ingresos.productos)}</span>
            </div>
            {ingresos.pendiente_cobro > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50/60">
                <Clock size={14} className="text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-amber-900">Hecho pero todavía sin cobrar</div>
                  <div className="text-xs text-amber-700">no cuenta hasta que se cobre</div>
                </div>
                <span className="font-medium text-amber-900 tabular-nums">{formatMoneda(ingresos.pendiente_cobro)}</span>
              </div>
            )}
          </div>
        )}
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          <Link to="/finanzas" className="inline-flex items-center gap-1 hover:text-gray-700 hover:underline">
            Ver cada turno y venta en Finanzas <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {/* Qué salió solo */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <ArrowUpFromLine size={16} className="text-pink-600" />
          <span className="text-sm font-semibold text-gray-900">Qué salió solo</span>
          <span className="text-xs text-gray-500">· se calcula, no se carga</span>
          <span className="ml-auto text-sm font-semibold text-gray-900 tabular-nums">{formatMoneda(salioSolo)}</span>
        </div>
        {salioSolo === 0 ? (
          <div className="px-4 py-5 text-sm text-gray-500 text-center">Sin comisiones ni mercadería este mes.</div>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            {comisiones.length > 0 && (
              <div className="px-4 pt-2.5 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Comisiones a profesionales · {formatMoneda(comisiones_total)}
              </div>
            )}
            {comisiones.map((c) => (
              <div key={c.profesional_id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar src={c.avatar_url ?? undefined} name={c.nombre} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate">{c.nombre}</div>
                  <div className="text-xs text-gray-500">
                    {plural(c.turnos_cobrados, 'turno', 'turnos')}
                    {c.productos > 0 && ` · ${formatMoneda(c.productos)} por productos`}
                  </div>
                </div>
                <span className="font-medium text-gray-900 tabular-nums">{formatMoneda(c.total)}</span>
              </div>
            ))}
            {mercaderia_costo > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-50 grid place-items-center shrink-0">
                  <Package size={15} className="text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900">Costo de la mercadería vendida</div>
                  <div className="text-xs text-gray-500">{plural(mercaderia_unidades, 'unidad', 'unidades')} · lo que te costó comprar lo que vendiste</div>
                </div>
                <span className="font-medium text-gray-900 tabular-nums">{formatMoneda(mercaderia_costo)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
