import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Cog, Repeat, Zap, Plus, Pencil, Trash2, ExternalLink, Info, Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../ui';
import { formatMoneda, formatDiaMes } from './gastos.utils';
import type { GastosMes, GastoMesItem, GastoDerivado } from '../../types/gastos.types';

interface GastosTablaMesProps {
  mes: GastosMes | null;
  isLoading: boolean;
  onNuevoUnico: () => void;
  onEditarUnico: (item: GastoMesItem) => void;
  onEliminarUnico: (item: GastoMesItem) => void;
  onNuevoRecurrente: () => void;
  onEditarMesRecurrente: (item: GastoMesItem) => void;
  onGestionarRecurrentes: () => void;
}

const EstadoBadge: React.FC<{ item: GastoMesItem }> = ({ item }) => {
  if (item.omitido) return <Badge variant="gray">No aplica</Badge>;
  return item.estado === 'pagado'
    ? <Badge variant="green">Pagado</Badge>
    : <Badge variant="yellow">Pendiente</Badge>;
};

// Sección colapsable con su total. Empieza abierta.
const Seccion: React.FC<{
  icono: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  total: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icono, titulo, subtitulo, total, accion, children }) => {
  const [abierta, setAbierta] = useState(true);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
        <button onClick={() => setAbierta((a) => !a)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          {abierta ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
          <span className="text-gray-500 shrink-0">{icono}</span>
          <span className="font-medium text-gray-800 truncate">{titulo}</span>
          {subtitulo && <span className="hidden sm:inline text-xs text-gray-500 truncate">· {subtitulo}</span>}
        </button>
        {accion}
        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap ml-2">{formatMoneda(total)}</span>
      </div>
      {abierta && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  );
};

const FilaDerivado: React.FC<{ d: GastoDerivado }> = ({ d }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
    <div className="flex-1 min-w-0">
      <div className="text-gray-800">{d.nombre}</div>
      <div className="text-xs text-gray-500 flex items-center gap-1"><Info size={11} /> {d.detalle}</div>
    </div>
    <Link to="/finanzas" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0">
      Ver en Finanzas <ExternalLink size={11} />
    </Link>
    <span className="font-medium text-gray-900 tabular-nums w-28 text-right shrink-0">{formatMoneda(d.monto)}</span>
  </div>
);

const FilaItem: React.FC<{
  item: GastoMesItem;
  esRecurrente: boolean;
  onEditar: () => void;
  onEliminar?: () => void;
}> = ({ item, esRecurrente, onEditar, onEliminar }) => {
  const editado = esRecurrente && !item.es_virtual && !item.omitido;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 text-sm ${item.omitido ? 'opacity-60' : ''}`}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.categoria.color }} />
      <div className="flex-1 min-w-0">
        <div className={`text-gray-800 truncate ${item.omitido ? 'line-through' : ''}`}>
          {item.nombre}
          {editado && (
            <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
              editado este mes
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
          <span>{item.categoria.nombre}</span>
          {esRecurrente && item.dia_vencimiento && <span>· vence el {item.dia_vencimiento}</span>}
          {!esRecurrente && item.fecha && <span>· {formatDiaMes(item.fecha)}</span>}
          {item.metodo_pago && <span>· {item.metodo_pago.replace('_', ' ')}</span>}
          {item.notas && <span className="italic truncate max-w-xs">· {item.notas}</span>}
        </div>
      </div>
      <EstadoBadge item={item} />
      <span className={`font-medium tabular-nums w-28 text-right shrink-0 ${item.omitido ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
        {formatMoneda(item.monto)}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={onEditar} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" aria-label="Editar" title={esRecurrente ? 'Editar solo este mes' : 'Editar'}>
          <Pencil size={15} />
        </button>
        {onEliminar && (
          <button onClick={onEliminar} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="Eliminar">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

const Vacio: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="px-3 py-4 text-sm text-gray-500 text-center">{texto}</div>
);

// Los tres bloques del mes: del sistema (read-only), recurrentes y únicos.
export const GastosTablaMes: React.FC<GastosTablaMesProps> = ({
  mes, isLoading, onNuevoUnico, onEditarUnico, onEliminarUnico,
  onNuevoRecurrente, onEditarMesRecurrente, onGestionarRecurrentes,
}) => {
  if (isLoading || !mes) {
    return (
      <Card>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="animate-pulse h-24 bg-gray-100 rounded" />)}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Detalle del mes" subtitle="Lo que ya calcula el sistema, los recurrentes y los gastos únicos">
      <div className="space-y-3">
        <Seccion
          icono={<Cog size={16} />}
          titulo="Del sistema"
          subtitulo="calculado, no editable"
          total={mes.totales.derivados}
        >
          {mes.derivados.map((d) => <FilaDerivado key={d.clave} d={d} />)}
        </Seccion>

        <Seccion
          icono={<Repeat size={16} />}
          titulo="Recurrentes"
          subtitulo="fijos de todos los meses"
          total={mes.totales.recurrentes}
          accion={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" leftIcon={Settings2} onClick={onGestionarRecurrentes}>
                <span className="hidden sm:inline">Plantillas</span>
              </Button>
              <Button variant="ghost" size="sm" leftIcon={Plus} onClick={onNuevoRecurrente}>
                <span className="hidden sm:inline">Nuevo</span>
              </Button>
            </div>
          }
        >
          {mes.recurrentes.length === 0
            ? <Vacio texto="No hay gastos recurrentes vigentes este mes. Creá uno con “Nuevo”." />
            : mes.recurrentes.map((item) => (
              <FilaItem key={item.id} item={item} esRecurrente onEditar={() => onEditarMesRecurrente(item)} />
            ))}
        </Seccion>

        <Seccion
          icono={<Zap size={16} />}
          titulo="Únicos"
          subtitulo="de este mes solamente"
          total={mes.totales.unicos}
          accion={
            <Button variant="ghost" size="sm" leftIcon={Plus} onClick={onNuevoUnico}>
              <span className="hidden sm:inline">Agregar gasto</span>
            </Button>
          }
        >
          {mes.unicos.length === 0
            ? <Vacio texto="Sin gastos únicos este mes." />
            : mes.unicos.map((item) => (
              <FilaItem
                key={item.id}
                item={item}
                esRecurrente={false}
                onEditar={() => onEditarUnico(item)}
                onEliminar={() => onEliminarUnico(item)}
              />
            ))}
        </Seccion>

        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 pt-2 text-sm">
          <span className="text-gray-500">
            Pagado <strong className="text-gray-800 tabular-nums">{formatMoneda(mes.totales.pagado)}</strong>
          </span>
          <span className="text-gray-500">
            Pendiente <strong className="text-gray-800 tabular-nums">{formatMoneda(mes.totales.pendiente)}</strong>
          </span>
          <span className="text-base text-gray-900">
            Total del mes <strong className="tabular-nums">{formatMoneda(mes.totales.total)}</strong>
          </span>
        </div>
      </div>
    </Card>
  );
};
