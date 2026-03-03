import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Percent, CreditCard, Package, Plus, X, Calculator } from 'lucide-react';
import { TurnoConDetalle, MetodoPago, VentaProductoData, CalculoCompletoTurno } from '../../types/turno.types';
import { calcularComisiones, formatCurrency, generarId } from '../../utils/calculos.utils';
import { Modal, Button, Card, Input, Spinner } from '../ui';

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
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre_producto: '',
    cantidad: 1,
    precio_unitario: ''
  });
  const [calculo, setCalculo] = useState<CalculoCompletoTurno | null>(null);

  // Calcular totales cuando cambian los valores
  useEffect(() => {
    const precioServicio = precioModificado ? parseFloat(precioModificado) || 0 : turno.precio;
    const montoProductos = productos.reduce((sum, p) => sum + p.precio_total, 0);
    const descuento = descuentoPorcentaje ? parseFloat(descuentoPorcentaje) || 0 : 0;

    if (precioServicio > 0 || montoProductos > 0) {
      const resultado = calcularComisiones(
        precioServicio,
        montoProductos,
        descuento,
        comisionesConfig
      );
      setCalculo(resultado);
    }
  }, [precioModificado, descuentoPorcentaje, productos, turno.precio, comisionesConfig]);

  const handleAgregarProducto = () => {
    if (!nuevoProducto.nombre_producto.trim() || !nuevoProducto.precio_unitario) {
      return;
    }

    const precioUnitario = parseFloat(nuevoProducto.precio_unitario);
    if (isNaN(precioUnitario) || precioUnitario <= 0) {
      return;
    }

    const producto: VentaProductoData = {
      id: generarId(),
      nombre_producto: nuevoProducto.nombre_producto,
      cantidad: nuevoProducto.cantidad,
      precio_unitario: precioUnitario,
      precio_total: precioUnitario * nuevoProducto.cantidad
    };

    setProductos([...productos, producto]);
    setNuevoProducto({
      nombre_producto: '',
      cantidad: 1,
      precio_unitario: ''
    });
    setShowAgregarProductos(false);
  };

  const handleEliminarProducto = (id: string) => {
    setProductos(productos.filter(p => p.id !== id));
  };

  const handleFinalizar = async () => {
    if (!metodoPago || metodoPago === 'pendiente') {
      alert('Por favor selecciona un método de pago');
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
    setNuevoProducto({
      nombre_producto: '',
      cantidad: 1,
      precio_unitario: ''
    });
    setCalculo(null);
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
                {turno.fecha ? format(new Date(turno.fecha), "EEEE d 'de' MMMM", { locale: es }) : 'N/A'}
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

        {/* Agregar Producto Modal */}
        {showAgregarProductos && (
          <Card flat className="border-green-200 bg-green-50">
            <h3 className="font-medium text-green-900 mb-3">Agregar Nuevo Producto</h3>
            <div className="space-y-3">
              <Input
                placeholder="Nombre del producto"
                value={nuevoProducto.nombre_producto}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre_producto: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Cantidad"
                  type="number"
                  min="1"
                  value={nuevoProducto.cantidad}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, cantidad: parseInt(e.target.value) || 1 })}
                />
                <Input
                  placeholder="Precio unitario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={nuevoProducto.precio_unitario}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_unitario: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowAgregarProductos(false)}
                  block
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAgregarProducto}
                  disabled={!nuevoProducto.nombre_producto.trim() || !nuevoProducto.precio_unitario}
                  block
                >
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
                <span>{formatCurrency(calculo.subtotalOriginal)}</span>
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
            disabled={!metodoPago || metodoPago === 'pendiente'}
            block
          >
            {loading ? 'Finalizando...' : 'Finalizar Turno'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
