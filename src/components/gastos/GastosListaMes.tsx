import React from 'react';
import { Repeat, Pencil, Trash2, Check, AlertCircle, Plus, Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';
import { formatMoneda, formatDiaMes, estaVencido, GASTOS_SUGERIDOS } from './gastos.utils';
import type { GastosMes, GastoMesItem } from '../../types/gastos.types';

interface GastosListaMesProps {
  mes: GastosMes | null;
  periodo: string;
  isLoading: boolean;
  onAgregar: (sugerido?: { nombre: string; categoria: string; dia?: number }) => void;
  onEditar: (item: GastoMesItem, esRecurrente: boolean) => void;
  onEliminarUnico: (item: GastoMesItem) => void;
  onTogglePagado: (item: GastoMesItem, esRecurrente: boolean) => void;
  onVerRecurrentes: () => void;
}

// Un renglón de la lista es un gasto con su origen (¿se repite?), y eso decide
// qué acciones tiene. La lista en sí no separa por origen: separa por lo que el
// dueño necesita saber, que es qué falta pagar.
interface Renglon {
  item: GastoMesItem;
  esRecurrente: boolean;
  vencido: boolean;
}

const BotonPagado: React.FC<{ item: GastoMesItem; onClick: () => void }> = ({ item, onClick }) => {
  const pagado = item.estado === 'pagado';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border transition-colors whitespace-nowrap ${
        pagado
          ? 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
          : 'bg-white border-gray-300 text-gray-700 hover:border-green-500 hover:bg-green-50 hover:text-green-800'
      }`}
      title={pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
    >
      <span className={`w-4 h-4 rounded-full border grid place-items-center ${pagado ? 'bg-green-600 border-green-600' : 'border-gray-400'}`}>
        {pagado && <Check size={11} className="text-white" strokeWidth={3} />}
      </span>
      {pagado ? 'Pagado' : 'Marcar pagado'}
    </button>
  );
};

const Fila: React.FC<{
  r: Renglon;
  onEditar: () => void;
  onEliminar?: () => void;
  onTogglePagado: () => void;
}> = ({ r, onEditar, onEliminar, onTogglePagado }) => {
  const { item, esRecurrente, vencido } = r;
  const pagado = item.estado === 'pagado';
  const distinto = esRecurrente && !item.es_virtual && item.monto_default !== undefined && item.monto !== item.monto_default;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${item.omitido ? 'opacity-50' : ''} ${pagado ? 'bg-gray-50/60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-medium truncate ${item.omitido ? 'line-through text-gray-500' : 'text-gray-900'}`}>{item.nombre}</span>
          {esRecurrente && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 shrink-0" title="Se repite todos los meses">
              <Repeat size={11} /> todos los meses
            </span>
          )}
        </div>
        <div className={`text-xs truncate ${vencido && !pagado && !item.omitido ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {item.omitido
            ? 'este mes no se paga'
            : vencido && !pagado
              ? <span className="inline-flex items-center gap-1"><AlertCircle size={12} /> venció el {item.dia_vencimiento}</span>
              : esRecurrente && item.dia_vencimiento
                ? `vence el ${item.dia_vencimiento}`
                : !esRecurrente && item.fecha
                  ? formatDiaMes(item.fecha)
                  : null}
          {distinto && !item.omitido && <span className="text-amber-700"> · este mes distinto (normalmente {formatMoneda(item.monto_default!)})</span>}
          {item.notas && <span className="italic"> · {item.notas}</span>}
        </div>
      </div>

      {!item.omitido && <BotonPagado item={item} onClick={onTogglePagado} />}

      <span className={`text-sm font-semibold tabular-nums w-28 text-right shrink-0 ${item.omitido ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
        {formatMoneda(item.monto)}
      </span>

      <div className="flex items-center shrink-0">
        <button onClick={onEditar} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" aria-label="Editar" title="Editar">
          <Pencil size={15} />
        </button>
        {onEliminar && (
          <button onClick={onEliminar} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="Eliminar" title="Eliminar">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

// Arranque guiado: la primera vez no hay nada, y "$0" no le dice al dueño qué
// hacer. Los chips lo llevan directo a cargar sus fijos con dos toques.
const ArranqueGuiado: React.FC<{ onAgregar: GastosListaMesProps['onAgregar'] }> = ({ onAgregar }) => (
  <div className="bg-white border-2 border-dashed border-blue-200 rounded-xl p-6 text-center">
    <h3 className="text-base font-semibold text-gray-900">Empezá con tus gastos fijos</h3>
    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
      Tocá los que pagás todos los meses. Solo te va a pedir el monto; después se repiten solos.
    </p>
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {GASTOS_SUGERIDOS.map((s) => (
        <button
          key={s.nombre}
          onClick={() => onAgregar(s)}
          className="inline-flex items-center gap-1 text-sm border border-gray-300 bg-white rounded-full px-3 py-1.5 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 transition-colors"
        >
          <Plus size={14} /> {s.nombre}
        </button>
      ))}
    </div>
    <button onClick={() => onAgregar()} className="text-sm text-blue-600 hover:underline mt-4 inline-flex items-center gap-1">
      Otro gasto <ChevronRight size={14} />
    </button>
  </div>
);

export const GastosListaMes: React.FC<GastosListaMesProps> = ({
  mes, periodo, isLoading, onAgregar, onEditar, onEliminarUnico, onTogglePagado, onVerRecurrentes,
}) => {
  if (isLoading || !mes) {
    return <div className="bg-white border border-gray-200 rounded-xl h-48 animate-pulse" />;
  }

  const renglones: Renglon[] = [
    ...mes.recurrentes.map((item) => ({ item, esRecurrente: true, vencido: estaVencido(periodo, item.dia_vencimiento) })),
    ...mes.unicos.map((item) => ({ item, esRecurrente: false, vencido: false })),
  ];

  const nadaCargado = renglones.length === 0;

  // Falta pagar: primero lo vencido, después por día de vencimiento, después el resto
  const faltaPagar = renglones
    .filter((r) => r.item.estado !== 'pagado' && !r.item.omitido)
    .sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      const da = a.item.dia_vencimiento ?? 99;
      const db = b.item.dia_vencimiento ?? 99;
      return da - db;
    });
  const yaPagado = renglones.filter((r) => r.item.estado === 'pagado' && !r.item.omitido);
  const noAplican = renglones.filter((r) => r.item.omitido);

  const totalFalta = faltaPagar.reduce((t, r) => t + r.item.monto, 0);
  const totalPagado = yaPagado.reduce((t, r) => t + r.item.monto, 0);
  const vencidos = faltaPagar.filter((r) => r.vencido).length;

  const renderFila = (r: Renglon) => (
    <Fila
      key={r.item.id}
      r={r}
      onEditar={() => onEditar(r.item, r.esRecurrente)}
      onEliminar={r.esRecurrente ? undefined : () => onEliminarUnico(r.item)}
      onTogglePagado={() => onTogglePagado(r.item, r.esRecurrente)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Gastos del mes</h2>
        <div className="flex items-center gap-3">
          <button onClick={onVerRecurrentes} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">
            Mis gastos fijos
          </button>
          <Button leftIcon={Plus} onClick={() => onAgregar()}>Agregar gasto</Button>
        </div>
      </div>

      {nadaCargado ? (
        <ArranqueGuiado onAgregar={onAgregar} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Te falta pagar */}
          <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${vencidos > 0 ? 'bg-red-50' : 'bg-amber-50/60'}`}>
            <span className={`text-sm font-semibold ${vencidos > 0 ? 'text-red-800' : 'text-amber-900'}`}>
              Te falta pagar
            </span>
            {vencidos > 0 && (
              <span className="text-xs text-red-700 font-medium">· {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}</span>
            )}
            <span className={`ml-auto text-sm font-semibold tabular-nums ${vencidos > 0 ? 'text-red-800' : 'text-amber-900'}`}>
              {formatMoneda(totalFalta)}
            </span>
          </div>
          {faltaPagar.length === 0
            ? <div className="px-4 py-5 text-sm text-green-700 text-center flex items-center justify-center gap-2"><Check size={16} /> Todo pagado. Nada pendiente este mes.</div>
            : <div className="divide-y divide-gray-100">{faltaPagar.map(renderFila)}</div>}

          {/* Ya pagaste */}
          {yaPagado.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-y border-gray-100 bg-gray-50">
                <span className="text-sm font-semibold text-gray-600">Ya pagaste</span>
                <span className="ml-auto text-sm font-semibold tabular-nums text-gray-600">{formatMoneda(totalPagado)}</span>
              </div>
              <div className="divide-y divide-gray-100">{yaPagado.map(renderFila)}</div>
            </>
          )}

          {/* No aplican este mes */}
          {noAplican.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">Este mes no se pagan</div>
              <div className="divide-y divide-gray-100">{noAplican.map(renderFila)}</div>
            </>
          )}
        </div>
      )}

      {/* Lo automático: informa, no compite */}
      <div className="flex items-start gap-2 px-1 text-sm text-gray-500">
        <Info size={15} className="shrink-0 mt-0.5 text-gray-400" />
        <span>
          Además, este mes salieron{' '}
          <span className="font-semibold text-gray-800 tabular-nums">{formatMoneda(mes.totales.derivados)}</span>{' '}
          en comisiones a los profesionales y mercadería vendida — eso se calcula solo{' '}
          <Link to="/finanzas" className="text-blue-600 hover:underline">(ver en Finanzas)</Link>.
        </span>
      </div>
    </div>
  );
};
