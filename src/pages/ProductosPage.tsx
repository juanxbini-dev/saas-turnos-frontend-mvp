import React, { useState } from 'react';
import { Package, Plus, AlertTriangle, TrendingUp, Users, Edit2, PlusCircle, Power, Trash2 } from 'lucide-react';
import { productosService } from '../services/productos.service';
import { Producto } from '../types/producto.types';
import { useFetch } from '../hooks/useFetch';
import { Button, Badge, Spinner, ConfirmModal } from '../components/ui';
import { ProductoModal } from '../components/productos/ProductoModal';
import { AgregarStockModal } from '../components/productos/AgregarStockModal';
import { useToast } from '../hooks/useToast';

type Tab = 'catalogo' | 'estadisticas';

function ProductosPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('catalogo');
  const [productoModal, setProductoModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [stockModal, setStockModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; producto?: Producto }>({ open: false });

  const { data: productos, loading: loadingProductos, revalidate: revalidateProductos } = useFetch(
    'productos:lista',
    () => productosService.getProductos()
  );

  const { data: stats, loading: loadingStats, revalidate: revalidateStats } = useFetch(
    'productos:stats',
    () => productosService.getStats()
  );

  const refresh = () => {
    revalidateProductos();
    revalidateStats();
  };

  const handleDelete = async () => {
    if (!deleteConfirm.producto) return;
    try {
      await productosService.deleteProducto(deleteConfirm.producto.id);
      toast.success('Producto eliminado');
      setDeleteConfirm({ open: false });
      refresh();
    } catch {
      toast.error('Error al eliminar el producto');
    }
  };

  const handleToggleActivo = async (producto: Producto) => {
    try {
      await productosService.updateProducto(producto.id, { activo: !producto.activo });
      toast.success(producto.activo ? 'Producto desactivado' : 'Producto activado');
      refresh();
    } catch {
      toast.error('Error al actualizar el producto');
    }
  };

  const bajoStock = productos?.filter(p => p.stock <= 3 && p.activo) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto p-4 sm:py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
            {bajoStock.length > 0 && (
              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> {bajoStock.length} bajo stock
              </span>
            )}
          </div>
          <Button onClick={() => setProductoModal({ open: true, producto: null })} leftIcon={Plus}>
            Nuevo producto
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          {(['catalogo', 'estadisticas'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'catalogo' ? 'Catálogo' : 'Estadísticas'}
            </button>
          ))}
        </div>

        {tab === 'catalogo' && (
          <>
            {/* Alerta bajo stock */}
            {bajoStock.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-800">Productos con stock bajo (≤3 unidades)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bajoStock.map(p => (
                    <span key={p.id} className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                      {p.nombre}: <strong>{p.stock}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla */}
            {loadingProductos ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !productos?.length ? (
              <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No hay productos aún</p>
                <p className="text-sm mt-1">Creá tu primer producto con el botón de arriba</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Nombre</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Precio</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-700">Stock</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-700">Estado</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map(p => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.nombre}</p>
                          {p.descripcion && <p className="text-xs text-gray-400 mt-0.5">{p.descripcion}</p>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          ${p.precio.toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-10 h-7 rounded-full text-sm font-bold ${
                            p.stock <= 3 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={p.activo ? 'success' : 'default'}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setStockModal({ open: true, producto: p })}
                              title="Agregar stock"
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setProductoModal({ open: true, producto: p })}
                              title="Editar"
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(p)}
                              title={p.activo ? 'Desactivar' : 'Activar'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                p.activo
                                  ? 'text-green-500 hover:text-red-500 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ open: true, producto: p })}
                              title="Eliminar"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'estadisticas' && (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <>
                {/* Top productos */}
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-gray-900">Top productos más vendidos</h2>
                  </div>
                  {!stats?.top_productos?.length ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sin ventas registradas aún</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.top_productos.map((p, i) => (
                        <div key={p.producto_id} className="flex items-center gap-3">
                          <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-800">{p.nombre}</span>
                              <span className="text-xs text-gray-500">{p.total_vendido} uds</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, (p.total_vendido / (stats.top_productos[0]?.total_vendido || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-24 text-right">
                            ${Number(p.total_ingresos).toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top vendedores */}
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-purple-600" />
                    <h2 className="font-semibold text-gray-900">Top vendedores de productos</h2>
                  </div>
                  {!stats?.top_vendedores?.length ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sin ventas registradas aún</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.top_vendedores.map((v, i) => (
                        <div key={v.vendedor_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                          <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{v.nombre}</p>
                            <p className="text-xs text-gray-500">{v.total_vendido} unidades vendidas</p>
                          </div>
                          <span className="text-sm font-bold text-gray-900">
                            ${Number(v.total_ingresos).toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modales */}
      {productoModal.open && (
        <ProductoModal
          producto={productoModal.producto}
          onClose={() => setProductoModal({ open: false })}
          onSaved={() => {
            setProductoModal({ open: false });
            refresh();
          }}
        />
      )}

      {stockModal.open && stockModal.producto && (
        <AgregarStockModal
          producto={stockModal.producto}
          onClose={() => setStockModal({ open: false })}
          onSaved={() => {
            setStockModal({ open: false });
            refresh();
          }}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false })}
        onConfirm={handleDelete}
        title="Eliminar producto"
        message={`¿Estás seguro que querés eliminar <strong>${deleteConfirm.producto?.nombre}</strong>? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}

export default ProductosPage;
