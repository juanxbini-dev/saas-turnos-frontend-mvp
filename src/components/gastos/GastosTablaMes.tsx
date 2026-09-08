import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Plus, X, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, Button } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { alcanceMontoFijoPorDefecto, aplicarCambioMontoFijo, ALCANCES_MONTO_FIJO, mensajeCambioMontoFijo, type AlcanceMontoFijo } from '../../hooks/useCambioMontoFijo';
import { estaVencido, formatDiaMes, formatMoneda, itemPagado, nombreMes } from './gastos.utils';
import { ArranqueGuiado } from './ArranqueGuiado';
import { GastoFormInline, type GastoFormPreset } from './GastoFormInline';
import type { GastoCategoria, GastoDerivado, GastoEstado, GastoMesItem, GastosDetalleMes, GastosMes } from '../../types/gastos.types';

interface GastosTablaMesProps {
  mes: GastosMes | null;
  detalle: GastosDetalleMes | null;
  periodo: string;
  categorias: GastoCategoria[];
  categoriasCargando?: boolean;
  isLoading: boolean;
  panelAbierto: boolean;
  onTogglePanel: () => void;
  onAbrirPanel: (preset?: GastoFormPreset) => void;
  preset: GastoFormPreset | null;
  presetNonce: number;
  onEditar: (item: GastoMesItem, esFijo: boolean) => void;
  onEliminarUnico: (item: GastoMesItem) => void;
  onCambio: () => void;
}

// ---------------------------------------------------------------- Agrupación

export interface FilaGasto {
  item: GastoMesItem;
  esFijo: boolean;
  vencido: boolean;     // pendiente, no omitido y ya pasó el día de vencimiento
  pendiente: boolean;   // no pagado y no omitido
}

export interface Rubro {
  id: string;
  nombre: string;
  color: string;
  filas: FilaGasto[];
  subtotal: number;     // suma de las filas no omitidas
  contables: number;    // filas no omitidas
  pagadas: number;
  pendientes: number;
  vencidas: number;
  minDiaPendiente: number;   // Infinity si ninguna pendiente tiene día
  minDiaVencida: number;
}

const diaDe = (f: FilaGasto) => f.item.dia_vencimiento ?? Infinity;

// Orden por día de vencimiento donde "sin día" (Infinity) va al final. Explícito
// porque `Infinity - Infinity` es NaN y el sort lo trataría como 0 por accidente.
export function compararDia(a: number, b: number): number {
  if (a === b) return 0;
  if (a === Infinity) return 1;
  if (b === Infinity) return -1;
  return a - b;
}

// Dentro del rubro: pendientes (vencidos primero, después por día), pagados, omitidos
const ordenFila = (f: FilaGasto) => (f.item.omitido ? 2 : f.pendiente ? 0 : 1);

export function ordenarFilas(filas: FilaGasto[]): FilaGasto[] {
  return [...filas].sort((a, b) => {
    const oa = ordenFila(a), ob = ordenFila(b);
    if (oa !== ob) return oa - ob;
    if (oa === 0) {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      return compararDia(diaDe(a), diaDe(b));
    }
    return 0;
  });
}

// Entre rubros: con vencidos → con pendientes → todo pagado; dentro de cada
// bloque por el menor día de vencimiento (sin día al final del bloque)
const bloqueRubro = (r: Rubro) => (r.vencidas > 0 ? 0 : r.pendientes > 0 ? 1 : 2);

// Tilde de rubro: lote mínimo, solo las filas que cambian de estado. Al tildar
// van las pendientes (no omitidas); al destildar, las pagadas. Nunca las que ya
// están en el estado destino ni las omitidas.
export function filasQueCambian(rubro: Rubro, estado: GastoEstado): FilaGasto[] {
  return rubro.filas.filter((f) => (estado === 'pagado' ? f.pendiente : f.item.estado === 'pagado' && !f.item.omitido));
}

export function agruparPorRubro(mes: GastosMes, periodo: string): Rubro[] {
  const filas: FilaGasto[] = [
    ...mes.recurrentes.map((item) => {
      const pendiente = item.estado !== 'pagado' && !item.omitido;
      return { item, esFijo: true, pendiente, vencido: pendiente && estaVencido(periodo, item.dia_vencimiento) };
    }),
    ...mes.unicos.map((item) => ({
      item, esFijo: false, pendiente: item.estado !== 'pagado' && !item.omitido, vencido: false,
    })),
  ];

  const porId = new Map<string, Rubro>();
  for (const f of filas) {
    const cat = f.item.categoria;
    let rubro = porId.get(cat.id);
    if (!rubro) {
      rubro = { id: cat.id, nombre: cat.nombre, color: cat.color, filas: [], subtotal: 0, contables: 0, pagadas: 0, pendientes: 0, vencidas: 0, minDiaPendiente: Infinity, minDiaVencida: Infinity };
      porId.set(cat.id, rubro);
    }
    rubro.filas.push(f);
    if (!f.item.omitido) {
      rubro.contables += 1;
      rubro.subtotal += f.item.monto;
      if (f.item.estado === 'pagado') rubro.pagadas += 1;
    }
    if (f.pendiente) {
      rubro.pendientes += 1;
      rubro.minDiaPendiente = Math.min(rubro.minDiaPendiente, diaDe(f));
    }
    if (f.vencido) {
      rubro.vencidas += 1;
      rubro.minDiaVencida = Math.min(rubro.minDiaVencida, diaDe(f));
    }
  }

  return [...porId.values()]
    .map((r) => ({ ...r, filas: ordenarFilas(r.filas) }))
    .sort((a, b) => {
      const ba = bloqueRubro(a), bb = bloqueRubro(b);
      if (ba !== bb) return ba - bb;
      if (ba === 0) return compararDia(a.minDiaVencida, b.minDiaVencida);
      if (ba === 1) return compararDia(a.minDiaPendiente, b.minDiaPendiente);
      return 0;
    });
}

// ------------------------------------------------------------ Celda editable

interface CeldaEditableProps {
  valor: string;
  tipo: 'text' | 'number';
  editable: boolean;
  // Si es true, salir del input sin Enter descarta el cambio. Lo usa el monto
  // de un fijo: solo Enter abre la línea de alcance, así el blur no la pisa.
  blurCancela?: boolean;
  onGuardar: (valor: string) => void;
  // Nombre accesible del input mientras se edita ("Editar monto de Luz")
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  title?: string;
  children: React.ReactNode;
}

// Doble clic → input en el lugar. Enter guarda, Escape cancela; el blur guarda
// salvo que `blurCancela` diga lo contrario. Si el valor no cambió no se guarda nada.
const CeldaEditable: React.FC<CeldaEditableProps> = ({ valor, tipo, editable, blurCancela = false, onGuardar, ariaLabel, className = '', inputClassName = '', title, children }) => {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valor);
  // Una vez cerrado (Enter/Escape), el blur que dispara el desmontaje del input
  // no tiene que volver a guardar ni cancelar
  const cerrado = useRef(false);

  const empezar = () => {
    if (!editable) return;
    setBorrador(valor);
    cerrado.current = false;
    setEditando(true);
  };

  const confirmar = () => {
    if (cerrado.current) return;
    cerrado.current = true;
    setEditando(false);
    const nuevo = borrador.trim();
    const igual = tipo === 'number' ? Number(nuevo) === Number(valor) : nuevo === valor;
    if (nuevo === '' || igual) return;
    onGuardar(nuevo);
  };

  const cancelar = () => {
    if (cerrado.current) return;
    cerrado.current = true;
    setEditando(false);
  };

  if (editando) {
    return (
      <input
        autoFocus
        type={tipo}
        step={tipo === 'number' ? '0.01' : undefined}
        min={tipo === 'number' ? 0 : undefined}
        inputMode={tipo === 'number' ? 'decimal' : undefined}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={blurCancela ? cancelar : confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
          if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
        }}
        className={`w-full text-sm border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <span
      onDoubleClick={empezar}
      className={`${editable ? 'cursor-text' : ''} ${className}`}
      title={title ?? (editable ? 'Doble clic para editar' : undefined)}
    >
      {children}
    </span>
  );
};

// ------------------------------------------------------------------- Rubro

const CheckboxRubro: React.FC<{ rubro: Rubro; disabled: boolean; onChange: (estado: GastoEstado) => void }> = ({ rubro, disabled, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);
  const todas = rubro.contables > 0 && rubro.pagadas === rubro.contables;
  const algunas = rubro.pagadas > 0 && rubro.pagadas < rubro.contables;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = algunas;
  }, [algunas]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={todas}
      disabled={disabled || rubro.contables === 0}
      onChange={() => onChange(todas ? 'pendiente' : 'pagado')}
      className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
      aria-label={`Marcar todo ${rubro.nombre} como ${todas ? 'pendiente' : 'pagado'}`}
      data-testid="rubro-checkbox"
    />
  );
};

const badgeBase = 'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none shrink-0';

// ------------------------------------------------------------------ Tabla

export const GastosTablaMes: React.FC<GastosTablaMesProps> = ({
  mes, detalle, periodo, categorias, categoriasCargando = false, isLoading, panelAbierto, onTogglePanel, onAbrirPanel,
  preset, presetNonce, onEditar, onEliminarUnico, onCambio,
}) => {
  const [ocupado, setOcupado] = useState(false);
  const [alcancePendiente, setAlcancePendiente] = useState<{ item: GastoMesItem; monto: number } | null>(null);
  const [comisionesAbierto, setComisionesAbierto] = useState(false);

  // Al cambiar de mes se descarta cualquier cambio de monto a medio decidir
  useEffect(() => { setAlcancePendiente(null); }, [periodo]);

  const conError = (error: any, fallback: string) => toastService.error(error?.response?.data?.message || fallback);

  const marcar = async (estado: GastoEstado, candidatas: FilaGasto[]) => {
    // Las omitidas no se pagan este mes: quedan afuera aunque el checkbox
    // deshabilitado reciba un click (jsdom, extensiones, teclado)
    const filas = candidatas.filter((f) => !f.item.omitido);
    if (ocupado || filas.length === 0) return;
    setOcupado(true);
    try {
      await gastosService.marcarPagados(periodo, estado, filas.map((f) => itemPagado(f.item)));
      onCambio();
    } catch (error) {
      conError(error, 'No se pudo cambiar el estado');
    } finally {
      setOcupado(false);
    }
  };

  // La edición inline comparte el flag `ocupado` con la tilde: mientras hay una
  // llamada en vuelo no se dispara otra, así dos guardados no se pisan.
  const guardarNombre = async (f: FilaGasto, nombre: string) => {
    if (ocupado) return toastService.error('Esperá a que termine el cambio anterior');
    setOcupado(true);
    try {
      if (f.esFijo) await gastosService.actualizarRecurrente(f.item.recurrente_id!, { nombre });
      else await gastosService.actualizarGasto(f.item.id, { nombre });
      toastService.success('Nombre actualizado');
      onCambio();
    } catch (error) {
      conError(error, 'No se pudo cambiar el nombre');
    } finally {
      setOcupado(false);
    }
  };

  const guardarMonto = async (f: FilaGasto, valor: string) => {
    const monto = Number(valor);
    if (Number.isNaN(monto) || monto < 0) return toastService.error('Ingresá un monto válido');
    if (f.esFijo) {
      // Un fijo necesita saber desde cuándo vale: se decide en la línea de abajo
      // (sin llamada al backend todavía, así que no ocupa)
      setAlcancePendiente({ item: f.item, monto });
      return;
    }
    if (ocupado) return toastService.error('Esperá a que termine el cambio anterior');
    setOcupado(true);
    try {
      await gastosService.actualizarGasto(f.item.id, { monto });
      toastService.success('Monto actualizado');
      onCambio();
    } catch (error) {
      conError(error, 'No se pudo cambiar el monto');
    } finally {
      setOcupado(false);
    }
  };

  const aplicarAlcance = async (alcance: AlcanceMontoFijo) => {
    if (!alcancePendiente || ocupado) return;
    const { item, monto } = alcancePendiente;
    setOcupado(true);
    try {
      await aplicarCambioMontoFijo(item.recurrente_id!, periodo, monto, alcance);
      toastService.success(mensajeCambioMontoFijo(item.nombre, alcance, periodo));
      setAlcancePendiente(null);
      onCambio();
    } catch (error) {
      conError(error, 'No se pudo cambiar el monto');
    } finally {
      setOcupado(false);
    }
  };

  // ------------------------------------------------------------- Render

  const titulo = `Gastos de ${nombreMes(periodo)}`;

  if (isLoading || !mes) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const rubros = agruparPorRubro(mes, periodo);
  const automaticos = mes.derivados.filter((d) => d.monto > 0);
  const vacio = mes.recurrentes.length === 0 && mes.unicos.length === 0;
  const mostrarPanel = panelAbierto || vacio;
  const alcanceDefault = alcanceMontoFijoPorDefecto(periodo);

  const renderMeta = (f: FilaGasto) => {
    const { item } = f;
    const pagado = item.estado === 'pagado';
    let texto: React.ReactNode = null;
    if (pagado && item.fecha_pago) texto = `pagado el ${formatDiaMes(item.fecha_pago)}`;
    else if (f.vencido) texto = <span className="text-red-600 font-medium">venció el {item.dia_vencimiento}</span>;
    else if (item.dia_vencimiento) texto = `vence el ${item.dia_vencimiento}`;
    else if (!f.esFijo && item.fecha) texto = formatDiaMes(item.fecha);
    if (!texto && !item.notas) return null;
    return (
      <>
        {texto}
        {item.notas && <span className="italic">{texto ? ' · ' : ''}{item.notas}</span>}
      </>
    );
  };

  const renderFila = (f: FilaGasto) => {
    const { item } = f;
    const pagado = item.estado === 'pagado';
    const distinto = f.esFijo && !item.es_virtual && item.monto_default !== undefined && item.monto !== item.monto_default;
    const meta = renderMeta(f);
    const enAlcance = alcancePendiente?.item.id === item.id;

    return (
      <React.Fragment key={item.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 ${pagado || item.omitido ? 'text-gray-400' : 'text-gray-900'}`}
          data-testid={`fila-${item.id}`}
          data-estado={item.omitido ? 'omitido' : item.estado}
        >
          <input
            type="checkbox"
            checked={pagado}
            disabled={ocupado || item.omitido}
            onChange={() => marcar(pagado ? 'pendiente' : 'pagado', [f])}
            className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-not-allowed shrink-0"
            aria-label={`${item.nombre}: ${pagado ? 'marcar pendiente' : 'marcar pagado'}`}
            data-testid="fila-checkbox"
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
              <CeldaEditable
                valor={item.nombre}
                tipo="text"
                editable={!item.omitido}
                ariaLabel={`Editar nombre de ${item.nombre}`}
                onGuardar={(v) => guardarNombre(f, v)}
                className={`text-sm truncate max-w-full ${pagado || item.omitido ? 'line-through' : 'font-medium'}`}
              >
                {item.nombre}
              </CeldaEditable>
              {f.esFijo && <span className={`${badgeBase} bg-green-50 text-green-700`}>fijo</span>}
              {distinto && !item.omitido && (
                <span className={`${badgeBase} bg-amber-50 text-amber-800`}>este mes distinto · normalmente {formatMoneda(item.monto_default!)}</span>
              )}
              {item.omitido && <span className={`${badgeBase} bg-gray-100 text-gray-600`}>este mes no se paga</span>}
            </div>
            {meta && <div className="sm:hidden text-xs text-gray-500 truncate">{meta}</div>}
          </div>

          <div className="hidden sm:block w-36 shrink-0 text-xs text-gray-500 truncate">{meta}</div>

          <CeldaEditable
            valor={String(item.monto)}
            tipo="number"
            editable={!item.omitido}
            blurCancela={f.esFijo}
            ariaLabel={`Editar monto de ${item.nombre}`}
            onGuardar={(v) => guardarMonto(f, v)}
            className={`text-sm tabular-nums text-right min-w-[5.5rem] shrink-0 ${item.omitido ? 'line-through' : pagado ? '' : 'font-semibold'}`}
            inputClassName="max-w-[7rem] text-right"
          >
            {formatMoneda(item.monto)}
          </CeldaEditable>

          <div className="flex items-center justify-end w-12 shrink-0">
            <button
              type="button"
              onClick={() => onEditar(item, f.esFijo)}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label={`Editar ${item.nombre}`}
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            {!f.esFijo && (
              <button
                type="button"
                onClick={() => onEliminarUnico(item)}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                aria-label={`Eliminar ${item.nombre}`}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {enAlcance && alcancePendiente && (
          <div className="px-3 pb-2 pl-9 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-blue-900 bg-blue-50/70" data-testid="alcance-monto">
            <span className="font-medium tabular-nums">{formatMoneda(alcancePendiente.monto)} para {nombreMes(periodo)}:</span>
            {ALCANCES_MONTO_FIJO.map((a) => (
              <button
                key={a.value}
                type="button"
                disabled={ocupado}
                onClick={() => aplicarAlcance(a.value)}
                className={`rounded border px-2 py-0.5 transition-colors ${a.value === alcanceDefault
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border-blue-300 text-blue-800 hover:bg-blue-100'}`}
              >
                {a.label}
              </button>
            ))}
            <span className="text-blue-300">·</span>
            <button type="button" onClick={() => setAlcancePendiente(null)} className="text-blue-700 hover:underline">cancelar</button>
          </div>
        )}
      </React.Fragment>
    );
  };

  const renderRubro = (r: Rubro) => (
    <div key={r.id} className="border-t border-gray-100" data-testid={`rubro-${r.id}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80">
        <CheckboxRubro rubro={r} disabled={ocupado} onChange={(estado) => marcar(estado, filasQueCambian(r, estado))} />
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
        <span className="text-sm font-semibold text-gray-800 truncate">{r.nombre}</span>
        <span className={`text-xs ${r.vencidas > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          · {r.pagadas}/{r.contables} pagados
        </span>
      </div>
      <div className="divide-y divide-gray-50">{r.filas.map(renderFila)}</div>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 text-xs text-gray-600" data-testid="subtotal">
        <span className="pl-6">Subtotal</span>
        <span className="tabular-nums font-medium mr-14">{formatMoneda(r.subtotal)}</span>
      </div>
    </div>
  );

  const renderAutomatico = (d: GastoDerivado) => {
    const esComisiones = d.clave === 'comisiones';
    const hijos = esComisiones ? (detalle?.comisiones ?? []) : [];
    const metaTexto = esComisiones
      ? 'se calcula solo'
      : `se calcula solo${detalle ? ` · ${detalle.mercaderia_unidades} ${detalle.mercaderia_unidades === 1 ? 'unidad' : 'unidades'}` : ''}`;
    return (
      <div key={d.clave} className="border-t border-gray-100" data-testid={`rubro-auto-${d.clave}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80">
          <span role="img" aria-label="Se calcula solo" className="shrink-0 flex">
            <Lock size={14} className="text-gray-400" aria-hidden="true" />
          </span>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-800">{d.nombre}</span>
            <div className="sm:hidden text-xs text-gray-500">{metaTexto}</div>
          </div>
          <span className="hidden sm:block w-36 shrink-0 text-xs text-gray-500 truncate">{metaTexto}</span>
          <span className="text-sm font-semibold tabular-nums text-right min-w-[5.5rem] shrink-0 text-gray-900">{formatMoneda(d.monto)}</span>
          <span className="w-12 shrink-0" aria-hidden="true" />
        </div>
        {esComisiones && hijos.length > 0 && (
          <>
            <div className="px-3 py-1">
              <button
                type="button"
                onClick={() => setComisionesAbierto((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline pl-6"
                aria-expanded={comisionesAbierto}
              >
                {comisionesAbierto ? <>ocultar <ChevronUp size={12} /></> : <>ver por profesional <ChevronDown size={12} /></>}
              </button>
            </div>
            {comisionesAbierto && (
              <div className="divide-y divide-gray-50" data-testid="comisiones-profesionales">
                {hijos.map((c) => (
                  <div key={c.profesional_id} className="flex items-center gap-2 px-3 py-1.5 pl-9 text-sm">
                    <Avatar src={c.avatar_url ?? undefined} name={c.nombre} size="sm" className="!w-6 !h-6 !text-[10px]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-800 truncate">{c.nombre}</span>
                      <span className="text-xs text-gray-500"> · {c.turnos_cobrados} {c.turnos_cobrados === 1 ? 'turno' : 'turnos'}{c.productos > 0 && ` · ${formatMoneda(c.productos)} por productos`}</span>
                    </div>
                    <span className="tabular-nums text-gray-800 min-w-[5.5rem] text-right">{formatMoneda(c.total)}</span>
                    <span className="w-12 shrink-0" aria-hidden="true" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-tabla-mes">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900 truncate">{titulo}</h2>
        {!vacio && (
          <Button
            size="sm"
            variant={mostrarPanel ? 'secondary' : 'primary'}
            leftIcon={mostrarPanel ? X : Plus}
            onClick={onTogglePanel}
            aria-expanded={mostrarPanel}
          >
            {mostrarPanel ? 'Cerrar' : 'Nuevo gasto'}
          </Button>
        )}
      </div>

      {(vacio || mostrarPanel) && (
        <div className="px-3 sm:px-4 pb-3 space-y-3">
          {vacio && <ArranqueGuiado onElegir={(s) => onAbrirPanel(s ? { repite: true, nombre: s.nombre, categoria: s.categoria, dia: s.dia, foco: 'monto' } : { foco: 'nombre' })} />}
          <GastoFormInline
            abierto={mostrarPanel}
            periodo={periodo}
            categorias={categorias}
            categoriasCargando={categoriasCargando}
            preset={preset}
            presetNonce={presetNonce}
            // En un mes vacío el panel está abierto por `vacio`, no por el padre.
            // Al guardar el primero, `vacio` pasa a false: se le pide al padre
            // que lo deje abierto (sin preset) para seguir cargando (spec 3.4).
            onGuardado={() => { if (vacio) onAbrirPanel(); onCambio(); }}
          />
        </div>
      )}

      {!vacio && rubros.map(renderRubro)}
      {automaticos.map(renderAutomatico)}

      {(!vacio || automaticos.length > 0) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t-2 border-gray-200 bg-gray-50" data-testid="total-mes">
          <span className="text-sm font-semibold text-gray-900 pl-6">Total del mes</span>
          <span className="text-sm font-bold tabular-nums text-gray-900 mr-14">{formatMoneda(mes.totales.total)}</span>
        </div>
      )}

      {!vacio && (
        <p className="px-3 sm:px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          Tip: doble clic en un nombre o un monto para editarlo ahí mismo.
        </p>
      )}
    </section>
  );
};
