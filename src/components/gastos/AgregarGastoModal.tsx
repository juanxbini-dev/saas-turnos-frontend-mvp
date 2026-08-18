import { useEffect, useState } from 'react';
import { Repeat, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, Modal, Select } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo } from './gastos.utils';
import type { GastoCategoria } from '../../types/gastos.types';

interface AgregarGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardado: () => void;
  periodo: string;
  categorias: GastoCategoria[];
  // Si viene de un chip del arranque guiado: nombre y categoría ya resueltos,
  // se salta la pregunta "¿se repite?" (los chips son siempre gastos fijos)
  sugerido?: { nombre: string; categoria: string; dia?: number } | null;
}

type Tipo = 'repite' | 'unico' | null;

// Un solo camino para agregar: primero "¿se repite todos los meses?", después
// tres campos. Categoría y detalles quedan plegados: casi nunca hacen falta.
export function AgregarGastoModal({ isOpen, onClose, onGuardado, periodo, categorias, sugerido }: AgregarGastoModalProps) {
  const [tipo, setTipo] = useState<Tipo>(null);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [dia, setDia] = useState('');           // recurrente: día de vencimiento
  const [fecha, setFecha] = useState('');       // único: fecha del gasto
  const [yaPagado, setYaPagado] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [masOpciones, setMasOpciones] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const otros = categorias.find((c) => c.nombre === 'Otros' && c.activa) ?? categorias.find((c) => c.activa);

  useEffect(() => {
    if (!isOpen) return;
    setMonto(''); setFecha(''); setYaPagado(false); setMasOpciones(false); setError('');
    if (sugerido) {
      const cat = categorias.find((c) => c.nombre === sugerido.categoria && c.activa);
      setTipo('repite');
      setNombre(sugerido.nombre);
      setDia(sugerido.dia ? String(sugerido.dia) : '');
      setCategoriaId(cat?.id ?? otros?.id ?? '');
    } else {
      setTipo(null); setNombre(''); setDia(''); setCategoriaId(otros?.id ?? '');
    }
  }, [isOpen, sugerido, categorias, otros?.id]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    const montoNum = Number(monto);
    if (!nombre.trim()) return setError('Escribí qué gasto es');
    if (monto === '' || Number.isNaN(montoNum) || montoNum < 0) return setError('Ingresá cuánto');
    if (!categoriaId) return setError('No hay categorías cargadas');
    setError('');
    setGuardando(true);
    try {
      if (tipo === 'repite') {
        const diaNum = dia ? Number(dia) : null;
        if (diaNum !== null && (diaNum < 1 || diaNum > 31)) { setError('El día tiene que estar entre 1 y 31'); return; }
        await gastosService.crearRecurrente({
          categoria_id: categoriaId, nombre: nombre.trim(), monto_default: montoNum,
          dia_vencimiento: diaNum, periodo_desde: periodo,
        });
        toastService.success(`${nombre.trim()} se va a repetir todos los meses desde ${etiquetaPeriodo(periodo)}`);
      } else {
        await gastosService.crearGasto({
          periodo, categoria_id: categoriaId, nombre: nombre.trim(), monto: montoNum,
          fecha: fecha || null, estado: yaPagado ? 'pagado' : 'pendiente',
        });
        toastService.success('Gasto agregado');
      }
      onGuardado();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCategoria = categorias.filter((c) => c.activa).map((c) => ({ value: c.id, label: c.nombre }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tipo === null ? 'Agregar gasto' : tipo === 'repite' ? 'Gasto de todos los meses' : `Gasto de ${etiquetaPeriodo(periodo)}`}
      size="sm"
      footer={tipo === null ? undefined : (
        <div className="flex justify-between items-center gap-2">
          {sugerido ? <span /> : <Button variant="ghost" size="sm" onClick={() => setTipo(null)} disabled={guardando}>← Cambiar</Button>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" form="agregar-gasto-form" loading={guardando}>Guardar</Button>
          </div>
        </div>
      )}
    >
      {tipo === null ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">¿Este gasto se repite todos los meses?</p>
          <button
            onClick={() => setTipo('repite')}
            className="w-full flex items-start gap-3 text-left border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl p-4 transition-colors"
          >
            <Repeat size={22} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              <span className="block font-semibold text-gray-900">Sí, todos los meses</span>
              <span className="block text-sm text-gray-500">Alquiler, luz, internet, sueldos, contadora…</span>
            </span>
          </button>
          <button
            onClick={() => setTipo('unico')}
            className="w-full flex items-start gap-3 text-left border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 rounded-xl p-4 transition-colors"
          >
            <Zap size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              <span className="block font-semibold text-gray-900">No, solo esta vez</span>
              <span className="block text-sm text-gray-500">Un arreglo, una compra, algo puntual de {etiquetaPeriodo(periodo).toLowerCase()}</span>
            </span>
          </button>
        </div>
      ) : (
        <form id="agregar-gasto-form" onSubmit={guardar} className="space-y-4">
          <Input
            label="¿Qué gasto es?"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === 'repite' ? 'Alquiler del local' : 'Arreglo del aire acondicionado'}
            autoFocus={!sugerido}
          />
          <Input
            label={tipo === 'repite' ? '¿Cuánto por mes?' : '¿Cuánto?'}
            type="number" min={0} step="0.01" prefix="$"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus={!!sugerido}
          />
          {tipo === 'repite' ? (
            <Input
              label="¿Qué día vence? (opcional)"
              type="number" min={1} max={31}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              placeholder="10"
              help={`Empieza a contar desde ${etiquetaPeriodo(periodo)}. Después lo podés cambiar.`}
            />
          ) : (
            <>
              <Input
                label="¿Qué día fue? (opcional)"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={yaPagado} onChange={(e) => setYaPagado(e.target.checked)} />
                Ya lo pagué
              </label>
            </>
          )}

          <button
            type="button"
            onClick={() => setMasOpciones((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
          >
            {masOpciones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {masOpciones ? 'Menos opciones' : 'Más opciones (categoría)'}
          </button>
          {masOpciones && (
            <Select
              label="Categoría"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              options={opcionesCategoria}
              help="Sirve para los gráficos. Si no sabés, dejá “Otros”."
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
