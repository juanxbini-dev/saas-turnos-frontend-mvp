import React from 'react';
import { Repeat, Zap, Pencil, Trash2, Check, Info, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';
import { formatMoneda, formatDiaMes } from './gastos.utils';
import type { GastosMes, GastoMesItem } from '../../types/gastos.types';

interface GastosListaMesProps {
  mes: GastosMes | null;
  isLoading: boolean;
  onAgregar: () => void;
  onEditar: (item: GastoMesItem, esRecurrente: boolean) => void;
  onEliminarUnico: (item: GastoMesItem) => void;
  onTogglePagado: (item: GastoMesItem, esRecurrente: boolean) => void;
  onVerRecurrentes: () => void;
}

// Un botón grande de estado: se tilda con un click. Es la acción más frecuente
// del dueño (marcar que ya pagó el alquiler), así que no vive en un menú.
const BotonPagado: React.FC<{ item: GastoMesItem; onClick: () => void }> = ({ item, onClick }) => {
  if (item.omitido) {
    return <span className="text-xs text-gray-400 px-2 py-1 whitespace-nowrap">no aplica este mes</span>;
  }
  const pagado = item.estado === 'pagado';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border transition-colors whitespace-nowrap ${
        pagado
          ? 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
          : 'bg-white border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-700'
      }`}
      title={pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
    >
      <span className={`w-3.5 h-3.5 rounded-full border grid place-items-center ${pagado ? 'bg-green-600 border-green-600' : 'border-gray-400'}`}>
        {pagado && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>
      {pagado ? 'Pagado' : 'Falta pagar'}
    </button>
  );
};

const Fila: React.FC<{
  item: GastoMesItem;
  esRecurrente: boolean;
  onEditar: () => void;
  onEliminar?: () => void;
  onTogglePagado: () => void;
}> = ({ item, esRecurrente, onEditar, onEliminar, onTogglePagado }) => {
  const cambiadoEsteMes = esRecurrente && !item.es_virtual && !item.omitido && item.monto_default !== undefined && item.monto !== item.monto_default;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${item.omitido ? 'opacity-50' : ''}`}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.categoria.color }} title={item.categoria.nombre} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium text-gray-900 truncate ${item.omitido ? 'line-through' : ''}`}>{item.nombre}</div>
        <div className="text-xs text-gray-500 truncate">
          {esRecurrente && item.dia_vencimiento ? `vence el ${item.dia_vencimiento}` : null}
          {!esRecurrente && item.fecha ? formatDiaMes(item.fecha) : null}
          {cambiadoEsteMes && <span className="ml-1 text-amber-700">· este mes distinto (normalmente {formatMoneda(item.monto_default!)})</span>}
          {item.notas && <span className="italic"> · {item.notas}</span>}
        </div>
      </div>
      <BotonPagado item={item} onClick={onTogglePagado} />
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

const Bloque: React.FC<{
  icono: React.ReactNode;
  titulo: string;
  ayuda: string;
  total: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icono, titulo, ayuda, total, accion, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
      <span className="text-gray-400">{icono}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{titulo}</div>
        <div className="text-xs text-gray-500">{ayuda}</div>
      </div>
      {accion}
      <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatMoneda(total)}</span>
    </div>
    <div className="divide-y divide-gray-100">{children}</div>
  </div>
);

const Vacio: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-5 text-sm text-gray-500 text-center">{children}</div>
);

// La lista del mes: lo que se paga todos los meses, lo que fue solo este mes, y
// al pie lo que el sistema calcula solo. Es la parte que el dueño usa a diario.
export const GastosListaMes: React.FC<GastosListaMesProps> = ({
  mes, isLoading, onAgregar, onEditar, onEliminarUnico, onTogglePagado, onVerRecurrentes,
}) => {
  if (isLoading || !mes) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-white border border-gray-200 rounded-xl h-32 animate-pulse" />)}
      </div>
    );
  }

  const cargado = mes.totales.recurrentes + mes.totales.unicos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Gastos del mes</h2>
        <Button leftIcon={Plus} onClick={onAgregar}>Agregar gasto</Button>
      </div>

      <Bloque
        icono={<Repeat size={18} />}
        titulo="Todos los meses"
        ayuda="Alquiler, luz, sueldos… lo que se repite"
        total={mes.totales.recurrentes}
        accion={
          <button onClick={onVerRecurrentes} className="text-xs text-blue-600 hover:underline mr-2 whitespace-nowrap">
            ver todos
          </button>
        }
      >
        {mes.recurrentes.length === 0
          ? <Vacio>Todavía no cargaste ningún gasto que se repita. Usá <strong>Agregar gasto</strong> y elegí “sí, todos los meses”.</Vacio>
          : mes.recurrentes.map((item) => (
            <Fila
              key={item.id}
              item={item}
              esRecurrente
              onEditar={() => onEditar(item, true)}
              onTogglePagado={() => onTogglePagado(item, true)}
            />
          ))}
      </Bloque>

      <Bloque
        icono={<Zap size={18} />}
        titulo="Solo este mes"
        ayuda="Arreglos, compras, imprevistos"
        total={mes.totales.unicos}
      >
        {mes.unicos.length === 0
          ? <Vacio>Nada cargado para este mes.</Vacio>
          : mes.unicos.map((item) => (
            <Fila
              key={item.id}
              item={item}
              esRecurrente={false}
              onEditar={() => onEditar(item, false)}
              onEliminar={() => onEliminarUnico(item)}
              onTogglePagado={() => onTogglePagado(item, false)}
            />
          ))}
      </Bloque>

      {/* Lo automático va al pie, chico y gris: informa, no compite con lo que se carga a mano */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Info size={16} className="text-gray-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-700">Calculado automáticamente:</span>{' '}
            {mes.derivados.map((d, i) => (
              <span key={d.clave}>
                {i > 0 && ' · '}
                {d.clave === 'comisiones' ? 'comisiones a profesionales' : 'costo de la mercadería vendida'}{' '}
                <span className="font-semibold text-gray-900 tabular-nums">{formatMoneda(d.monto)}</span>
              </span>
            ))}
            <span className="text-gray-400"> · <Link to="/finanzas" className="hover:underline">ver detalle en Finanzas</Link></span>
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{formatMoneda(mes.totales.derivados)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-sm">
        <span className="text-gray-500">
          Cargado a mano <strong className="text-gray-800 tabular-nums">{formatMoneda(cargado)}</strong>
          <span className="mx-2 text-gray-300">|</span>
          Falta pagar <strong className="text-amber-700 tabular-nums">{formatMoneda(mes.totales.pendiente)}</strong>
        </span>
        <span className="text-base text-gray-900">
          Total del mes <strong className="tabular-nums">{formatMoneda(mes.totales.total)}</strong>
        </span>
      </div>
    </div>
  );
};
