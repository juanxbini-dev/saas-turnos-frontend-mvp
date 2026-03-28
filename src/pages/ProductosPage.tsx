import React, { useState, useMemo } from 'react';
import { Package, Plus, AlertTriangle, TrendingUp, Users, Edit2, PlusCircle, Power, Trash2, Tag, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { productosService } from '../services/productos.service';
import { marcasService } from '../services/marcas.service';
import { Producto } from '../types/producto.types';
import { MarcaConProductos } from '../types/marca.types';
import { useFetch } from '../hooks/useFetch';
import { Button, Badge, Spinner, ConfirmModal, Card, Input } from '../components/ui';
import { ProductoModal } from '../components/productos/ProductoModal';
import { AgregarStockModal } from '../components/productos/AgregarStockModal';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';

type Tab = 'catalogo' | 'marcas' | 'estadisticas';

const PAGE_SIZE = 10;

function ProductosPage() {
  const toast = useToast();
  const { state } = useAuth();
  const isAdmin = state.roles?.includes('admin');

  const [tab, setTab] = useState<Tab>('catalogo');

  // Catálogo state
  const [productoModal, setProductoModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [stockModal, setStockModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; producto?: Producto }>({ open: false });
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Marcas state
  const [marcaEditando, setMarcaEditando] = useState<MarcaConProductos | null>(null);
  const [marcaForm, setMarcaForm] = useState('');
  const [savingMarca, setSavingMarca] = useState(false);
  const [deleteMarcaConfirm, setDeleteMarcaConfirm] = useState<{ open: boolean; marca?: MarcaConProductos; productosAfectados?: number }>({ open: false });
  const [showNuevaMarca, setShowNuevaMarca] = useState(false);

  const { data: productos, loading: loadingProductos, revalidate: revalidateProductos } = useFetch(
    'productos:lista',
    () => productosService.getProductos()
  );

  const { data: marcas, loading: loadingMarcas, revalidate: revalidateMarcas } = useFetch(
    'marcas:lista',
    () => marcasService.getMarcas()
  );

  const { data: stats, loading: loadingStats, revalidate: revalidateStats } = useFetch(
    'productos:stats',
    () => productosService.getStats()
  );

  const refresh = () => {
    revalidateProductos();
    revalidateStats();
  };

  // Filtrado y paginación del catálogo
  const productosFiltrados = useMemo(() => {
    let lista = productos || [];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q));
    }
    if (filtroMarca) {
      lista = lista.filter(p => p.marca_id === filtroMarca);
    }
    return lista;
  }, [productos, busqueda, filtroMarca]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const productosPagina = productosFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const handleFiltroChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPagina(1);
  };

  // Handlers productos
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

  const toggleActions = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedActions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedActions(next);
  };

  // Handlers marcas
  const handleSaveMarca = async () => {
    if (!marcaForm.trim()) return;
    setSavingMarca(true);
    try {
      if (marcaEditando) {
        await marcasService.updateMarca(marcaEditando.id, { nombre: marcaForm.trim() });
        toast.success('Marca actualizada');
        setMarcaEditando(null);
      } else {
        await marcasService.createMarca({ nombre: marcaForm.trim() });
        toast.success('Marca creada');
        setShowNuevaMarca(false);
      }
      setMarcaForm('');
      revalidateMarcas();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar marca');
    } finally {
      setSavingMarca(false);
    }
  };

  const handleDeleteMarca = async () => {
    if (!deleteMarcaConfirm.marca) return;
    try {
      await marcasService.deleteMarca(deleteMarcaConfirm.marca.id);
      toast.success('Marca eliminada');
      setDeleteMarcaConfirm({ open: false });
      revalidateMarcas();
      revalidateProductos();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al eliminar marca');
    }
  };

  const iniciarDeleteMarca = async (marca: MarcaConProductos) => {
    setDeleteMarcaConfirm({ open: true, marca, productosAfectados: marca.total_productos });
  };

  const iniciarEditarMarca = (marca: MarcaConProductos) => {
    setMarcaEditando(marca);
    setMarcaForm(marca.nombre);
    setShowNuevaMarca(false);
  };

  const bajoStock = productos?.filter(p => p.stock <= 3 && p.activo) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto p-4 sm:py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
            {isAdmin && tab === 'catalogo' && (
              <button
                onClick={() => setProductoModal({ open: true, producto: null })}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label="Nuevo producto"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          {bajoStock.length > 0 && (
            <div className="mt-2">
              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full w-fit">
                <AlertTriangle className="w-3 h-3" /> {bajoStock.length} bajo stock
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          {(['catalogo', 'marcas', 'estadisticas'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'catalogo' ? 'Catálogo' : t === 'marcas' ? 'Marcas' : 'Estadísticas'}
            </button>
          ))}
        </div>

        {/* TAB: CATÁLOGO */}
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

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => handleFiltroChange(setBusqueda)(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filtroMarca}
                onChange={e => handleFiltroChange(setFiltroMarca)(e.target.value)}
                className="sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las marcas</option>
                {(marcas || []).map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {loadingProductos ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !productosFiltrados.length ? (
              <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{productos?.length ? 'No hay productos con ese filtro' : 'No hay productos aún'}</p>
                {isAdmin && !productos?.length && <p className="text-sm mt-1">Creá tu primer producto con el botón de arriba</p>}
              </div>
            ) : (
              <>
                {/* Desktop: tabla */}
                <div className="hidden lg:block bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Nombre</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Marca</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Precio</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-700">Stock</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-700">Estado</th>
                        {isAdmin && <th className="text-right px-4 py-3 font-medium text-gray-700">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {productosPagina.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.nombre}</p>
                            {p.descripcion && <p className="text-xs text-gray-400 mt-0.5">{p.descripcion}</p>}
                          </td>
                          <td className="px-4 py-3">
                            {p.marca_nombre
                              ? <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"><Tag className="w-3 h-3" />{p.marca_nombre}</span>
                              : <span className="text-xs text-gray-300">—</span>
                            }
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
                          {isAdmin && (
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
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards */}
                <div className="lg:hidden space-y-3">
                  {productosPagina.map(p => (
                    <Card key={p.id} className="p-0 overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{p.nombre}</p>
                            {p.descripcion && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.descripcion}</p>}
                            {p.marca_nombre && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium mt-1">
                                <Tag className="w-3 h-3" />{p.marca_nombre}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900 shrink-0">
                            ${p.precio.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.stock <= 3 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            Stock: {p.stock}
                          </span>
                          <Badge variant={p.activo ? 'success' : 'default'}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        {isAdmin && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={(e) => toggleActions(p.id, e)}
                              className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800"
                            >
                              Ver acciones
                              <span className="text-xs">{expandedActions.has(p.id) ? '▲' : '▼'}</span>
                            </button>
                            {expandedActions.has(p.id) && (
                              <div className="mt-2 flex flex-col gap-0.5">
                                <button
                                  onClick={() => setStockModal({ open: true, producto: p })}
                                  className="text-left text-sm text-blue-600 hover:text-blue-800 py-1.5 font-medium"
                                >
                                  + Agregar stock
                                </button>
                                <button
                                  onClick={() => setProductoModal({ open: true, producto: p })}
                                  className="text-left text-sm text-gray-700 hover:text-gray-900 py-1.5 font-medium"
                                >
                                  ✎ Editar producto
                                </button>
                                <button
                                  onClick={() => handleToggleActivo(p)}
                                  className={`text-left text-sm py-1.5 font-medium ${
                                    p.activo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'
                                  }`}
                                >
                                  {p.activo ? '✕ Desactivar' : '✓ Activar'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ open: true, producto: p })}
                                  className="text-left text-sm text-red-500 hover:text-red-700 py-1.5 font-medium"
                                >
                                  ✕ Eliminar producto
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-500">
                      {productosFiltrados.length} productos — Página {paginaActual} de {totalPaginas}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={paginaActual === 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          onClick={() => setPagina(n)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            n === paginaActual
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaActual === totalPaginas}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* TAB: MARCAS */}
        {tab === 'marcas' && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                {!showNuevaMarca ? (
                  <Button onClick={() => { setShowNuevaMarca(true); setMarcaEditando(null); setMarcaForm(''); }}>
                    <Plus className="w-4 h-4 mr-1" /> Nueva marca
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={marcaForm}
                      onChange={e => setMarcaForm(e.target.value)}
                      placeholder="Nombre de la marca"
                      onKeyDown={e => e.key === 'Enter' && handleSaveMarca()}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <Button onClick={handleSaveMarca} disabled={savingMarca || !marcaForm.trim()}>
                      {savingMarca ? '...' : 'Crear'}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowNuevaMarca(false); setMarcaForm(''); }}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {loadingMarcas ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !marcas?.length ? (
              <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No hay marcas creadas</p>
                {isAdmin && <p className="text-sm mt-1">Creá tu primera marca con el botón de arriba</p>}
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Marca</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-700">Productos</th>
                      {isAdmin && <th className="text-right px-4 py-3 font-medium text-gray-700">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {marcas.map(m => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {marcaEditando?.id === m.id ? (
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={marcaForm}
                                onChange={e => setMarcaForm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveMarca()}
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <Button onClick={handleSaveMarca} disabled={savingMarca || !marcaForm.trim()} className="py-1">
                                {savingMarca ? '...' : 'Guardar'}
                              </Button>
                              <Button variant="outline" onClick={() => { setMarcaEditando(null); setMarcaForm(''); }} className="py-1">
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                              <Tag className="w-3.5 h-3.5 text-blue-500" />
                              {m.nombre}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                            m.total_productos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {m.total_productos}
                          </span>
                        </td>
                        {isAdmin && marcaEditando?.id !== m.id && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => iniciarEditarMarca(m)}
                                title="Editar"
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => iniciarDeleteMarca(m)}
                                title="Eliminar"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                        {isAdmin && marcaEditando?.id === m.id && <td />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: ESTADÍSTICAS */}
        {tab === 'estadisticas' && (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <>
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
      {isAdmin && productoModal.open && (
        <ProductoModal
          producto={productoModal.producto}
          onClose={() => setProductoModal({ open: false })}
          onSaved={() => { setProductoModal({ open: false }); refresh(); }}
        />
      )}

      {isAdmin && stockModal.open && stockModal.producto && (
        <AgregarStockModal
          producto={stockModal.producto}
          onClose={() => setStockModal({ open: false })}
          onSaved={() => { setStockModal({ open: false }); refresh(); }}
        />
      )}

      {isAdmin && (
        <ConfirmModal
          isOpen={deleteConfirm.open}
          onClose={() => setDeleteConfirm({ open: false })}
          onConfirm={handleDelete}
          title="Eliminar producto"
          message={`¿Estás seguro que querés eliminar <strong>${deleteConfirm.producto?.nombre}</strong>? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      )}

      {isAdmin && (
        <ConfirmModal
          isOpen={deleteMarcaConfirm.open}
          onClose={() => setDeleteMarcaConfirm({ open: false })}
          onConfirm={handleDeleteMarca}
          title="Eliminar marca"
          message={
            deleteMarcaConfirm.productosAfectados
              ? `La marca <strong>${deleteMarcaConfirm.marca?.nombre}</strong> tiene <strong>${deleteMarcaConfirm.productosAfectados} producto(s)</strong> asociado(s). Al eliminarla quedarán sin marca asignada.`
              : `¿Estás seguro que querés eliminar la marca <strong>${deleteMarcaConfirm.marca?.nombre}</strong>?`
          }
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      )}
    </div>
  );
}

export default ProductosPage;
