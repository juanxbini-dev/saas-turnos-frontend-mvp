import React, { useState } from 'react';
import { Button, Input } from '../ui';
import { productosService } from '../../services/productos.service';
import { Producto } from '../../types/producto.types';
import { useToast } from '../../hooks/useToast';
import { Package } from 'lucide-react';

interface AgregarStockModalProps {
  producto: Producto;
  onClose: () => void;
  onSaved: () => void;
}

export const AgregarStockModal: React.FC<AgregarStockModalProps> = ({ producto, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [cantidad, setCantidad] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(cantidad);
    if (!n || n <= 0) {
      showToast('Ingresá una cantidad válida', 'error');
      return;
    }
    setLoading(true);
    try {
      await productosService.addStock(producto.id, n);
      showToast(`Stock actualizado: +${n} unidades`, 'success');
      onSaved();
      onClose();
    } catch {
      showToast('Error al agregar stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Agregar stock</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">{producto.nombre}</p>
          <p className="text-sm text-gray-400">Stock actual: <span className="font-medium text-gray-700">{producto.stock}</span></p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a agregar</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 10"
              autoFocus
              required
            />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
