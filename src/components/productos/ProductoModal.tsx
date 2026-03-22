import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '../ui';
import { productosService } from '../../services/productos.service';
import { Producto, CreateProductoData } from '../../types/producto.types';
import { useToast } from '../../hooks/useToast';

interface ProductoModalProps {
  producto?: Producto | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ProductoModal: React.FC<ProductoModalProps> = ({ producto, onClose, onSaved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    precio: producto?.precio?.toString() || '0',
    stock: producto?.stock?.toString() || '0',
  });

  const isEditing = !!producto;

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
        });
        toast.success('Producto actualizado');
      } else {
        await productosService.createProducto({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          precio: parseFloat(form.precio),
          stock: parseInt(form.stock),
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
