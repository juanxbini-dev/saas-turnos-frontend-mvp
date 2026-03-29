import React, { useState } from 'react';
import type { ComisionProfesional, VentaGrupadaFinanzas, VentaItemFinanzas, EntradaFinanzas, FinanzasFilters } from '../../types/finanzas.types';
import { formatCurrency, formatDate } from '../../utils/calculos.utils';
import { Badge, EmptyState, Card, Pagination } from '../ui';
import { Calendar, ShoppingBag, Package, Scissors, CheckCircle } from 'lucide-react';

type TipoFiltro = 'todos' | 'turnos' | 'productos' | 'pendientes';

interface FinanzasTableProps {
  items: EntradaFinanzas[];
  isLoading: boolean;
  isAdmin: boolean;
  onSort: (campo: FinanzasFilters['ordenar_por']) => void;
  sortField: FinanzasFilters['ordenar_por'];
  sortOrder: FinanzasFilters['orden'];
  onRowClick: (comision: ComisionProfesional) => void;
  onCobrarPago: (tipo: 'turno' | 'venta', id: string, metodoPago: 'efectivo' | 'transferencia') => Promise<void>;
  // Paginación (solo se muestra en tab "todos")
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

// Grupo de venta para render interno (mapeado desde VentaGrupadaFinanzas)
interface GrupoVenta {
  grupo_id: string;
  turno_id: string | null;
  fecha: string;
  cliente_nombre: string | null;
  vendedor_nombre: string;
  metodo_pago: string;
  total: number;
  comision_monto: number;
  neto_vendedor: number;
  items: VentaItemFinanzas[];
}

type EntradaServicio = { kind: 'servicio'; comision: ComisionProfesional };
type EntradaVenta   = { kind: 'venta';    grupo: GrupoVenta };
type Entrada = EntradaServicio | EntradaVenta;

function toGrupoVenta(v: VentaGrupadaFinanzas): GrupoVenta {
  return {
    grupo_id:       v.venta_grupo_id,
    turno_id:       v.turno_id,
    fecha:          v.fecha,
    cliente_nombre: v.cliente_nombre,
    vendedor_nombre:v.vendedor_nombre,
    metodo_pago:    v.metodo_pago,
    total:          v.total,
    comision_monto: v.comision_monto,
    neto_vendedor:  v.neto_vendedor,
    items:          v.items,
  };
}

function buildEntradas(items: EntradaFinanzas[], tipo: TipoFiltro): Entrada[] {
  return items
    .filter(item => {
      if (tipo === 'turnos')    return item.tipo === 'turno';
      if (tipo === 'productos') return item.tipo === 'venta_producto';
      if (tipo === 'pendientes') return item.metodo_pago === 'pendiente';
      return true; // 'todos'
    })
    .map(item => {
      if (item.tipo === 'turno') {
        return { kind: 'servicio' as const, comision: item as ComisionProfesional };
      }
      return { kind: 'venta' as const, grupo: toGrupoVenta(item as VentaGrupadaFinanzas) };
    });
}

const MetodoPagoBadge = ({ metodo }: { metodo: string }) => {
  const map = {
    efectivo: { color: 'green', label: 'Efectivo' },
    transferencia: { color: 'blue', label: 'Transferencia' },
    pendiente: { color: 'yellow', label: 'Pendiente' },
  };
  const b = map[metodo as keyof typeof map] || { color: 'gray', label: metodo };
  return <Badge variant={b.color as any} className="text-xs">{b.label}</Badge>;
};

// ─── Botón Cobrar inline ────────────────────────────────────────────────────

function CobrarButton({ onCobrar }: { onCobrar: (m: 'efectivo' | 'transferencia') => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async (m: 'efectivo' | 'transferencia') => {
    setLoading(true);
    try { await onCobrar(m); } finally { setLoading(false); setOpen(false); }
  };

  if (!open) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-2 py-1 rounded-full font-medium transition-colors"
      >
        <CheckCircle className="w-3 h-3" /> Cobrar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => handle('efectivo')}
        disabled={loading}
        className="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        Efectivo
      </button>
      <button
        onClick={() => handle('transferencia')}
        disabled={loading}
        className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        Transf.
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600 px-1"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Filas desktop ────────────────────────────────────────────────────────

const ServicioRow = ({
  comision, isAdmin, isPendientesTab, onClick, onCobrar,
}: {
  comision: ComisionProfesional; isAdmin: boolean; isPendientesTab: boolean;
  onClick: () => void; onCobrar: (m: 'efectivo' | 'transferencia') => void;
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
      <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
        <Scissors className="w-3 h-3" /> Turno
      </span>
    </td>
    {isAdmin && <td className="px-4 py-3 text-sm text-gray-700">{comision.profesional_nombre || '-'}</td>}
    <td className="px-4 py-3 text-sm text-gray-900">{comision.cliente_nombre}</td>
    <td className="px-4 py-3 text-sm text-gray-700">{comision.servicio_nombre}</td>
    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(comision.servicio_monto)}</td>
    <td className="px-4 py-3">
      {isPendientesTab
        ? <CobrarButton onCobrar={onCobrar} />
        : <MetodoPagoBadge metodo={comision.metodo_pago} />
      }
    </td>
    <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(comision.servicio_neto_profesional)}</td>
    <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(comision.servicio_comision_monto)}</td>
  </tr>
);

const VentaRow = ({
  grupo, isAdmin, isPendientesTab, onCobrar,
}: {
  grupo: GrupoVenta; isAdmin: boolean; isPendientesTab: boolean;
  onCobrar: (m: 'efectivo' | 'transferencia') => void;
}) => {
  const esDesdeTurno = grupo.turno_id !== null;
  const productosLabel = grupo.items.map(i => `${i.nombre_producto} ×${i.cantidad}`).join(', ');
  return (
    <tr className={`border-b ${esDesdeTurno ? 'hover:bg-amber-50/40' : 'hover:bg-purple-50/40'}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {esDesdeTurno
            ? <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            : <ShoppingBag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          }
          <span className="text-sm text-gray-900">{formatDate(grupo.fecha)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {esDesdeTurno
          ? <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
              <Package className="w-3 h-3" /> Desde turno
            </span>
          : <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">Venta directa</span>
        }
      </td>
      {isAdmin && <td className="px-4 py-3 text-sm text-gray-700">{grupo.vendedor_nombre}</td>}
      <td className="px-4 py-3 text-sm text-gray-900">{grupo.cliente_nombre || <span className="text-gray-400 italic">Sin cliente</span>}</td>
      <td className="pxadd py-3 text-sm text-gray-700 max-w-xs truncate" title={productosLabel}>{productosLabel}</td>
      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(grupo.total)}</td>
      <td className="px-4 py-3">
        {isPendientesTab
          ? <CobrarButton onCobrar={onCobrar} />
          : <MetodoPagoBadge metodo={grupo.metodo_pago} />
        }
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(grupo.neto_vendedor)}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(grupo.comision_monto)}</td>
    </tr>
  );
};

// ─── Cards mobile ─────────────────────────────────────────────────────────

const ServicioCard = ({
  comision, isAdmin, isPendientesTab, onClick, onCobrar,
}: {
  comision: ComisionProfesional; isAdmin: boolean; isPendientesTab: boolean;
  onClick: () => void; onCobrar: (m: 'efectivo' | 'transferencia') => void;
}) => (
  <div className="bg-white border-l-4 border-l-blue-500 rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <Calendar className="w-4 h-4 text-blue-500" />
          {formatDate(comision.turno_fecha)}
          <span className="text-gray-400 font-normal">{comision.turno_hora}</span>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
          <Scissors className="w-3 h-3" /> Turno
        </span>
      </div>
      {isPendientesTab
        ? <CobrarButton onCobrar={onCobrar} />
        : <MetodoPagoBadge metodo={comision.metodo_pago} />
      }
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
        <p className="text-xs text-gray-400">Total servicio</p>
        <p className="font-bold text-gray-900">{formatCurrency(comision.servicio_monto)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Neto Prof.</p>
        <p className="font-bold text-green-600">{formatCurrency(comision.servicio_neto_profesional)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Comisión Emp.</p>
        <p className="font-bold text-blue-600">{formatCurrency(comision.servicio_comision_monto)}</p>
      </div>
    </div>
  </div>
);

const VentaCard = ({
  grupo, isAdmin, isPendientesTab, onCobrar,
}: {
  grupo: GrupoVenta; isAdmin: boolean; isPendientesTab: boolean;
  onCobrar: (m: 'efectivo' | 'transferencia') => void;
}) => {
  const esDesdeTurno = grupo.turno_id !== null;
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 ${esDesdeTurno ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-purple-500'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
            {esDesdeTurno
              ? <Package className="w-4 h-4 text-amber-500" />
              : <ShoppingBag className="w-4 h-4 text-purple-500" />
            }
            {formatDate(grupo.fecha)}
          </div>
          {esDesdeTurno
            ? <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Desde turno</span>
            : <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">Venta directa</span>
          }
        </div>
        {isPendientesTab
          ? <CobrarButton onCobrar={onCobrar} />
          : <MetodoPagoBadge metodo={grupo.metodo_pago} />
        }
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        {grupo.items.map(i => (
          <p key={i.id}><span className="font-medium">{i.nombre_producto}</span> × {i.cantidad}</p>
        ))}
        <p><span className="font-medium">Cliente:</span> {grupo.cliente_nombre || <span className="italic text-gray-400">Sin cliente</span>}</p>
        {isAdmin && <p><span className="font-medium">Vendedor:</span> {grupo.vendedor_nombre}</p>}
      </div>
      <div className="border-t mt-3 pt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <p className="text-xs text-gray-400">Total</p>
          <p className="font-bold text-gray-900">{formatCurrency(grupo.total)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Neto Prof.</p>
          <p className="font-bold text-green-600">{formatCurrency(grupo.neto_vendedor)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Comisión Emp.</p>
          <p className={`font-bold ${esDesdeTurno ? 'text-amber-600' : 'text-purple-600'}`}>{formatCurrency(grupo.comision_monto)}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Tabs ──────────────────────────────────────────────────────────────────

const TABS: { value: TipoFiltro; label: string }[] = [
  { value: 'todos',      label: 'Todos' },
  { value: 'turnos',     label: 'Turnos' },
  { value: 'productos',  label: 'Productos' },
  { value: 'pendientes', label: 'Pendientes' },
];

// ─── Componente principal ─────────────────────────────────────────────────

export const FinanzasTable: React.FC<FinanzasTableProps> = ({
  items, isLoading, isAdmin, onSort, sortField, sortOrder, onRowClick, onCobrarPago,
  page, totalPages, total, limit, onPageChange,
}) => {
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

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

  const entradas = buildEntradas(items ?? [], tipoFiltro);
  const isPendientesTab = tipoFiltro === 'pendientes';

  const getSortIcon = (campo: FinanzasFilters['ordenar_por']) => {
    if (sortField !== campo) return <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortOrder === 'asc'
      ? <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setTipoFiltro(tab.value); if (page > 1) onPageChange(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tipoFiltro === tab.value
                ? tab.value === 'pendientes'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {entradas.length === 0 ? (
        <Card>
          <EmptyState title="No hay registros" message="No hay transacciones para el filtro seleccionado." />
        </Card>
      ) : (
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {isPendientesTab ? 'Acción' : 'Método'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => onSort('total_neto_profesional')}>
                        <div className="flex items-center gap-1">Neto Prof. {getSortIcon('total_neto_profesional')}</div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión Emp.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {entradas.map((e) => {
                      if (e.kind === 'servicio') {
                        const getCobrar = (m: 'efectivo' | 'transferencia') =>
                          onCobrarPago('turno', e.comision.turno_id, m);
                        return <ServicioRow key={`s-${e.comision.id}`} comision={e.comision} isAdmin={isAdmin} isPendientesTab={isPendientesTab} onClick={() => onRowClick(e.comision)} onCobrar={getCobrar} />;
                      }
                      const getCobrar = (m: 'efectivo' | 'transferencia') =>
                        onCobrarPago(e.grupo.turno_id ? 'turno' : 'venta', e.grupo.grupo_id, m);
                      return <VentaRow key={`v-${e.grupo.grupo_id}`} grupo={e.grupo} isAdmin={isAdmin} isPendientesTab={isPendientesTab} onCobrar={getCobrar} />;
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {entradas.map((e) => {
              if (e.kind === 'servicio') {
                const getCobrar = (m: 'efectivo' | 'transferencia') =>
                  onCobrarPago('turno', e.comision.turno_id, m);
                return <ServicioCard key={`s-${e.comision.id}`} comision={e.comision} isAdmin={isAdmin} isPendientesTab={isPendientesTab} onClick={() => onRowClick(e.comision)} onCobrar={getCobrar} />;
              }
              const getCobrar = (m: 'efectivo' | 'transferencia') =>
                onCobrarPago(e.grupo.turno_id ? 'turno' : 'venta', e.grupo.grupo_id, m);
              return <VentaCard key={`v-${e.grupo.grupo_id}`} grupo={e.grupo} isAdmin={isAdmin} isPendientesTab={isPendientesTab} onCobrar={getCobrar} />;
            })}
          </div>
        </>
      )}

      {/* Paginación — solo en tab "todos" y cuando hay más de una página */}
      {tipoFiltro === 'todos' && totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
};
