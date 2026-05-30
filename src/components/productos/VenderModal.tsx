import React, { useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, User } from 'lucide-react';
import { Button, Input, Spinner } from '../ui';
import { Cliente, CreateClienteData } from '../../types/cliente.types';
import { Producto } from '../../types/producto.types';
import { clienteService, getClienteDuplicado } from '../../services/cliente.service';
import { ClienteDuplicadoModal } from '../clientes/ClienteDuplicadoModal';
import { ventasService } from '../../services/ventas.service';
import { productosService } from '../../services/productos.service';
import { useToast } from '../../hooks/useToast';
import { useFetch } from '../../hooks/useFetch';
import { useDebounce } from '../../hooks/useDebounce';
import { buildKey, ENTITIES } from '../../cache/key.builder';

interface VentaItem {
  producto: Producto;
  cantidad: number;
  esVentaCosto: boolean;
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
  const [clienteDuplicado, setClienteDuplicado] = useState<{ isOpen: boolean; cliente: Cliente | null; mensaje: string }>({
    isOpen: false,
    cliente: null,
    mensaje: ''
  });

  // Productos
  const [productoSearch, setProductoSearch] = useState('');
  const [items, setItems] = useState<VentaItem[]>([]);

  // Pago
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [notas, setNotas] = useState('');

  // Fecha retroactiva
  const [esFechaRetroactiva, setEsFechaRetroactiva] = useState(false);
  const [fechaVenta, setFechaVenta] = useState('');

  // Búsqueda de clientes server-side: el backend filtra por nombre/email/teléfono
  // (solo consultamos a partir de 2 caracteres) en vez de cargar los primeros
  // 100 clientes alfabéticos en memoria y filtrar en el navegador.
  const debouncedClienteSearch = useDebounce(clienteSearch.trim(), 350);
  const { data: clientesResp, loading: loadingClientes } = useFetch(
    debouncedClienteSearch.length >= 2
      ? buildKey(ENTITIES.CLIENTES, `selector:${debouncedClienteSearch}`)
      : null,
    () => clienteService.getClientes(1, 20, debouncedClienteSearch),
    { ttl: 300 }
  );

  const { data: productos, loading: loadingProductos } = useFetch(
    'productos:lista',
    () => productosService.getProductos(),
    { ttl: 60 }
  );

  const filteredClientes = debouncedClienteSearch.length >= 2
    ? (clientesResp?.items || [])
    : [];

  // "Buscando" incluye la ventana de debounce (todavía no se consultó al backend)
  const clienteBuscando = clienteSearch.trim().length >= 2 &&
    (loadingClientes || debouncedClienteSearch !== clienteSearch.trim());

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
    } catch (error: any) {
      const dup = getClienteDuplicado(error);
      if (dup) {
        setClienteDuplicado({ isOpen: true, cliente: dup.cliente, mensaje: dup.mensaje });
      } else {
        toast.error(error?.response?.data?.message || 'Error al crear el cliente');
      }
    } finally {
      setCreatingCliente(false);
    }
  };

  const usarClienteExistente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowCreateCliente(false);
    setNewCliente({ nombre: '', email: '', telefono: '' });
    setClienteSearch('');
    setClienteDuplicado({ isOpen: false, cliente: null, mensaje: '' });
    toast.success('Cliente existente seleccionado');
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
      setItems(prev => [...prev, { producto, cantidad: 1, esVentaCosto: false }]);
    }
    setProductoSearch('');
  };

  const handleToggleVentaCosto = (productoId: string) => {
    setItems(prev => prev.map(i =>
      i.producto.id === productoId ? { ...i, esVentaCosto: !i.esVentaCosto } : i
    ));
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

  const getPrecioUnitario = (producto: Producto, esVentaCosto = false): number => {
    if (esVentaCosto) return Number(producto.costo) || 0;
    if (metodoPago === 'transferencia') return Number(producto.precio_transferencia) || 0;
    return Number(producto.precio_efectivo) || 0;
  };

  const total = items.reduce((sum, i) => sum + getPrecioUnitario(i.producto, i.esVentaCosto) * i.cantidad, 0);

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
        ...(esFechaRetroactiva && fechaVenta ? { fecha_venta: fechaVenta } : {}),
        items: items.map(i => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unitario: getPrecioUnitario(i.producto, i.esVentaCosto),
          ...(i.esVentaCosto ? { es_venta_costo: true, precio_costo: Number(i.producto.costo) || 0 } : {}),
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
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl ring-1 ring-black/5 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Vender</h2>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <User className="w-4 h-4" />
            <span>{vendedorNombre}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Método de pago */}
          <section>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Método de pago</label>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia', 'pendiente'] as MetodoPago[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                    metodoPago === m
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </section>

          {/* Cliente */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente (opcional)</label>
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
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-blue-900">{selectedCliente.nombre}</p>
                  <p className="text-xs text-blue-600">{selectedCliente.email}</p>
                </div>
                <button onClick={() => setSelectedCliente(null)} className="text-blue-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-100 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : showCreateCliente ? (
              <form onSubmit={handleCrearCliente} className="space-y-2">
                <Input placeholder="Nombre *" value={newCliente.nombre} onChange={e => setNewCliente(f => ({ ...f, nombre: e.target.value }))} required />
                <Input placeholder="Email *" type="email" value={newCliente.email} onChange={e => setNewCliente(f => ({ ...f, email: e.target.value }))} required />
                <Input placeholder="Teléfono" value={newCliente.telefono} onChange={e => setNewCliente(f => ({ ...f, telefono: e.target.value }))} />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateCliente(false)} className="flex-1">Cancelar</Button>
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
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {clienteBuscando ? (
                      <div className="p-2 text-center"><Spinner size="sm" /></div>
                    ) : clienteSearch.trim().length < 2 ? (
                      <p className="p-3 text-sm text-gray-400">Escribí al menos 2 caracteres para buscar</p>
                    ) : filteredClientes.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                    ) : (
                      filteredClientes.slice(0, 6).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCliente(c); setClienteSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Productos *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar producto..."
                value={productoSearch}
                onChange={e => setProductoSearch(e.target.value)}
                className="pl-9"
              />
              {productoSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
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
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {p.marca_nombre && <span className="text-blue-600 font-medium">{p.marca_nombre} · </span>}
                            Stock: {p.stock}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ${getPrecioUnitario(p).toLocaleString('es-AR')}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Items seleccionados */}
            {items.length > 0 && (
              <div className="mt-3">
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {items.map(item => {
                    const tieneCosto = item.producto.costo != null && Number(item.producto.costo) > 0;
                    const precioUnit = getPrecioUnitario(item.producto, item.esVentaCosto);
                    return (
                      <div key={item.producto.id} className="bg-white px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.producto.nombre}</p>
                            {item.esVentaCosto ? (
                              tieneCosto ? (
                                <p className="text-xs text-orange-600 font-medium">Precio costo: ${Number(item.producto.costo).toLocaleString('es-AR')} c/u</p>
                              ) : (
                                <p className="text-xs text-orange-500">Se usará precio de costo (pendiente configurar)</p>
                              )
                            ) : (
                              <p className="text-xs text-gray-500">${precioUnit.toLocaleString('es-AR')} c/u</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleChangeCantidad(item.producto.id, -1)}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">{item.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => handleChangeCantidad(item.producto.id, 1)}
                              disabled={item.cantidad >= item.producto.stock}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                            ${(precioUnit * item.cantidad).toLocaleString('es-AR')}
                          </span>
                          <button type="button" onClick={() => handleRemove(item.producto.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Toggle al costo */}
                        <label className="flex items-center gap-2 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={item.esVentaCosto}
                            onChange={() => handleToggleVentaCosto(item.producto.id)}
                            className="w-3.5 h-3.5 accent-orange-500"
                          />
                          <span className="text-xs text-gray-500 select-none">Al costo</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center pt-3 mt-1">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="text-lg font-bold text-blue-600">${total.toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}
          </section>

          {/* Notas */}
          <section>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Notas (opcional)</label>
            <Input
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones..."
            />
          </section>

          {/* Fecha retroactiva */}
          <section>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={esFechaRetroactiva}
                onChange={e => {
                  setEsFechaRetroactiva(e.target.checked);
                  if (!e.target.checked) setFechaVenta('');
                }}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 select-none">Venta de fecha pasada</span>
            </label>
            {esFechaRetroactiva && (
              <input
                type="date"
                value={fechaVenta}
                onChange={e => setFechaVenta(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
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

    <ClienteDuplicadoModal
      isOpen={clienteDuplicado.isOpen}
      mensaje={clienteDuplicado.mensaje}
      cliente={clienteDuplicado.cliente}
      onClose={() => setClienteDuplicado({ isOpen: false, cliente: null, mensaje: '' })}
      onUsar={usarClienteExistente}
    />
    </>
  );
};
