import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import type { GastoCategoria } from '../../types/gastos.types';

interface GastosCategoriasCardProps {
  categorias: GastoCategoria[];
  isLoading: boolean;
  onCambio: () => void;
  onAbrirModal: () => void;
}

// Alta rápida y borrado de categorías sin uso. Colores y renombres van al
// modal existente ("Colores y nombres").
export const GastosCategoriasCard: React.FC<GastosCategoriasCardProps> = ({ categorias, isLoading, onCambio, onAbrirModal }) => {
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState<GastoCategoria | null>(null);
  const [borrando, setBorrando] = useState(false);

  const activas = categorias.filter((c) => c.activa);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || creando) return;
    setCreando(true);
    try {
      await gastosService.crearCategoria({ nombre: nombre.trim() });
      setNombre('');
      toastService.success('Categoría creada');
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo crear la categoría');
    } finally {
      setCreando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!aBorrar || borrando) return;
    setBorrando(true);
    try {
      await gastosService.eliminarCategoria(aBorrar.id);
      toastService.success('Categoría eliminada');
      setABorrar(null);
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setBorrando(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="gastos-categorias-card">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Categorías</h3>
      </div>

      {isLoading ? (
        <div className="px-4 py-2 flex flex-wrap gap-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 w-20 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : (
        <ul className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {activas.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5 text-sm text-gray-800">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            {c.nombre}
            {!c.en_uso && (
              <button
                type="button"
                onClick={() => setABorrar(c)}
                className="p-0.5 rounded text-gray-300 hover:text-red-600 hover:bg-red-50"
                aria-label={`Eliminar categoría ${c.nombre}`}
                title="Eliminar (no tiene gastos)"
              >
                <X size={12} />
              </button>
            )}
          </li>
        ))}
        </ul>
      )}

      <form onSubmit={crear} className="px-4 pb-3 flex items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva categoría"
          aria-label="Nueva categoría"
          className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!nombre.trim() || creando || isLoading}
          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          aria-label="Agregar categoría"
        >
          <Plus size={16} />
        </button>
      </form>

      <div className="px-4 py-2 border-t border-gray-100">
        <button type="button" onClick={onAbrirModal} className="text-xs text-blue-600 hover:underline">
          Colores y nombres
        </button>
      </div>

      <ConfirmDialog
        isOpen={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        loading={borrando}
        title="Eliminar categoría"
        message={`¿Eliminar la categoría "${aBorrar?.nombre}"? No tiene gastos asociados.`}
        confirmText="Eliminar"
      />
    </section>
  );
};
