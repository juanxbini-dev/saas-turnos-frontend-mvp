import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo, formatMoneda } from './gastos.utils';
import {
  METODOS_PAGO_GASTO,
  type GastoEstado,
  type GastoMesItem,
  type GastoMetodoPago,
} from '../../types/gastos.types';

interface GastoOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardado: () => void;
  periodo: string;
  item: GastoMesItem | null;   // el renglón recurrente del mes (virtual o con override)
}

// Editar un recurrente SOLO en este mes. La plantilla no se toca: los otros meses
// siguen con su valor. Si el mes ya tenía override, "Restaurar" lo borra y el
// renglón vuelve a ser la proyección de la plantilla.
export function GastoOverrideModal({ isOpen, onClose, onGuardado, periodo, item }: GastoOverrideModalProps) {
  const [monto, setMonto] = useState('');
  const [estado, setEstado] = useState<GastoEstado>('pendiente');
  const [metodoPago, setMetodoPago] = useState<GastoMetodoPago | ''>('');
  const [fechaPago, setFechaPago] = useState('');
  const [omitido, setOmitido] = useState(false);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setMonto(String(item.monto));
    setEstado(item.estado);
    setMetodoPago(item.metodo_pago ?? '');
    setFechaPago(item.fecha_pago ?? '');
    setOmitido(item.omitido);
    setNotas(item.notas ?? '');
  }, [isOpen, item]);

  if (!item || !item.recurrente_id) return null;

  const montoDefault = item.monto_default ?? item.monto;
  const tieneOverride = !item.es_virtual;
  const montoNumero = Number(monto);
  const montoDistinto = !Number.isNaN(montoNumero) && montoNumero !== montoDefault;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (monto === '' || Number.isNaN(montoNumero) || montoNumero < 0) {
      toastService.error('Ingresá un monto válido');
      return;
    }

    setGuardando(true);
    try {
      await gastosService.guardarOverride(item.recurrente_id!, periodo, {
        monto: montoNumero,
        estado,
        omitido,
        metodo_pago: metodoPago || null,
        fecha_pago: estado === 'pagado' ? (fechaPago || null) : null,
        notas: notas.trim() || null,
      });
      toastService.success(`${item.nombre} actualizado para ${etiquetaPeriodo(periodo)}`);
      onGuardado();
      onClose();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleRestaurar = async () => {
    if (restaurando || !tieneOverride) return;
    setRestaurando(true);
    try {
      await gastosService.eliminarGasto(item.id);
      toastService.success(`${item.nombre} volvió al valor de la plantilla`);
      onGuardado();
      onClose();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo restaurar');
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${item.nombre} · ${etiquetaPeriodo(periodo)}`}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          {tieneOverride ? (
            <Button variant="ghost" size="sm" leftIcon={RotateCcw} onClick={handleRestaurar} loading={restaurando}>
              Restaurar plantilla ({formatMoneda(montoDefault)})
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" form="override-form" loading={guardando}>Guardar solo este mes</Button>
          </div>
        </div>
      }
    >
      <form id="override-form" onSubmit={handleGuardar} className="space-y-4">
        <p className="text-sm text-gray-600">
          Lo que cambies acá vale <strong>solo para {etiquetaPeriodo(periodo)}</strong>. Los demás meses
          siguen con el valor de la plantilla ({formatMoneda(montoDefault)}).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Monto de este mes"
            type="number"
            min={0}
            step="0.01"
            prefix="$"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            help={montoDistinto ? `Plantilla: ${formatMoneda(montoDefault)}` : undefined}
            disabled={omitido}
            autoFocus
          />
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as GastoEstado)}
            options={[
              { value: 'pendiente', label: 'Pendiente de pago' },
              { value: 'pagado', label: 'Pagado' },
            ]}
            disabled={omitido}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Método de pago"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as GastoMetodoPago | '')}
            options={[{ value: '', label: 'Sin especificar' }, ...METODOS_PAGO_GASTO]}
            disabled={omitido}
          />
          {estado === 'pagado' && !omitido && (
            <Input
              label="Fecha de pago"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          )}
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer rounded-lg border border-gray-200 p-3">
          <input type="checkbox" checked={omitido} onChange={(e) => setOmitido(e.target.checked)} className="mt-0.5" />
          <span>
            <strong>Este mes no aplica</strong> — el gasto se muestra tachado y no suma al total.
            Sirve para un servicio que este mes no se pagó (bonificado, suspendido, etc.).
          </span>
        </label>

        <Textarea
          label="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Por qué cambió este mes…"
        />
      </form>
    </Modal>
  );
}
