import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '../ui';
import { productosService } from '../../services/productos.service';
import { marcasService } from '../../services/marcas.service';
import { Producto, ConfiguracionProductos } from '../../types/producto.types';
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
  const [config, setConfig] = useState<ConfiguracionProductos | null>(null);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [creandoMarca, setCreandoMarca] = useState(false);
  const [mostrarNuevaMarca, setMostrarNuevaMarca] = useState(false);
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    // Solo se muestra el precio si es un override manual; vacío = automático según config
    precio_efectivo: producto?.precio_efectivo_manual ? String(producto.precio_efectivo ?? '') : '',
    precio_transferencia: producto?.precio_transferencia_manual ? String(producto.precio_transferencia ?? '') : '',
    precio_tarjeta: producto?.precio_tarjeta_manual ? String(producto.precio_tarjeta ?? '') : '',
    costo: producto?.costo?.toString() || '',
    stock: producto?.stock?.toString() || '0',
    marca_id: producto?.marca_id || '',
    duracion_estimada_dias: producto?.duracion_estimada_dias?.toString() || '',
  });
  const [tags, setTags] = useState<string[]>(producto?.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  const isEditing = !!producto;

  const agregarTag = () => {
    const nuevo = tagInput.trim().toLowerCase();
    if (nuevo && !tags.includes(nuevo)) setTags(prev => [...prev, nuevo]);
    setTagInput('');
  };

  useEffect(() => {
    marcasService.getMarcas().then(setMarcas).catch(() => {});
    productosService.getConfiguracion().then(setConfig).catch(() => {});
  }, []);

  // Precio derivado de la config para mostrar como placeholder mientras el campo está vacío
  const precioDerivado = (pct?: number): string => {
    const costo = parseFloat(form.costo);
    if (Number.isNaN(costo) || pct == null) return 'Automático';
    const precio = Math.round(costo * (1 + pct / 100) * 100) / 100;
    return `Auto: $${precio.toLocaleString('es-AR')}`;
  };

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
    if (form.costo === '' || Number.isNaN(parseFloat(form.costo))) {
      toast.error('El costo es requerido');
      return;
    }
    // Campo vacío = precio automático según la configuración general
    const precios = {
      precio_efectivo: form.precio_efectivo !== '' ? parseFloat(form.precio_efectivo) : null,
      precio_transferencia: form.precio_transferencia !== '' ? parseFloat(form.precio_transferencia) : null,
      precio_tarjeta: form.precio_tarjeta !== '' ? parseFloat(form.precio_tarjeta) : null,
    };
    const campanias = {
      tags,
      duracion_estimada_dias: form.duracion_estimada_dias !== '' ? parseInt(form.duracion_estimada_dias) : null,
    };
    setLoading(true);
    try {
      if (isEditing) {
        await productosService.updateProducto(producto!.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          ...precios,
          costo: parseFloat(form.costo),
          stock: parseInt(form.stock),
          marca_id: form.marca_id || null,
          ...campanias,
        });
        toast.success('Producto actualizado');
      } else {
        await productosService.createProducto({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          ...precios,
          costo: parseFloat(form.costo),
          stock: parseInt(form.stock),
          marca_id: form.marca_id || null,
          ...campanias,
        });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo ($) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.costo}
                onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEditing ? 'Stock actual' : 'Stock inicial'}
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_efectivo}
                  onChange={e => setForm(f => ({ ...f, precio_efectivo: e.target.value }))}
                  placeholder={precioDerivado(config?.pct_efectivo)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transferencia ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_transferencia}
                  onChange={e => setForm(f => ({ ...f, precio_transferencia: e.target.value }))}
                  placeholder={precioDerivado(config?.pct_transferencia)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarjeta ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_tarjeta}
                  onChange={e => setForm(f => ({ ...f, precio_tarjeta: e.target.value }))}
                  placeholder={precioDerivado(config?.pct_tarjeta)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Vacío = precio automático según la configuración general. Cargá un valor solo para pisar el cálculo.
            </p>
          </div>

          {/* Campañas de WhatsApp */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Campañas de WhatsApp</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                      className="text-blue-400 hover:text-blue-700"
                      aria-label={`Quitar ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregarTag(); }
                  }}
                  placeholder="Ej: tratamiento (Enter para agregar)"
                />
                <Button type="button" variant="outline" onClick={agregarTag} disabled={!tagInput.trim()} className="shrink-0">
                  Agregar
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Sirven para el mensaje de seguimiento post-compra (se configura por tag en Campañas).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración estimada (días)</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.duracion_estimada_dias}
                onChange={e => setForm(f => ({ ...f, duracion_estimada_dias: e.target.value }))}
                placeholder="Ej: 60"
              />
              <p className="text-xs text-gray-400 mt-1">
                Cuánto le dura al cliente. Se usa para avisarle cuando se le está por acabar. Vacío = sin aviso.
              </p>
            </div>
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
