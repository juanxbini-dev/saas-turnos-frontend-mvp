import React, { useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, User } from 'lucide-react';
import { Button, Input, Spinner } from '../ui';
import { Cliente, CreateClienteData } from '../../types/cliente.types';
import { Producto } from '../../types/producto.types';
import { clienteService } from '../../services/cliente.service';
import { ventasService } from '../../services/ventas.service';
import { productosService } from '../../services/productos.service';
import { useToast } from '../../hooks/useToast';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';

interface VentaItem {
  producto: Producto;
  cantidad: number;
}

interface VenderModalProps {
  vendedorId: string;
  vendedorNombre: string;
  onClose: () => void;
  onVentaCreada: () => void;
}

type MetodoPago = 'efectivo' | 'transferencia' | 'pendiente';

export const VenderModal: React.FC<VenderModalProps> = ({
  vendedorId,
  vendedorNombre,
  onClose,
  onVentaCreada,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Cliente
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [newCliente, setNewCliente] = useState({ nombre: '', email: '', telefono: '' });
  const [creatingCliente, setCreatingCliente] = useState(false);

  // Productos
  const [productoSearch, setProductoSearch] = useState('');
  const [items, setItems] = useState<VentaItem[]>([]);

  // Pago
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [notas, setNotas] = useState('');

  const { data: clientes, loading: loadingClientes } = useFetch(
    buildKey(ENTITIES.CLIENTES),
    () => clienteService.getClientes(),
    { ttl: 300 }
  );

  const { data: productos, loading: loadingProductos } = useFetch(
    'productos:lista',
    () => productosService.getProductos(),
    { ttl: 60 }
  );

  const filteredClientes = clientes?.filter(c =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clienteSearch.toLowerCase())
  ) || [];

  const filteredProductos = productos?.filter(p =>
    p.activo &&
    p.stock > 0 &&
    p.nombre.toLowerCase().includes(productoSearch.toLowerCase())
  ) || [];

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliente.nombre.trim() || !newCliente.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }
    setCreatingCliente(true);
    try {
      const created = await clienteService.createCliente(newCliente as CreateClienteData);
      setSelectedCliente(created);
      setShowCreateCliente(false);
      setNewCliente({ nombre: '', email: '', telefono: '' });
    } catch {
      toast.error('Error al crear el cliente');
    } finally {
      setCreatingCliente(false);
    }
  };

  const handleAddProducto = (producto: Producto) => {
    const exists = items.find(i => i.producto.id === producto.id);
    if (exists) {
      if (exists.cantidad >= producto.stock) {
        toast.error('No hay suficiente stock');
        return;
      }
      setItems(prev => prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setItems(prev => [...prev, { producto, cantidad: 1 }]);
    }
    setProductoSearch('');
  };

  const handleChangeCantidad = (productoId: string, delta: number) => {
    setItems(prev => prev
      .map(i => i.producto.id === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    );
  };

  const handleRemove = (productoId: string) => {
    setItems(prev => prev.filter(i => i.producto.id !== productoId));
  };

  const total = items.reduce((sum, i) => sum + i.producto.precio * i.cantidad, 0);

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Agregá al menos un producto');
      return;
    }
    setLoading(true);
    try {
      await ventasService.createVenta({
        cliente_id: selectedCliente?.id || null,
        vendedor_id: vendedorId,
        metodo_pago: metodoPago,
        notas: notas.trim() || undefined,
        items: items.map(i => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unitario: i.producto.precio,
        })),
      });
      toast.success('Venta registrada');
      onVentaCreada();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al registrar la venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Vender</h2>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <User className="w-4 h-4" />
            <span>{vendedorNombre}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Cliente */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Cliente (opcional)</label>
              {!showCreateCliente && !selectedCliente && (
                <button
                  type="button"
                  onClick={() => setShowCreateCliente(true)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Nuevo cliente
                </button>
              )}
            </div>

            {selectedCliente ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-blue-900">{selectedCliente.nombre}</p>
                  <p className="text-xs text-blue-600">{selectedCliente.email}</p>
                </div>
                <button onClick={() => setSelectedCliente(null)} className="text-blue-400 hover:text-blue-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : showCreateCliente ? (
              <form onSubmit={handleCrearCliente} className="space-y-2">
                <Input placeholder="Nombre *" value={newCliente.nombre} onChange={e => setNewCliente(f => ({ ...f, nombre: e.target.value }))} required />
                <Input placeholder="Email *" type="email" value={newCliente.email} onChange={e => setNewCliente(f => ({ ...f, email: e.target.value }))} required />
                <Input placeholder="Teléfono" value={newCliente.telefono} onChange={e => setNewCliente(f => ({ ...f, telefono: e.target.value }))} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateCliente(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" size="sm" className="flex-1" disabled={creatingCliente}>
                    {creatingCliente ? 'Creando...' : 'Crear cliente'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar cliente..."
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  className="pl-9"
                />
                {clienteSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {loadingClientes ? (
                      <div className="p-2 text-center"><Spinner size="sm" /></div>
                    ) : filteredClientes.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                    ) : (
                      filteredClientes.slice(0, 6).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCliente(c); setClienteSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                        >
                          <p className="text-sm font-medium">{c.nombre}</p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Productos */}
          <section>
            <label className="text-sm font-medium text-gray-700 block mb-2">Productos *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar producto..."
                value={productoSearch}
                onChange={e => setProductoSearch(e.target.value)}
                className="pl-9"
              />
              {productoSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {loadingProductos ? (
                    <div className="p-2 text-center"><Spinner size="sm" /></div>
                  ) : filteredProductos.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">Sin resultados o sin stock</p>
                  ) : (
                    filteredProductos.slice(0, 8).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProducto(p)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-gray-500">Stock: {p.stock}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">${p.precio.toLocaleString('es-AR')}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Items seleccionados */}
            {items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map(item => (
                  <div key={item.producto.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.producto.nombre}</p>
                      <p className="text-xs text-gray-500">${item.producto.precio.toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeCantidad(item.producto.id, -1)}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => handleChangeCantidad(item.producto.id, 1)}
                        disabled={item.cantidad >= item.producto.stock}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right">
                      ${(item.producto.precio * item.cantidad).toLocaleString('es-AR')}
                    </span>
                    <button type="button" onClick={() => handleRemove(item.producto.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="text-lg font-bold text-gray-900">${total.toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}
          </section>

          {/* Método de pago */}
          <section>
            <label className="text-sm font-medium text-gray-700 block mb-2">Método de pago</label>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia', 'pendiente'] as MetodoPago[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    metodoPago === m
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notas (opcional)</label>
            <Input
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones..."
            />
          </section>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
          >
            {loading ? 'Registrando...' : `Confirmar venta${total > 0 ? ` · $${total.toLocaleString('es-AR')}` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
