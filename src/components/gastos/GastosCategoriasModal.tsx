import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { filtrarPorTipo } from './gastos.utils';
import type { GastoCategoria, GastoTipo } from '../../types/gastos.types';

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

const GRUPOS: { tipo: GastoTipo; titulo: string; ayuda: string }[] = [
  { tipo: 'gasto', titulo: 'Gastos', ayuda: 'Lo que sale: alquiler, luz, impuestos…' },
  { tipo: 'ingreso', titulo: 'Ingresos', ayuda: 'Lo que entra aparte de turnos y ventas: por ejemplo, lo que te paga alguien por un sillón.' },
];

// Administración del catálogo de categorías, en dos grupos: de gastos y de
// ingresos (gastos-ingresos-plan). El tipo se elige al crearla y no se cambia
// después. Una categoría con movimientos no se borra: se desactiva (el backend
// decide), así el histórico no queda huérfano.
export function GastosCategoriasModal({ isOpen, onClose, categorias, onCambio }: GastosCategoriasModalProps) {
  const [nuevoTipo, setNuevoTipo] = useState<GastoTipo>('gasto');
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
      await gastosService.crearCategoria({ nombre: nuevoNombre.trim(), color: nuevoColor, tipo: nuevoTipo });
      setNuevoNombre('');
      toastService.success(nuevoTipo === 'ingreso' ? 'Categoría de ingresos creada' : 'Categoría de gastos creada');
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
        ? 'La categoría tiene movimientos cargados: quedó desactivada en lugar de borrarse'
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
      <Modal isOpen={isOpen} onClose={onClose} title="Categorías" size="md">
        <form onSubmit={handleCrear} className="space-y-2 mb-4 pb-4 border-b border-gray-200" data-testid="categoria-nueva-form">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Nueva categoría de…</span>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm" role="radiogroup" aria-label="Tipo de la nueva categoría">
              {GRUPOS.map((g) => (
                <button
                  key={g.tipo}
                  type="button"
                  role="radio"
                  aria-checked={nuevoTipo === g.tipo}
                  onClick={() => setNuevoTipo(g.tipo)}
                  className={`px-4 py-1.5 transition-colors ${nuevoTipo === g.tipo ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {g.titulo}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <Input
                label="Nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder={nuevoTipo === 'ingreso' ? 'Empleados, alquiler de sillón…' : 'Seguros, limpieza…'}
              />
            </div>
            <div className="pb-1"><Paleta valor={nuevoColor} onChange={setNuevoColor} /></div>
            <Button type="submit" leftIcon={Plus} loading={creando} disabled={!nuevoNombre.trim()}>
              Agregar
            </Button>
          </div>
          <p className="text-xs text-gray-500">El tipo no se puede cambiar después de crearla.</p>
        </form>

        <div className="max-h-96 overflow-y-auto space-y-4">
          {GRUPOS.map((g) => {
            const delGrupo = filtrarPorTipo(categorias, g.tipo);
            return (
              <section key={g.tipo} data-testid={`categorias-grupo-${g.tipo}`} aria-label={`Categorías de ${g.titulo.toLowerCase()}`}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{g.titulo}</h4>
                <p className="text-xs text-gray-400 mb-1">{g.ayuda}</p>
                <ul className="divide-y divide-gray-100">
                  {delGrupo.length === 0 && (
                    <li className="py-2 text-sm text-gray-500">Todavía no hay categorías de {g.titulo.toLowerCase()}.</li>
                  )}
                  {delGrupo.map((c) => (
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
                            title={c.en_uso ? 'Tiene movimientos cargados: se va a desactivar' : 'Eliminar'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        loading={borrando}
        title={aBorrar?.en_uso ? 'Desactivar categoría' : 'Eliminar categoría'}
        message={aBorrar?.en_uso
          ? `"${aBorrar.nombre}" tiene ${aBorrar.tipo === 'ingreso' ? 'ingresos' : 'gastos'} cargados, así que no se puede borrar: se va a desactivar y no va a aparecer para ${aBorrar.tipo === 'ingreso' ? 'ingresos' : 'gastos'} nuevos.`
          : `¿Eliminar la categoría "${aBorrar?.nombre}"? No tiene nada cargado.`}
        confirmText={aBorrar?.en_uso ? 'Desactivar' : 'Eliminar'}
      />
    </>
  );
}
