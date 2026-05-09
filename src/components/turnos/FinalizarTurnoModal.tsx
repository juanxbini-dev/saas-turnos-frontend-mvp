import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Percent, CreditCard, Package, Plus, X, Search } from 'lucide-react';
import { TurnoConDetalle, MetodoPago, VentaProductoData } from '../../types/turno.types';
import { formatCurrency, generarId } from '../../utils/calculos.utils';
import { Modal, Button, Card, Input, Spinner } from '../ui';
import { productosService } from '../../services/productos.service';
import { Producto } from '../../types/producto.types';
import { useFetch } from '../../hooks/useFetch';
import axiosInstance from '../../api/axiosInstance';

interface FinalizarTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno: TurnoConDetalle;
  onSuccess: () => void;
  comisionesConfig?: { comision_turno: number; comision_producto: number };
  mode?: 'finalizar' | 'editar';
}

export function FinalizarTurnoModal({
  isOpen,
  onClose,
  turno,
  onSuccess,
  mode = 'finalizar',
}: FinalizarTurnoModalProps) {
  const [loading, setLoading] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('pendiente');
  const [precioModificado, setPrecioModificado] = useState<string>('');
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<string>('');
  const [descuentoAplicarA, setDescuentoAplicarA] = useState({ servicio: true, productos: true });
  const [productos, setProductos] = useState<VentaProductoData[]>([]);
  const [showAgregarProductos, setShowAgregarProductos] = useState(false);
  const [catalogoSearch, setCatalogoSearch] = useState('');
  const [selectedCatalogProducto, setSelectedCatalogProducto] = useState<Producto | null>(null);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [cantidadError, setCantidadError] = useState<string | null>(null);
  const [loadingProductosExistentes, setLoadingProductosExistentes] = useState(false);

  const { data: catalogoProductos, loading: loadingCatalogo } = useFetch(
    'productos:lista',
    () => productosService.getProductos(),
    { ttl: 60 }
  );

  // En modo editar, pre-poblar campos con los datos actuales del turno
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'editar') {
      setMetodoPago((turno.metodo_pago as MetodoPago) || 'pendiente');
      // Si el precio original es distinto al precio del servicio, mostrarlo como modificado
      if (turno.precio_original && Number(turno.precio_original) !== Number(turno.precio)) {
        setPrecioModificado(String(turno.precio_original));
      }
      if (turno.descuento_porcentaje && Number(turno.descuento_porcentaje) > 0) {
        setDescuentoPorcentaje(String(turno.descuento_porcentaje));
      }

      // Cargar productos existentes del turno
      setLoadingProductosExistentes(true);
      axiosInstance.get(`/api/finanzas/turno/${turno.id}/productos`)
        .then(res => {
          const prods: VentaProductoData[] = (res.data.data || []).map((p: any) => ({
            id: generarId(),
            producto_id: p.producto_id,
            nombre_producto: p.nombre_producto,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            precio_total: p.precio_total,
            metodo_pago: p.metodo_pago,
            _precio_efectivo: p.precio_efectivo,
            _precio_transferencia: p.precio_transferencia,
          }));
          setProductos(prods);
        })
        .catch(() => {})
        .finally(() => setLoadingProductosExistentes(false));
    }
  }, [isOpen, mode, turno]);

  // Cambiar método de pago de un producto y recalcular su precio
  const handleProductoMetodoPago = (id: string, metodo: 'efectivo' | 'transferencia') => {
    setProductos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const nuevoPrecio = metodo === 'transferencia'
        ? (p._precio_transferencia ?? p.precio_unitario)
        : (p._precio_efectivo ?? p.precio_unitario);
      return { ...p, metodo_pago: metodo, precio_unitario: nuevoPrecio, precio_total: nuevoPrecio * p.cantidad };
    }));
  };

  // Calcular totales respetando a qué ítems aplica el descuento
  const calculo = useMemo(() => {
    const precioServicio = precioModificado ? parseFloat(precioModificado) || 0 : Number(turno.precio);
    const montoProductos = productos.reduce((sum, p) => sum + Number(p.precio_total), 0);
    const subtotal = precioServicio + montoProductos;
    if (subtotal <= 0) return null;

    const descuento = descuentoPorcentaje ? parseFloat(descuentoPorcentaje) || 0 : 0;
    const baseDescuento =
      (descuentoAplicarA.servicio ? precioServicio : 0) +
      (descuentoAplicarA.productos ? montoProductos : 0);
    const descuentoMonto = baseDescuento * (descuento / 100);
    const totalConDescuento = subtotal - descuentoMonto;

    return {
      precioOriginalServicio: precioServicio,
      precioOriginalProductos: montoProductos,
      subtotal,
      descuentoPorcentaje: descuento,
      descuentoMonto,
      totalConDescuento,
    };
  }, [precioModificado, productos, descuentoPorcentaje, descuentoAplicarA, turno.precio]);

  const handleAgregarProducto = () => {
    if (!selectedCatalogProducto) return;
    if (nuevaCantidad <= 0) return;

    const existe = productos.find(p => p.producto_id === selectedCatalogProducto.id);
    if (existe) {
      setProductos(prev => prev.map(p =>
        p.producto_id === selectedCatalogProducto.id
          ? { ...p, cantidad: p.cantidad + nuevaCantidad, precio_total: p.precio_unitario * (p.cantidad + nuevaCantidad) }
          : p
      ));
    } else {
      const metodoProd = metodoPago as 'efectivo' | 'transferencia' | 'pendiente';
      const precioEfectivo = Number(selectedCatalogProducto.precio_efectivo) || 0;
      const precioTransferencia = Number(selectedCatalogProducto.precio_transferencia) || 0;
      const precioUnitario = metodoProd === 'transferencia' ? precioTransferencia : precioEfectivo;
      const producto: VentaProductoData = {
        id: generarId(),
        producto_id: selectedCatalogProducto.id,
        nombre_producto: selectedCatalogProducto.nombre,
        cantidad: nuevaCantidad,
        precio_unitario: precioUnitario,
        precio_total: precioUnitario * nuevaCantidad,
        metodo_pago: metodoProd,
        _precio_efectivo: precioEfectivo,
        _precio_transferencia: precioTransferencia,
      };
      setProductos([...productos, producto]);
    }

    setSelectedCatalogProducto(null);
    setCatalogoSearch('');
    setNuevaCantidad(1);
    setCantidadError(null);
    setShowAgregarProductos(false);
  };

  const handleEliminarProducto = (id: string) => {
    setProductos(productos.filter(p => p.id !== id));
  };

  const handleSubmit = async () => {
    if (!metodoPago) {
      alert('Por favor seleccioná un método de pago');
      return;
    }

    setLoading(true);
    try {
      const { turnoService } = await import('../../services/turno.service');
      const payload = {
        metodoPago,
        precioModificado: precioModificado ? parseFloat(precioModificado) : undefined,
        descuentoPorcentaje: descuentoPorcentaje ? parseFloat(descuentoPorcentaje) : undefined,
        descuentoAplicarA,
        productos: productos.length > 0 ? productos : undefined,
      };

      if (mode === 'editar') {
        await turnoService.editarPago(turno.id, payload);
      } else {
        await turnoService.finalizarTurno(turno.id, payload);
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error al guardar pago del turno:', error);
      alert(error.response?.data?.message || error.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMetodoPago('pendiente');
    setPrecioModificado('');
    setDescuentoPorcentaje('');
    setDescuentoAplicarA({ servicio: true, productos: true });
    setProductos([]);
    setShowAgregarProductos(false);
    setSelectedCatalogProducto(null);
    setCatalogoSearch('');
    setNuevaCantidad(1);
    setCantidadError(null);
    onClose();
  };

  if (!isOpen) return null;

  const precioServicio = precioModificado ? parseFloat(precioModificado) || 0 : turno.precio;
  const montoProductos = productos.reduce((sum, p) => sum + p.precio_total, 0);
  const tieneProductos = montoProductos > 0 || productos.length > 0;

  const titulo = mode === 'editar' ? 'Editar Pago del Turno' : 'Finalizar Turno';
  const labelBoton = mode === 'editar'
    ? 'Guardar cambios'
    : metodoPago === 'pendiente' ? 'Guardar como pendiente' : 'Finalizar Turno';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={titulo}
      size="lg"
    >
      <div className="space-y-5">
        {/* Información del Turno — grid 2x2 limpio */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Cliente</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno.cliente_nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Servicio</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno.servicio}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {turno.fecha ? format(new Date(turno.fecha.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Hora</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno.hora}</p>
          </div>
        </div>

        {/* Método de Pago — pills modernos */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Método de Pago</p>
          <div className="grid grid-cols-3 gap-2">
            {(['efectivo', 'transferencia', 'pendiente'] as MetodoPago[]).map((metodo) => (
              <button
                key={metodo}
                onClick={() => setMetodoPago(metodo)}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  metodoPago === metodo
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="capitalize">{metodo}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Precio del Servicio */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Precio del Servicio</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Precio Original
              </label>
              <Input
                value={formatCurrency(turno.precio)}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Precio Modificado
              </label>
              <Input
                placeholder="Opcional..."
                value={precioModificado}
                onChange={(e) => setPrecioModificado(e.target.value)}
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Productos */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Productos</p>
            <Button
              variant="secondary"
              onClick={() => setShowAgregarProductos(true)}
              leftIcon={Plus}
              size="sm"
            >
              Agregar Producto
            </Button>
          </div>

          {loadingProductosExistentes ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : productos.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">No hay productos agregados</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
              {productos.map((producto) => (
                <div key={producto.id} className="p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{producto.nombre_producto}</div>
                      <div className="text-sm text-gray-500">
                        {producto.cantidad} × {formatCurrency(producto.precio_unitario)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-gray-900">{formatCurrency(producto.precio_total)}</div>
                      <button
                        onClick={() => handleEliminarProducto(producto.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(['efectivo', 'transferencia'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleProductoMetodoPago(producto.id, m)}
                        className={`text-xs px-2 py-0.5 rounded border transition-all ${
                          producto.metodo_pago === m
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-200 text-gray-500 hover:border-blue-300'
                        }`}
                      >
                        {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selector de Catálogo */}
        {showAgregarProductos && (
          <div className="border border-dashed border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seleccionar Producto del Catálogo</p>
            <div className="space-y-3">
              {selectedCatalogProducto ? (
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedCatalogProducto.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {selectedCatalogProducto.marca_nombre && <span className="text-blue-600 font-medium">{selectedCatalogProducto.marca_nombre} · </span>}
                      {formatCurrency(metodoPago === 'transferencia' ? selectedCatalogProducto.precio_transferencia ?? 0 : selectedCatalogProducto.precio_efectivo ?? 0)} c/u · Stock: {selectedCatalogProducto.stock}
                    </p>
                  </div>
                  <button onClick={() => setSelectedCatalogProducto(null)} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar producto..."
                    value={catalogoSearch}
                    onChange={e => setCatalogoSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                  {catalogoSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {loadingCatalogo ? (
                        <div className="p-3 text-center"><Spinner size="sm" /></div>
                      ) : (catalogoProductos?.filter(p =>
                            p.activo && p.stock > 0 &&
                            p.nombre.toLowerCase().includes(catalogoSearch.toLowerCase())
                          ) || []).length === 0 ? (
                        <p className="p-3 text-sm text-gray-500">Sin resultados o sin stock</p>
                      ) : (
                        (catalogoProductos?.filter(p =>
                          p.activo && p.stock > 0 &&
                          p.nombre.toLowerCase().includes(catalogoSearch.toLowerCase())
                        ) || []).slice(0, 6).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedCatalogProducto(p); setCatalogoSearch(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 flex justify-between items-center"
                          >
                            <div>
                              <p className="text-sm font-medium">{p.nombre}</p>
                              {p.marca_nombre && <p className="text-xs text-blue-600 font-medium">{p.marca_nombre}</p>}
                            </div>
                            <span className="text-sm text-gray-500 shrink-0">{formatCurrency(metodoPago === 'transferencia' ? p.precio_transferencia ?? 0 : p.precio_efectivo ?? 0)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {selectedCatalogProducto && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Cantidad <span className="text-gray-400 font-normal normal-case">(stock: {selectedCatalogProducto.stock})</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedCatalogProducto.stock}
                    value={nuevaCantidad}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setNuevaCantidad(val);
                      if (val > selectedCatalogProducto.stock) {
                        setCantidadError(`Supera el stock disponible (${selectedCatalogProducto.stock})`);
                      } else if (val < 1) {
                        setCantidadError('La cantidad mínima es 1');
                      } else {
                        setCantidadError(null);
                      }
                    }}
                    className={cantidadError ? 'border-red-400' : ''}
                  />
                  {cantidadError && (
                    <p className="text-xs text-red-600 mt-1">{cantidadError}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setShowAgregarProductos(false); setSelectedCatalogProducto(null); setCatalogoSearch(''); }} block>
                  Cancelar
                </Button>
                <Button onClick={handleAgregarProducto} disabled={!selectedCatalogProducto || !!cantidadError} block>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Descuento */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Descuento</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Porcentaje
              </label>
              <Input
                placeholder="0%"
                value={descuentoPorcentaje}
                onChange={(e) => setDescuentoPorcentaje(e.target.value)}
                type="number"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            {descuentoPorcentaje && parseFloat(descuentoPorcentaje) > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Aplicar a:</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={descuentoAplicarA.servicio}
                      onChange={e => setDescuentoAplicarA(prev => ({ ...prev, servicio: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">Servicio</span>
                    {descuentoAplicarA.servicio && (
                      <span className="text-xs text-green-600">
                        -{formatCurrency((precioServicio) * (parseFloat(descuentoPorcentaje) / 100))}
                      </span>
                    )}
                  </label>
                  {tieneProductos && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={descuentoAplicarA.productos}
                        onChange={e => setDescuentoAplicarA(prev => ({ ...prev, productos: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">Productos</span>
                      {descuentoAplicarA.productos && (
                        <span className="text-xs text-green-600">
                          -{formatCurrency(montoProductos * (parseFloat(descuentoPorcentaje) / 100))}
                        </span>
                      )}
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumen — panel oscuro prominente */}
        {calculo && (
          <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Resumen</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Servicio:</span>
                <span>{formatCurrency(calculo.precioOriginalServicio)}</span>
              </div>
              {calculo.precioOriginalProductos > 0 && (
                <>
                  <div className="flex justify-between text-slate-300">
                    <span>Productos:</span>
                    <span>{formatCurrency(calculo.precioOriginalProductos)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-medium">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculo.subtotal)}</span>
                  </div>
                </>
              )}
              {calculo.descuentoMonto > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Descuento ({calculo.descuentoPorcentaje}%):</span>
                  <span>-{formatCurrency(calculo.descuentoMonto)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-3 mt-1 border-t border-slate-700">
                <span className="text-white">Total:</span>
                <span className="text-white">{formatCurrency(calculo.totalConDescuento)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={handleClose} block>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!metodoPago}
            block
            className="h-11 font-semibold"
            variant={mode === 'editar' ? 'primary' : metodoPago === 'pendiente' ? 'secondary' : 'primary'}
          >
            {loading ? 'Guardando...' : labelBoton}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
