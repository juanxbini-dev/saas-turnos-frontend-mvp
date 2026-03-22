import React from 'react';
import type { ComisionProfesional, VentaDirectaFinanzas, FinanzasFilters } from '../../types/finanzas.types';
import { formatCurrency, formatDate } from '../../utils/calculos.utils';
import { Badge, Spinner, EmptyState, Card } from '../ui';
import { Calendar, ShoppingBag, Package } from 'lucide-react';

interface FinanzasTableProps {
  data: ComisionProfesional[];
  ventas_directas: VentaDirectaFinanzas[];
  isLoading: boolean;
  isAdmin: boolean;
  onSort: (campo: FinanzasFilters['ordenar_por']) => void;
  sortField: FinanzasFilters['ordenar_por'];
  sortOrder: FinanzasFilters['orden'];
  onRowClick: (comision: ComisionProfesional) => void;
}

const MetodoPagoBadge = ({ metodo }: { metodo: string }) => {
  const badges = {
    efectivo: { color: 'green', label: 'Efectivo' },
    transferencia: { color: 'blue', label: 'Transferencia' },
    pendiente: { color: 'yellow', label: 'Pendiente' },
  };
  const badge = badges[metodo as keyof typeof badges] || { color: 'gray', label: metodo };
  return <Badge variant={badge.color as any} className="text-xs">{badge.label}</Badge>;
};

// Mezcla y ordena turnos + ventas directas por fecha desc
function mergeAndSort(
  turnos: ComisionProfesional[],
  ventas: VentaDirectaFinanzas[]
): Array<ComisionProfesional | VentaDirectaFinanzas> {
  const all: Array<ComisionProfesional | VentaDirectaFinanzas> = [
    ...turnos,
    ...ventas,
  ];
  return all.sort((a, b) => {
    const fechaA = a.tipo === 'turno' ? a.turno_fecha : a.fecha;
    const fechaB = b.tipo === 'turno' ? b.turno_fecha : b.fecha;
    return new Date(fechaB).getTime() - new Date(fechaA).getTime();
  });
}

// ─── Fila de turno (desktop) ──────────────────────────────────────────────
const TurnoRow = ({
  comision,
  isAdmin,
  onClick,
}: {
  comision: ComisionProfesional;
  isAdmin: boolean;
  onClick: () => void;
}) => (
  <tr className="hover:bg-blue-50/40 cursor-pointer border-b" onClick={onClick}>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-sm text-gray-900">{formatDate(comision.turno_fecha)}</span>
        <span className="text-xs text-gray-400">{comision.turno_hora}</span>
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">Turno</span>
        {comision.tiene_productos && (
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Package className="w-3 h-3" /> Con productos
          </span>
        )}
      </div>
    </td>
    {isAdmin && <td className="px-4 py-3 text-sm text-gray-700">{comision.profesional_nombre || '-'}</td>}
    <td className="px-4 py-3 text-sm text-gray-900">{comision.cliente_nombre}</td>
    <td className="px-4 py-3 text-sm text-gray-700">{comision.servicio_nombre}</td>
    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(comision.total_final)}</td>
    <td className="px-4 py-3"><MetodoPagoBadge metodo={comision.metodo_pago} /></td>
    <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(comision.total_neto_profesional)}</td>
    <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(comision.total_comision_empresa)}</td>
  </tr>
);

// ─── Fila de venta directa (desktop) ─────────────────────────────────────
const VentaRow = ({ venta, isAdmin }: { venta: VentaDirectaFinanzas; isAdmin: boolean }) => (
  <tr className="hover:bg-purple-50/40 border-b">
    <td className="px-4 py-3">
      <div className="flex items-center gap-1.5">
        <ShoppingBag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="text-sm text-gray-900">{formatDate(venta.fecha)}</span>
      </div>
    </td>
    <td className="px-4 py-3">
      <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
        Venta directa
      </span>
    </td>
    {isAdmin && <td className="px-4 py-3 text-sm text-gray-700">{venta.vendedor_nombre}</td>}
    <td className="px-4 py-3 text-sm text-gray-900">{venta.cliente_nombre || <span className="text-gray-400 italic">Sin cliente</span>}</td>
    <td className="px-4 py-3 text-sm text-gray-500">{venta.items_count} producto{venta.items_count !== 1 ? 's' : ''}</td>
    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(venta.total)}</td>
    <td className="px-4 py-3"><MetodoPagoBadge metodo={venta.metodo_pago} /></td>
    <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(venta.total)}</td>
    <td className="px-4 py-3 text-sm text-gray-400">-</td>
  </tr>
);

// ─── Card de turno (mobile) ───────────────────────────────────────────────
const TurnoCard = ({
  comision,
  isAdmin,
  onClick,
}: {
  comision: ComisionProfesional;
  isAdmin: boolean;
  onClick: () => void;
}) => (
  <div
    className="bg-white border-l-4 border-l-blue-500 rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
    onClick={onClick}
  >
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <Calendar className="w-4 h-4 text-blue-500" />
          {formatDate(comision.turno_fecha)}
          <span className="text-gray-400 font-normal">{comision.turno_hora}</span>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">Turno</span>
        {comision.tiene_productos && (
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Package className="w-3 h-3" /> Con productos
          </span>
        )}
      </div>
      <MetodoPagoBadge metodo={comision.metodo_pago} />
    </div>
    <div className="space-y-1 text-sm text-gray-600">
      <p><span className="font-medium">Cliente:</span> {comision.cliente_nombre}</p>
      <p><span className="font-medium">Servicio:</span> {comision.servicio_nombre}</p>
      {isAdmin && comision.profesional_nombre && (
        <p><span className="font-medium">Profesional:</span> {comision.profesional_nombre}</p>
      )}
    </div>
    <div className="border-t mt-3 pt-3 grid grid-cols-3 gap-2 text-center text-sm">
      <div>
        <p className="text-xs text-gray-400">Total</p>
        <p className="font-bold text-gray-900">{formatCurrency(comision.total_final)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Neto Prof.</p>
        <p className="font-bold text-green-600">{formatCurrency(comision.total_neto_profesional)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Comisión Emp.</p>
        <p className="font-bold text-blue-600">{formatCurrency(comision.total_comision_empresa)}</p>
      </div>
    </div>
  </div>
);

// ─── Card de venta directa (mobile) ──────────────────────────────────────
const VentaCard = ({ venta, isAdmin }: { venta: VentaDirectaFinanzas; isAdmin: boolean }) => (
  <div className="bg-white border-l-4 border-l-purple-500 rounded-xl shadow-sm p-4">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <ShoppingBag className="w-4 h-4 text-purple-500" />
          {formatDate(venta.fecha)}
        </div>
        <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">Venta directa</span>
      </div>
      <MetodoPagoBadge metodo={venta.metodo_pago} />
    </div>
    <div className="space-y-1 text-sm text-gray-600">
      <p><span className="font-medium">Cliente:</span> {venta.cliente_nombre || <span className="italic text-gray-400">Sin cliente</span>}</p>
      <p><span className="font-medium">Productos:</span> {venta.items_count} ítem{venta.items_count !== 1 ? 's' : ''}</p>
      {isAdmin && <p><span className="font-medium">Vendedor:</span> {venta.vendedor_nombre}</p>}
    </div>
    <div className="border-t mt-3 pt-3 text-center text-sm">
      <p className="text-xs text-gray-400">Total</p>
      <p className="font-bold text-lg text-gray-900">{formatCurrency(venta.total)}</p>
    </div>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────
export const FinanzasTable: React.FC<FinanzasTableProps> = ({
  data,
  ventas_directas,
  isLoading,
  isAdmin,
  onSort,
  sortField,
  sortOrder,
  onRowClick,
}) => {
  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  const merged = mergeAndSort(data, ventas_directas ?? []);

  if (merged.length === 0) {
    return (
      <Card>
        <EmptyState title="No hay registros financieros" message="No hay transacciones para el período seleccionado." />
      </Card>
    );
  }

  const getSortIcon = (campo: FinanzasFilters['ordenar_por']) => {
    if (sortField !== campo) return <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortOrder === 'asc'
      ? <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => onSort('fecha')}>
                    <div className="flex items-center gap-1">Fecha {getSortIcon('fecha')}</div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profesional</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => onSort('total_venta')}>
                    <div className="flex items-center gap-1">Total {getSortIcon('total_venta')}</div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => onSort('total_neto_profesional')}>
                    <div className="flex items-center gap-1">Neto Prof. {getSortIcon('total_neto_profesional')}</div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión Emp.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {merged.map(entry =>
                  entry.tipo === 'turno' ? (
                    <TurnoRow key={`turno-${entry.id}`} comision={entry} isAdmin={isAdmin} onClick={() => onRowClick(entry)} />
                  ) : (
                    <VentaRow key={`venta-${entry.id}`} venta={entry} isAdmin={isAdmin} />
                  )
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {merged.map(entry =>
          entry.tipo === 'turno' ? (
            <TurnoCard key={`turno-${entry.id}`} comision={entry} isAdmin={isAdmin} onClick={() => onRowClick(entry)} />
          ) : (
            <VentaCard key={`venta-${entry.id}`} venta={entry} isAdmin={isAdmin} />
          )
        )}
      </div>
    </>
  );
};
