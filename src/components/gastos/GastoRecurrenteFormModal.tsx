import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Input, Modal, Select } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo, sumarMeses } from './gastos.utils';
import type { GastoCategoria, GastoRecurrente } from '../../types/gastos.types';

interface GastoRecurrenteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardado: () => void;
  periodo: string;                // mes abierto en el panel: default de periodo_desde
  categorias: GastoCategoria[];
  recurrente?: GastoRecurrente | null;   // si viene es edición
}

interface FormState {
  nombre: string;
  categoria_id: string;
  monto_default: string;
  dia_vencimiento: string;
  periodo_desde: string;
  periodo_hasta: string;
  descripcion: string;
}

// Al editar el monto de una plantilla existente hay dos formas de aplicarlo
type ModoMonto = 'todos' | 'desde';

const vacio = (periodo: string, categorias: GastoCategoria[]): FormState => ({
  nombre: '',
  categoria_id: categorias.find((c) => c.activa)?.id ?? '',
  monto_default: '',
  dia_vencimiento: '',
  periodo_desde: periodo,
  periodo_hasta: '',
  descripcion: '',
});

const desdeRecurrente = (r: GastoRecurrente): FormState => ({
  nombre: r.nombre,
  categoria_id: r.categoria_id,
  monto_default: String(r.monto_default),
  dia_vencimiento: r.dia_vencimiento === null ? '' : String(r.dia_vencimiento),
  periodo_desde: r.periodo_desde,
  periodo_hasta: r.periodo_hasta ?? '',
  descripcion: r.descripcion ?? '',
});

// Alta y edición de un gasto recurrente (la plantilla, no un mes puntual).
export function GastoRecurrenteFormModal({
  isOpen, onClose, onGuardado, periodo, categorias, recurrente,
}: GastoRecurrenteFormModalProps) {
  const [form, setForm] = useState<FormState>(() => vacio(periodo, categorias));
  const [modoMonto, setModoMonto] = useState<ModoMonto>('todos');
  const [desdeCambio, setDesdeCambio] = useState(periodo);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [guardando, setGuardando] = useState(false);

  const esEdicion = !!recurrente;

  useEffect(() => {
    if (!isOpen) return;
    setForm(recurrente ? desdeRecurrente(recurrente) : vacio(periodo, categorias));
    setModoMonto('todos');
    setDesdeCambio(periodo);
    setErrores({});
  }, [isOpen, recurrente, periodo, categorias]);

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const montoCambio = esEdicion && Number(form.monto_default) !== recurrente!.monto_default;

  const validar = (): boolean => {
    const nuevos: typeof errores = {};
    if (!form.nombre.trim()) nuevos.nombre = 'Poné un nombre';
    if (!form.categoria_id) nuevos.categoria_id = 'Elegí una categoría';
    const monto = Number(form.monto_default);
    if (form.monto_default === '' || Number.isNaN(monto)) nuevos.monto_default = 'Ingresá el monto';
    else if (monto < 0) nuevos.monto_default = 'El monto no puede ser negativo';
    if (form.dia_vencimiento) {
      const dia = Number(form.dia_vencimiento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) nuevos.dia_vencimiento = 'Entre 1 y 31';
    }
    if (!/^\d{4}-\d{2}$/.test(form.periodo_desde)) nuevos.periodo_desde = 'Formato YYYY-MM';
    if (form.periodo_hasta && !/^\d{4}-\d{2}$/.test(form.periodo_hasta)) nuevos.periodo_hasta = 'Formato YYYY-MM';
    if (form.periodo_hasta && form.periodo_hasta < form.periodo_desde) nuevos.periodo_hasta = 'No puede ser anterior al inicio';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar() || guardando) return;

    setGuardando(true);
    try {
      const base = {
        categoria_id: form.categoria_id,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        dia_vencimiento: form.dia_vencimiento ? Number(form.dia_vencimiento) : null,
        periodo_desde: form.periodo_desde,
        periodo_hasta: form.periodo_hasta || null,
      };
      const monto = Number(form.monto_default);

      if (!esEdicion) {
        await gastosService.crearRecurrente({ ...base, monto_default: monto });
        toastService.success('Gasto recurrente creado');
      } else if (montoCambio && modoMonto === 'desde') {
        // Primero se guardan los demás campos en la plantilla actual, después se
        // cierra y se abre la nueva con el monto nuevo.
        await gastosService.actualizarRecurrente(recurrente!.id, base);
        await gastosService.reemplazarRecurrente(recurrente!.id, desdeCambio, monto);
        toastService.success(`Monto actualizado desde ${etiquetaPeriodo(desdeCambio)}`);
      } else {
        await gastosService.actualizarRecurrente(recurrente!.id, { ...base, monto_default: monto });
        toastService.success('Gasto recurrente actualizado');
      }
      onGuardado();
      onClose();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCategoria = categorias
    .filter((c) => c.activa || c.id === form.categoria_id)
    .map((c) => ({ value: c.id, label: c.nombre }));

  const opcionesDesde = Array.from({ length: 6 }, (_, i) => sumarMeses(periodo, i))
    .filter((p) => !esEdicion || p > recurrente!.periodo_desde);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={esEdicion ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="recurrente-form" loading={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear recurrente'}
          </Button>
        </div>
      }
    >
      <form id="recurrente-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          error={errores.nombre}
          placeholder="Alquiler, luz, internet, contadora…"
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Categoría"
            value={form.categoria_id}
            onChange={(e) => set('categoria_id', e.target.value)}
            options={opcionesCategoria}
            error={errores.categoria_id}
          />
          <Input
            label="Monto mensual"
            type="number"
            min={0}
            step="0.01"
            prefix="$"
            value={form.monto_default}
            onChange={(e) => set('monto_default', e.target.value)}
            error={errores.monto_default}
          />
        </div>

        {montoCambio && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Cambiaste el monto. ¿Desde cuándo aplica?</span>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={modoMonto === 'todos'} onChange={() => setModoMonto('todos')} className="mt-0.5" />
              <span>
                <strong>Para todos los meses sin editar</strong> — los meses que ya tocaste a mano
                quedan como están, el resto (pasados y futuros) toma el monto nuevo.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={modoMonto === 'desde'} onChange={() => setModoMonto('desde')} className="mt-0.5" />
              <span className="flex-1">
                <strong>A partir de un mes</strong> — los anteriores conservan el monto viejo.
                {modoMonto === 'desde' && (
                  <select
                    value={desdeCambio}
                    onChange={(e) => setDesdeCambio(e.target.value)}
                    className="ml-2 text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                  >
                    {opcionesDesde.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
                  </select>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Vence el día"
            type="number"
            min={1}
            max={31}
            value={form.dia_vencimiento}
            onChange={(e) => set('dia_vencimiento', e.target.value)}
            error={errores.dia_vencimiento}
            placeholder="10"
          />
          <Input
            label="Desde"
            type="month"
            value={form.periodo_desde}
            onChange={(e) => set('periodo_desde', e.target.value)}
            error={errores.periodo_desde}
          />
          <Input
            label="Hasta"
            type="month"
            value={form.periodo_hasta}
            onChange={(e) => set('periodo_hasta', e.target.value)}
            error={errores.periodo_hasta}
            help="Vacío = sin fin"
          />
        </div>

        <Input
          label="Descripción"
          value={form.descripcion}
          onChange={(e) => set('descripcion', e.target.value)}
          placeholder="Opcional"
        />
      </form>
    </Modal>
  );
}
