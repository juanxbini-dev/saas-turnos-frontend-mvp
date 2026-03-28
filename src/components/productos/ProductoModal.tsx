import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '../ui';
import { productosService } from '../../services/productos.service';
import { marcasService } from '../../services/marcas.service';
import { Producto, CreateProductoData } from '../../types/producto.types';
import { MarcaConProductos } from '../../types/marca.types';
import { useToast } from '../../hooks/useToast';

interface ProductoModalProps {
  producto?: Producto | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ProductoModal: React.FC<ProductoModalProps> = ({ producto, onClose, onSaved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [marcas, setMarcas] = useState<MarcaConProductos[]>([]);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [mostrarNuevaMarca, setMostrarNuevaMarca] = useState(false);
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    precio: producto?.precio?.toString() || '0',
    stock: producto?.stock?.toString() || '0',
    marca_id: producto?.marca_id || '',
  });

  const isEditing = !!producto;

  useEffect(() => {
    marcasService.getMarcas().then(setMarcas).catch(() => {});
  }, []);

  const handleCrearMarca = async () => {
    if (!nuevaMarca.trim()) return;
    setCreandoMarca(true);
    try {
      const marca = await marcasService.createMarca({ nombre: nuevaMarca.trim() });
      const marcaConProductos = { ...marca, total_productos: 0 };
      setMarcas(prev => [...prev, marcaConProductos].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm(f => ({ ...f, marca_id: marca.id }));
      setNuevaMarca('');
      setMostrarNuevaMarca(false);
      toast.success(`Marca "${marca.nombre}" creada`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear marca');
    } finally {
      setCreandoMarca(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await productosService.updateProducto(producto!.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          precio: parseFloat(form.precio),
          marca_id: form.marca_id || null,
        });
        toast.success('Producto actualizado');
      } else {
        await productosService.createProducto({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          precio: parseFloat(form.precio),
          stock: parseInt(form.stock),
          marca_id: form.marca_id || null,
        } as CreateProductoData);
        toast.success('Producto creado');
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar el producto';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Editar producto' : 'Nuevo producto'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre del producto"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <Textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Marca</label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setMostrarNuevaMarca(v => !v)}
              >
                {mostrarNuevaMarca ? 'Cancelar' : '+ Nueva marca'}
              </button>
            </div>
            {mostrarNuevaMarca ? (
              <div className="flex gap-2">
                <Input
                  value={nuevaMarca}
                  onChange={e => setNuevaMarca(e.target.value)}
                  placeholder="Nombre de la marca"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCrearMarca())}
                />
                <Button
                  type="button"
                  onClick={handleCrearMarca}
                  disabled={creandoMarca || !nuevaMarca.trim()}
                  className="shrink-0"
                >
                  {creandoMarca ? '...' : 'Crear'}
                </Button>
              </div>
            ) : (
              <select
                value={form.marca_id}
                onChange={e => setForm(f => ({ ...f, marca_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin marca</option>
                {marcas.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                required
              />
            </div>
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock inicial</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  required
                />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
