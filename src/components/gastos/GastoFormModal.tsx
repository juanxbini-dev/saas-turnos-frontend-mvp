import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo } from './gastos.utils';
import {
  METODOS_PAGO_GASTO,
  type GastoCategoria,
  type GastoEstado,
  type GastoMesItem,
  type GastoMetodoPago,
} from '../../types/gastos.types';

interface GastoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardado: () => void;
  periodo: string;
  categorias: GastoCategoria[];
  // Si viene, es edición de un gasto único; si no, alta
  gasto?: GastoMesItem | null;
}

interface FormState {
  nombre: string;
  categoria_id: string;
  monto: string;
  fecha: string;
  estado: GastoEstado;
  metodo_pago: GastoMetodoPago | '';
  fecha_pago: string;
  descripcion: string;
  notas: string;
}

const vacio = (periodo: string, categorias: GastoCategoria[]): FormState => ({
  nombre: '',
  categoria_id: categorias.find((c) => c.activa)?.id ?? '',
  monto: '',
  fecha: '',
  estado: 'pendiente',
  metodo_pago: '',
  fecha_pago: '',
  descripcion: '',
  notas: '',
});

const desdeGasto = (gasto: GastoMesItem): FormState => ({
  nombre: gasto.nombre,
  categoria_id: gasto.categoria.id,
  monto: String(gasto.monto),
  fecha: gasto.fecha ?? '',
  estado: gasto.estado,
  metodo_pago: gasto.metodo_pago ?? '',
  fecha_pago: gasto.fecha_pago ?? '',
  descripcion: gasto.descripcion ?? '',
  notas: gasto.notas ?? '',
});

// Alta y edición de un gasto único de un mes.
export function GastoFormModal({ isOpen, onClose, onGuardado, periodo, categorias, gasto }: GastoFormModalProps) {
  const [form, setForm] = useState<FormState>(() => vacio(periodo, categorias));
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [guardando, setGuardando] = useState(false);

  const esEdicion = !!gasto;

  useEffect(() => {
    if (!isOpen) return;
    setForm(gasto ? desdeGasto(gasto) : vacio(periodo, categorias));
    setErrores({});
  }, [isOpen, gasto, periodo, categorias]);

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const validar = (): boolean => {
    const nuevos: typeof errores = {};
    if (!form.nombre.trim()) nuevos.nombre = 'Poné un nombre';
    if (!form.categoria_id) nuevos.categoria_id = 'Elegí una categoría';
    const monto = Number(form.monto);
    if (form.monto === '' || Number.isNaN(monto)) nuevos.monto = 'Ingresá el monto';
    else if (monto < 0) nuevos.monto = 'El monto no puede ser negativo';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar() || guardando) return;

    setGuardando(true);
    try {
      const payload = {
        periodo,
        categoria_id: form.categoria_id,
        nombre: form.nombre.trim(),
        monto: Number(form.monto),
        fecha: form.fecha || null,
        estado: form.estado,
        metodo_pago: form.metodo_pago || null,
        fecha_pago: form.estado === 'pagado' ? (form.fecha_pago || null) : null,
        descripcion: form.descripcion.trim() || null,
        notas: form.notas.trim() || null,
      };

      if (esEdicion) {
        await gastosService.actualizarGasto(gasto!.id, payload);
        toastService.success('Gasto actualizado');
      } else {
        await gastosService.crearGasto(payload);
        toastService.success('Gasto agregado');
      }
      onGuardado();
      onClose();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo guardar el gasto');
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCategoria = categorias
    .filter((c) => c.activa || c.id === form.categoria_id)
    .map((c) => ({ value: c.id, label: c.nombre }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={esEdicion ? 'Editar gasto' : `Nuevo gasto · ${etiquetaPeriodo(periodo)}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="gasto-form" loading={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Agregar gasto'}
          </Button>
        </div>
      }
    >
      <form id="gasto-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          error={errores.nombre}
          placeholder="Arreglo del aire acondicionado"
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
            label="Monto"
            type="number"
            min={0}
            step="0.01"
            prefix="$"
            value={form.monto}
            onChange={(e) => set('monto', e.target.value)}
            error={errores.monto}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Fecha del gasto"
            type="date"
            value={form.fecha}
            onChange={(e) => set('fecha', e.target.value)}
            help="Opcional: el gasto se imputa al mes igual"
          />
          <Select
            label="Estado"
            value={form.estado}
            onChange={(e) => set('estado', e.target.value as GastoEstado)}
            options={[
              { value: 'pendiente', label: 'Pendiente de pago' },
              { value: 'pagado', label: 'Pagado' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Método de pago"
            value={form.metodo_pago}
            onChange={(e) => set('metodo_pago', e.target.value as GastoMetodoPago | '')}
            options={[{ value: '', label: 'Sin especificar' }, ...METODOS_PAGO_GASTO]}
          />
          {form.estado === 'pagado' && (
            <Input
              label="Fecha de pago"
              type="date"
              value={form.fecha_pago}
              onChange={(e) => set('fecha_pago', e.target.value)}
            />
          )}
        </div>

        <Textarea
          label="Notas"
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
          rows={2}
          placeholder="Detalle, proveedor, número de factura…"
        />
      </form>
    </Modal>
  );
}
