import React from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoneda } from './gastos.utils';
import type { GastosDetalleMes } from '../../types/gastos.types';

interface GastosQueEntroProps {
  detalle: GastosDetalleMes | null;
  isLoading: boolean;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Lo que entró este mes, explicado: servicios cobrados y productos vendidos.
// Nada de esto se carga a mano; el detalle vive en Finanzas.
export const GastosQueEntro: React.FC<GastosQueEntroProps> = ({ detalle, isLoading }) => {
  if (isLoading || !detalle) {
    return <div className="bg-white border border-gray-200 rounded-xl h-36 animate-pulse" />;
  }
  const { ingresos } = detalle;

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-que-entro">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Qué entró</h3>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatMoneda(ingresos.total)}</span>
      </div>
      {ingresos.total === 0 && ingresos.pendiente_cobro === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500 text-center">Todavía no se cobró nada este mes.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          <li className="flex items-center gap-3 px-4 py-2">
            <div className="flex-1 min-w-0">
              <span className="text-gray-900">Servicios</span>
              <span className="text-xs text-gray-500"> · {plural(ingresos.turnos_cobrados, 'turno cobrado', 'turnos cobrados')}</span>
            </div>
            <span className="text-gray-900 tabular-nums">{formatMoneda(ingresos.servicios)}</span>
          </li>
          <li className="flex items-center gap-3 px-4 py-2">
            <div className="flex-1 min-w-0">
              <span className="text-gray-900">Productos</span>
              <span className="text-xs text-gray-500"> · {plural(ingresos.productos_vendidos, 'unidad', 'unidades')}</span>
            </div>
            <span className="text-gray-900 tabular-nums">{formatMoneda(ingresos.productos)}</span>
          </li>
          {ingresos.pendiente_cobro > 0 && (
            <li className="flex items-center gap-2 px-4 py-2 bg-amber-50/70">
              <Clock size={14} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-amber-900">Hecho pero sin cobrar</div>
                <div className="text-xs text-amber-700">no cuenta hasta que se cobre</div>
              </div>
              <span className="text-amber-900 tabular-nums">{formatMoneda(ingresos.pendiente_cobro)}</span>
            </li>
          )}
        </ul>
      )}
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
        <Link to="/finanzas" className="inline-flex items-center gap-1 hover:text-gray-800 hover:underline">
          Ver cada turno y venta en Finanzas <ExternalLink size={11} />
        </Link>
      </div>
    </section>
  );
};
