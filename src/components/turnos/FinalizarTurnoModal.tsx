import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Percent, CreditCard, Package, Plus, X, Calculator, Search } from 'lucide-react';
import { TurnoConDetalle, MetodoPago, VentaProductoData, CalculoCompletoTurno } from '../../types/turno.types';
import { calcularComisiones, formatCurrency, generarId } from '../../utils/calculos.utils';
import { Modal, Button, Card, Input, Spinner } from '../ui';
import { productosService } from '../../services/productos.service';
import { Producto } from '../../types/producto.types';
import { useFetch } from '../../hooks/useFetch';

interface FinalizarTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno: TurnoConDetalle;
  onSuccess: () => void;
  comisionesConfig: {
    comision_turno: number;
    comision_producto: number;
  };
}

export function FinalizarTurnoModal({ 
  isOpen, 
  onClose, 
  turno, 
  onSuccess,
  comisionesConfig 
}: FinalizarTurnoModalProps) {
  const [loading, setLoading] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('pendiente');
  const [precioModificado, setPrecioModificado] = useState<string>('');
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<string>('');
  const [productos, setProductos] = useState<VentaProductoData[]>([]);
  const [showAgregarProductos, setShowAgregarProductos] = useState(false);
  const [catalogoSearch, setCatalogoSearch] = useState('');
  const [selectedCatalogProducto, setSelectedCatalogProducto] = useState<Producto | null>(null);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [cantidadError, setCantidadError] = useState<string | null>(null);
  const { data: catalogoProductos, loading: loadingCatalogo } = useFetch(
    'productos:lista',
    () => productosService.getProductos(),
    { ttl: 60 }
  );

  // Calcular totales derivado directo
  const calculo = useMemo<CalculoCompletoTurno | null>(() => {
    const precioServicio = precioModificado ? parseFloat(precioModificado) || 0 : Number(turno.precio);
    const montoProductos = productos.reduce((sum, p) => sum + Number(p.precio_total), 0);
    const descuento = descuentoPorcentaje ? parseFloat(descuentoPorcentaje) || 0 : 0;
    if (precioServicio > 0 || montoProductos > 0) {
      return calcularComisiones(precioServicio, montoProductos, descuento, comisionesConfig);
    }
    return null;
  }, [precioModificado, productos, descuentoPorcentaje, turno.precio, comisionesConfig]);

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
      const producto: VentaProductoData = {
        id: generarId(),
        producto_id: selectedCatalogProducto.id,
        nombre_producto: selectedCatalogProducto.nombre,
        cantidad: nuevaCantidad,
        precio_unitario: selectedCatalogProducto.precio,
        precio_total: selectedCatalogProducto.precio * nuevaCantidad,
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

  const handleFinalizar = async () => {
    if (!metodoPago) {
      alert('Por favor seleccioná un método de pago');
      return;
    }

    setLoading(true);
    try {
      const { turnoService } = await import('../../services/turno.service');
      
      await turnoService.finalizarTurno(turno.id, {
        metodoPago,
        precioModificado: precioModificado ? parseFloat(precioModificado) : undefined,
        descuentoPorcentaje: descuentoPorcentaje ? parseFloat(descuentoPorcentaje) : undefined,
        productos: productos.length > 0 ? productos : undefined
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error al finalizar turno:', error);
      alert(error.response?.data?.message || error.message || 'Error al finalizar turno');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMetodoPago('pendiente');
    setPrecioModificado('');
    setDescuentoPorcentaje('');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Finalizar Turno"
      size="lg"
    >
      <div className="space-y-6">
        {/* Información del Turno */}
        <Card flat className="border-blue-200 bg-blue-50">
          <h3 className="font-medium text-blue-900 mb-3">Información del Turno</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Cliente</p>
              <p className="font-medium">{turno.cliente_nombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Servicio</p>
              <p className="font-medium">{turno.servicio}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha</p>
              <p className="font-medium">
                {turno.fecha ? format(new Date(turno.fecha.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Hora</p>
              <p className="font-medium">{turno.hora}</p>
            </div>
          </div>
        </Card>

        {/* Método de Pago */}
        <Card flat>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Método de Pago
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(['efectivo', 'transferencia', 'pendiente'] as MetodoPago[]).map((metodo) => (
              <button
                key={metodo}
                onClick={() => setMetodoPago(metodo)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  metodoPago === metodo
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="capitalize">{metodo}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Precio del Servicio */}
        <Card flat>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Precio del Servicio
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Original
              </label>
              <Input
                value={formatCurrency(turno.precio)}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Modificado (opcional)
              </label>
              <Input
                placeholder="Ingrese el precio modificado..."
                value={precioModificado}
                onChange={(e) => setPrecioModificado(e.target.value)}
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </Card>

        {/* Descuento */}
        <Card flat>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Descuento
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Porcentaje de Descuento
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
        </Card>

        {/* Productos */}
        <Card flat>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Productos
            </h3>
            <Button
              variant="secondary"
              onClick={() => setShowAgregarProductos(true)}
              leftIcon={Plus}
              size="sm"
            >
              Agregar Producto
            </Button>
          </div>
          
          {productos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay productos agregados
            </p>
          ) : (
            <div className="space-y-2">
              {productos.map((producto) => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{producto.nombre_producto}</div>
                    <div className="text-sm text-gray-500">
                      {producto.cantidad} × {formatCurrency(producto.precio_unitario)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {formatCurrency(producto.precio_total)}
                    </div>
                    <button
                      onClick={() => handleEliminarProducto(producto.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Selector de Catálogo */}
        {showAgregarProductos && (
          <Card flat className="border-green-200 bg-green-50">
            <h3 className="font-medium text-green-900 mb-3">Seleccionar Producto del Catálogo</h3>
            <div className="space-y-3">
              {selectedCatalogProducto ? (
                <div className="bg-white border border-green-300 rounded-lg px-3 py-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{selectedCatalogProducto.nombre}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(selectedCatalogProducto.precio)} c/u · Stock: {selectedCatalogProducto.stock}</p>
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
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 flex justify-between"
                          >
                            <span className="text-sm font-medium">{p.nombre}</span>
                            <span className="text-sm text-gray-500">{formatCurrency(p.precio)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {selectedCatalogProducto && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad <span className="text-gray-400 font-normal">(stock: {selectedCatalogProducto.stock})</span>
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
                <Button variant="secondary" onClick={() => { setShowAgregarProductos(false); setSelectedCatalogProducto(null); setCatalogoSearch(''); }} block>
                  Cancelar
                </Button>
                <Button onClick={handleAgregarProducto} disabled={!selectedCatalogProducto || !!cantidadError} block>
                  Agregar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Resumen y Cálculos */}
        {calculo && (
          <Card flat className="border-purple-200 bg-purple-50">
            <h3 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Resumen de Cálculos
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Servicio:</span>
                <span>{formatCurrency(calculo.precioOriginalServicio)}</span>
              </div>
              <div className="flex justify-between">
                <span>Productos:</span>
                <span>{formatCurrency(calculo.precioOriginalProductos)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Subtotal:</span>
                <span>{formatCurrency(calculo.precioOriginalServicio + calculo.precioOriginalProductos)}</span>
              </div>
              {calculo.descuentoMonto > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({calculo.descuentoPorcentaje}%):</span>
                    <span>-{formatCurrency(calculo.descuentoMonto)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg">
                    <span>Total con Descuento:</span>
                    <span>{formatCurrency(calculo.totalConDescuento)}</span>
                  </div>
                </>
              )}
              
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Comisión Empresa (Servicios):</span>
                  <span>{formatCurrency(calculo.comisionServicio.montoEmpresa)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Neto Profesional (Servicios):</span>
                  <span>{formatCurrency(calculo.comisionServicio.netoProfesional)}</span>
                </div>
                {calculo.comisionProductos.base > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Comisión Empresa (Productos):</span>
                      <span>{formatCurrency(calculo.comisionProductos.montoEmpresa)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Neto Profesional (Productos):</span>
                      <span>{formatCurrency(calculo.comisionProductos.netoProfesional)}</span>
                    </div>
                  </>
                )}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total Empresa:</span>
                  <span>{formatCurrency(calculo.totales.totalEmpresa)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Profesional:</span>
                  <span>{formatCurrency(calculo.totales.totalProfesional)}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Botones de Acción */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            block
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFinalizar}
            loading={loading}
            disabled={!metodoPago}
            block
            variant={metodoPago === 'pendiente' ? 'secondary' : 'primary'}
          >
            {loading ? 'Guardando...' : metodoPago === 'pendiente' ? 'Guardar como pendiente' : 'Finalizar Turno'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
