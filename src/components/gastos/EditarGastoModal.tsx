import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo, formatMoneda } from './gastos.utils';
import { useCambioMontoFijo, type AlcanceMontoFijo } from '../../hooks/useCambioMontoFijo';
import { METODOS_PAGO_GASTO, type GastoCategoria, type GastoMesItem, type GastoMetodoPago, type OverrideRecurrenteInput } from '../../types/gastos.types';

interface EditarGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardado: () => void;
  periodo: string;
  categorias: GastoCategoria[];
  item: GastoMesItem | null;
  esRecurrente: boolean;
}

// Para un fijo, "¿desde cuándo vale el monto nuevo?" decide qué se toca. La
// regla y las llamadas viven en useCambioMontoFijo (compartido con la tabla).
export function EditarGastoModal({ isOpen, onClose, onGuardado, periodo, categorias, item, esRecurrente }: EditarGastoModalProps) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const { alcance, setAlcance, reset: resetAlcance, aplicar: aplicarCambioMonto, mensajeExito } = useCambioMontoFijo(periodo);
  const [pagado, setPagado] = useState(false);
  const [metodo, setMetodo] = useState<GastoMetodoPago | ''>('');
  const [noAplica, setNoAplica] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setNombre(item.nombre);
    setMonto(String(item.monto));
    resetAlcance();
    setPagado(item.estado === 'pagado');
    setMetodo(item.metodo_pago ?? '');
    setNoAplica(item.omitido);
    setCategoriaId(item.categoria.id);
    setNotas(item.notas ?? '');
    setError('');
  }, [isOpen, item, resetAlcance]);

  if (!item) return null;

  const montoNum = Number(monto);
  const montoNormal = item.monto_default ?? item.monto;
  const montoCambio = esRecurrente && !Number.isNaN(montoNum) && montoNum !== montoNormal;
  const tieneOverride = esRecurrente && !item.es_virtual;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError('El nombre no puede quedar vacío');
    if (monto === '' || Number.isNaN(montoNum) || montoNum < 0) return setError('Ingresá un monto válido');
    setError('');
    setGuardando(true);
    try {
      if (!esRecurrente) {
        await gastosService.actualizarGasto(item.id, {
          nombre: nombre.trim(), monto: montoNum, categoria_id: categoriaId,
          estado: pagado ? 'pagado' : 'pendiente', metodo_pago: metodo || null, notas: notas.trim() || null,
        });
        toastService.success('Gasto actualizado');
      } else {
        const recId = item.recurrente_id!;
        if (nombre.trim() !== item.nombre) {
          await gastosService.actualizarRecurrente(recId, { nombre: nombre.trim() });
        }
        // Estado, método, notas y "no aplica" son siempre de este mes. Si además
        // cambió el monto, el hook decide qué tocar según el alcance y guarda
        // estos campos en la misma pasada (con "desde este mes" el fijo vigente
        // pasa a ser uno nuevo, y el override tiene que ir a ese).
        const esteMes: OverrideRecurrenteInput = {
          estado: pagado ? 'pagado' : 'pendiente',
          metodo_pago: metodo || null,
          omitido: noAplica,
          notas: notas.trim() || null,
        };
        if (montoCambio) {
          await aplicarCambioMonto(recId, montoNum, esteMes);
          toastService.success(mensajeExito(nombre.trim()));
        } else {
          await gastosService.guardarOverride(recId, periodo, esteMes);
          toastService.success(`${nombre.trim()} actualizado`);
        }
      }
      onGuardado();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const volverAlNormal = async () => {
    if (!tieneOverride || guardando) return;
    setGuardando(true);
    try {
      await gastosService.eliminarGasto(item.id);
      toastService.success(`${item.nombre} volvió a ${formatMoneda(montoNormal)} este mes`);
      onGuardado();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo deshacer');
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCategoria = categorias.filter((c) => c.activa || c.id === categoriaId).map((c) => ({ value: c.id, label: c.nombre }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={esRecurrente ? `${item.nombre} · ${etiquetaPeriodo(periodo)}` : 'Editar gasto'}
      size="sm"
      footer={
        <div className="flex justify-between items-center gap-2">
          {tieneOverride && !noAplica ? (
            <button type="button" onClick={volverAlNormal} className="text-xs text-blue-600 hover:underline" disabled={guardando}>
              Deshacer cambios de este mes
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" form="editar-gasto-form" loading={guardando}>Guardar</Button>
          </div>
        </div>
      }
    >
      <form id="editar-gasto-form" onSubmit={guardar} className="space-y-4">
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={noAplica} />

        <Input
          label={esRecurrente ? 'Monto' : '¿Cuánto?'}
          type="number" min={0} step="0.01" prefix="$"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          disabled={noAplica}
          help={esRecurrente && montoCambio ? `Normalmente ${formatMoneda(montoNormal)}` : undefined}
        />

        {montoCambio && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm text-blue-900">
              {alcance === 'desde_este_mes' && <>Se toma como <strong>aumento</strong>: {formatMoneda(montoNum)} desde {etiquetaPeriodo(periodo).toLowerCase()} en adelante. Los meses anteriores quedan en {formatMoneda(montoNormal)}.</>}
              {alcance === 'solo_este_mes' && <>Vale <strong>solo para {etiquetaPeriodo(periodo).toLowerCase()}</strong>. Los demás meses siguen en {formatMoneda(montoNormal)}.</>}
              {alcance === 'siempre' && <>Se <strong>corrige en todos los meses</strong> que no hayas editado a mano.</>}
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(['desde_este_mes', 'solo_este_mes', 'siempre'] as AlcanceMontoFijo[]).filter((a) => a !== alcance).map((a) => (
                <button key={a} type="button" onClick={() => setAlcance(a)} className="text-blue-700 underline-offset-2 hover:underline">
                  {a === 'desde_este_mes' ? 'es un aumento desde este mes' : a === 'solo_este_mes' ? 'es solo por este mes' : 'siempre fue así, corregir todos'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer border border-gray-200 rounded-lg px-3 py-2">
            <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} disabled={noAplica} />
            Ya está pagado
          </label>
          <Select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as GastoMetodoPago | '')}
            options={[{ value: '', label: '¿Cómo se pagó?' }, ...METODOS_PAGO_GASTO]}
            disabled={noAplica}
          />
        </div>

        {esRecurrente && (
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={noAplica} onChange={(e) => setNoAplica(e.target.checked)} className="mt-0.5" />
            <span>Este mes <strong>no se paga</strong> (bonificado, suspendido…). No suma al total.</span>
          </label>
        )}

        <details className="text-sm">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-800">Más opciones</summary>
          <div className="mt-3 space-y-3">
            {!esRecurrente && (
              <Select label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} options={opcionesCategoria} />
            )}
            <Textarea label="Nota" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Proveedor, factura, por qué cambió…" />
          </div>
        </details>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
