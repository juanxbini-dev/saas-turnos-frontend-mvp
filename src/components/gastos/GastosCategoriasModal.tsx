import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import type { GastoCategoria } from '../../types/gastos.types';

interface GastosCategoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: GastoCategoria[];
  onCambio: () => void;
}

const COLORES = [
  '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6',
  '#64748b', '#84cc16', '#f97316', '#06b6d4', '#a3a3a3', '#2563eb',
];

// Administración del catálogo de categorías. Una categoría con gastos no se
// borra: se desactiva (el backend decide), así el histórico no queda huérfano.
export function GastosCategoriasModal({ isOpen, onClose, categorias, onCambio }: GastosCategoriasModalProps) {
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoColor, setNuevoColor] = useState(COLORES[0]!);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editColor, setEditColor] = useState('');
  const [aBorrar, setABorrar] = useState<GastoCategoria | null>(null);
  const [borrando, setBorrando] = useState(false);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || creando) return;
    setCreando(true);
    try {
      await gastosService.crearCategoria({ nombre: nuevoNombre.trim(), color: nuevoColor });
      setNuevoNombre('');
      toastService.success('Categoría creada');
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo crear la categoría');
    } finally {
      setCreando(false);
    }
  };

  const empezarEdicion = (c: GastoCategoria) => {
    setEditandoId(c.id);
    setEditNombre(c.nombre);
    setEditColor(c.color);
  };

  const guardarEdicion = async () => {
    if (!editandoId || !editNombre.trim()) return;
    try {
      await gastosService.actualizarCategoria(editandoId, { nombre: editNombre.trim(), color: editColor });
      setEditandoId(null);
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo guardar');
    }
  };

  const toggleActiva = async (c: GastoCategoria) => {
    try {
      await gastosService.actualizarCategoria(c.id, { activa: !c.activa });
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo cambiar el estado');
    }
  };

  const confirmarBorrado = async () => {
    if (!aBorrar || borrando) return;
    setBorrando(true);
    try {
      const { desactivada } = await gastosService.eliminarCategoria(aBorrar.id);
      toastService.success(desactivada
        ? 'La categoría tiene gastos: quedó desactivada en lugar de borrarse'
        : 'Categoría eliminada');
      setABorrar(null);
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setBorrando(false);
    }
  };

  const Paleta = ({ valor, onChange }: { valor: string; onChange: (c: string) => void }) => (
    <div className="flex flex-wrap gap-1">
      {COLORES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border-2 ${valor === c ? 'border-gray-900' : 'border-transparent'}`}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Categorías de gastos" size="md">
        <form onSubmit={handleCrear} className="flex flex-col sm:flex-row sm:items-end gap-2 mb-4 pb-4 border-b border-gray-200">
          <div className="flex-1">
            <Input
              label="Nueva categoría"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Seguros, limpieza…"
            />
          </div>
          <div className="pb-1"><Paleta valor={nuevoColor} onChange={setNuevoColor} /></div>
          <Button type="submit" leftIcon={Plus} loading={creando} disabled={!nuevoNombre.trim()}>
            Agregar
          </Button>
        </form>

        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {categorias.map((c) => (
            <li key={c.id} className={`py-2 flex items-center gap-2 ${c.activa ? '' : 'opacity-50'}`}>
              {editandoId === c.id ? (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                  <input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarEdicion(); } if (e.key === 'Escape') setEditandoId(null); }}
                  />
                  <Paleta valor={editColor} onChange={setEditColor} />
                  <button onClick={guardarEdicion} className="p-1 text-green-600 hover:bg-green-50 rounded" aria-label="Guardar"><Check size={16} /></button>
                  <button onClick={() => setEditandoId(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" aria-label="Cancelar"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-sm text-gray-800">
                    {c.nombre}
                    {!c.activa && <span className="ml-2 text-xs text-gray-400">(desactivada)</span>}
                  </span>
                  <button onClick={() => empezarEdicion(c)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" aria-label="Editar"><Pencil size={15} /></button>
                  <button
                    onClick={() => toggleActiva(c)}
                    className="text-xs text-gray-500 hover:text-gray-800 px-1"
                    title={c.activa ? 'Desactivar' : 'Reactivar'}
                  >
                    {c.activa ? 'Desactivar' : 'Reactivar'}
                  </button>
                  <button
                    onClick={() => setABorrar(c)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    aria-label="Eliminar"
                    title={c.en_uso ? 'Tiene gastos: se va a desactivar' : 'Eliminar'}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        isOpen={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        loading={borrando}
        title={aBorrar?.en_uso ? 'Desactivar categoría' : 'Eliminar categoría'}
        message={aBorrar?.en_uso
          ? `"${aBorrar.nombre}" tiene gastos cargados, así que no se puede borrar: se va a desactivar y no va a aparecer para gastos nuevos.`
          : `¿Eliminar la categoría "${aBorrar?.nombre}"? No tiene gastos asociados.`}
        confirmText={aBorrar?.en_uso ? 'Desactivar' : 'Eliminar'}
      />
    </>
  );
}
