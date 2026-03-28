import React, { useState } from 'react';
import { Tag } from 'lucide-react';
import { Button, Input } from '../ui';
import { marcasService } from '../../services/marcas.service';
import { MarcaConProductos } from '../../types/marca.types';
import { useToast } from '../../hooks/useToast';

interface MarcaModalProps {
  marca?: MarcaConProductos | null;
  onClose: () => void;
  onSaved: () => void;
}

export const MarcaModal: React.FC<MarcaModalProps> = ({ marca, onClose, onSaved }) => {
  const toast = useToast();
  const [nombre, setNombre] = useState(marca?.nombre || '');
  const [loading, setLoading] = useState(false);

  const isEditing = !!marca;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true);
    try {
      if (isEditing) {
        await marcasService.updateMarca(marca!.id, { nombre: nombre.trim() });
        toast.success('Marca actualizada');
      } else {
        await marcasService.createMarca({ nombre: nombre.trim() });
        toast.success('Marca creada');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar la marca');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Editar marca' : 'Nueva marca'}
            </h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la marca"
              autoFocus
              required
            />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !nombre.trim()}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear marca'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
