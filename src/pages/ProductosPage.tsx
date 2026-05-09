import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, AlertTriangle, TrendingUp, Users, Edit2, PlusCircle, Power, Trash2, Tag, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductosVentasTab } from '../components/productos/ProductosVentasTab';
import { productosService, getRegistroVentas, updateVentaProducto, deleteVentaProducto, getResumenVentas, ResumenTotalesVentas, ResumenProfesional, ResumenProducto } from '../services/productos.service';
import { marcasService } from '../services/marcas.service';
import { usuarioService } from '../services/usuario.service';
import { Producto } from '../types/producto.types';
import { MarcaConProductos } from '../types/marca.types';
import { useFetch } from '../hooks/useFetch';
import { Button, Badge, Spinner, ConfirmModal, Card } from '../components/ui';
import { ProductoModal } from '../components/productos/ProductoModal';
import { AgregarStockModal } from '../components/productos/AgregarStockModal';
import { MarcaModal } from '../components/productos/MarcaModal';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;

function ProductosPage() {
  const toast = useToast();
  const { state } = useAuth();
  const isAdmin = state.roles?.includes('admin');

  // Tabs disponibles según rol
  const availableTabs = isAdmin
    ? (['catalogo', 'marcas', 'estadisticas', 'ventas', 'por-profesional'] as const)
    : (['ventas'] as const);
  type Tab = typeof availableTabs[number];

  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'catalogo' : 'ventas');

  // Si el tab activo no está disponible (ej: staff), forzar a 'ventas'
  useEffect(() => {
    if (!(availableTabs as readonly string[]).includes(activeTab)) {
      setActiveTab('ventas');
    }
  }, [isAdmin]);

  const tabLabels: Record<string, string> = {
    catalogo: 'Catálogo',
    marcas: 'Marcas',
    estadisticas: 'Estadísticas',
    ventas: 'Ventas',
    'por-profesional': 'Por profesional',
  };

  // Catálogo state
  const [productoModal, setProductoModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [stockModal, setStockModal] = useState<{ open: boolean; producto?: Producto | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; producto?: Producto }>({ open: false });
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Marcas state — accordion de apertura única
  const [expandedMarcaId, setExpandedMarcaId] = useState<string | null>(null);
  const toggleMarcaAccordion = (id: string) => {
    setExpandedMarcaId(prev => prev === id ? null : id);
  };
  const [marcaModal, setMarcaModal] = useState<{ open: boolean; marca?: MarcaConProductos | null }>({ open: false });
  const [deleteMarcaConfirm, setDeleteMarcaConfirm] = useState<{ open: boolean; marca?: MarcaConProductos; productosAfectados?: number }>({ open: false });

  // Ventas sub-tab
  const [ventasSubTab, setVentasSubTab] = useState<'resumen' | 'registro'>('resumen');

  // Registro de ventas state
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const hoyStr = hoy.toISOString().split('T')[0];
  const [registroFechaDesde, setRegistroFechaDesde] = useState(primerDiaMes);
  const [registroFechaHasta, setRegistroFechaHasta] = useState(hoyStr);
  const [registroPage, setRegistroPage] = useState(1);
  const [registroData, setRegistroData] = useState<{ rows: any[]; total: number } | null>(null);
  const [registroLoading, setRegistroLoading] = useState(false);
  const [editingVentaId, setEditingVentaId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    vendedor_id: string;
    fecha_venta: string;
    nombre_producto: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
    metodo_pago: string;
  } | null>(null);

  // Resumen ventas (cards + por profesional)
  const [resumenFechaDesde, setResumenFechaDesde] = useState(primerDiaMes);
  const [resumenFechaHasta, setResumenFechaHasta] = useState(hoyStr);
  const [resumenData, setResumenData] = useState<{ totales: ResumenTotalesVentas; por_profesional: ResumenProfesional[]; por_producto: ResumenProducto[] } | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);

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

  const { data: usuarios } = useFetch(
    isAdmin ? 'usuarios:lista' : null,
    () => usuarioService.getUsuarios(),
    { ttl: 300 }
  );

  useEffect(() => {
    if (activeTab === 'ventas' || activeTab === 'por-profesional') {
      if (!resumenData) cargarResumen();
    }
  }, [activeTab]);

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

  // Cargar resumen de ventas
  const cargarResumen = async (fechaDesde = resumenFechaDesde, fechaHasta = resumenFechaHasta) => {
    setResumenLoading(true);
    try {
      const data = await getResumenVentas({ fechaDesde, fechaHasta });
      setResumenData(data);
      // Para staff, el registro usa las mismas fechas
      if (!isAdmin) {
        cargarRegistroConFechas(fechaDesde, fechaHasta, 1);
      }
    } catch {
      toast.error('Error al cargar el resumen de ventas');
    } finally {
      setResumenLoading(false);
    }
  };

  // Cargar registro de ventas (fechaDesde/Hasta opcionales: si no se pasan, usa el estado actual)
  const cargarRegistroConFechas = async (fechaDesde: string, fechaHasta: string, page = 1) => {
    setRegistroLoading(true);
    try {
      const params: Parameters<typeof getRegistroVentas>[0] = {
        fechaDesde,
        fechaHasta,
        page,
        limit: 50,
      };
      if (!isAdmin && state.authUser?.id) params.vendedor_id = state.authUser.id;
      const data = await getRegistroVentas(params);
      setRegistroData(data);
      setRegistroPage(page);
    } catch {
      toast.error('Error al cargar el registro de ventas');
    } finally {
      setRegistroLoading(false);
    }
  };

  const cargarRegistro = (page = 1) =>
    cargarRegistroConFechas(registroFechaDesde, registroFechaHasta, page);

  const handleEditarVenta = (row: any) => {
    setEditingVentaId(row.id);
    setEditForm({
      vendedor_id: row.vendedor_id || '',
      fecha_venta: row.fecha_venta ? row.fecha_venta.split('T')[0] : '',
      nombre_producto: row.nombre_producto || '',
      cantidad: Number(row.cantidad) || 1,
      precio_unitario: Number(row.precio_unitario) || 0,
      precio_total: Number(row.precio_total) || 0,
      metodo_pago: row.metodo_pago || 'efectivo',
    });
  };

  const handleGuardarEdicion = async () => {
    if (!editingVentaId || !editForm) return;
    try {
      await updateVentaProducto(editingVentaId, editForm);
      toast.success('Venta actualizada');
      setEditingVentaId(null);
      setEditForm(null);
      cargarRegistro(registroPage);
    } catch {
      toast.error('Error al actualizar la venta');
    }
  };

  const handleEliminarVenta = async (id: string) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    try {
      await deleteVentaProducto(id);
      toast.success('Venta eliminada');
      cargarRegistro(registroPage);
    } catch {
      toast.error('Error al eliminar la venta');
    }
  };

  const registroTotalPages = registroData ? Math.max(1, Math.ceil(registroData.total / 50)) : 1;

  const bajoStock = productos?.filter(p => p.stock <= 3 && p.activo) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto p-4 sm:py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
            {isAdmin && (activeTab === 'catalogo' || activeTab === 'marcas') && (
              <button
                onClick={() => activeTab === 'catalogo'
                  ? setProductoModal({ open: true, producto: null })
                  : setMarcaModal({ open: true, marca: null })
                }
                className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label={activeTab === 'catalogo' ? 'Nuevo producto' : 'Nueva marca'}
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
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          {availableTabs.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* TAB: CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <>

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
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Ef. / Transf.</th>
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
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            <span className="font-semibold">${Number(p.precio_efectivo || 0).toLocaleString('es-AR')}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="font-semibold">${Number(p.precio_transferencia || 0).toLocaleString('es-AR')}</span>
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
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500">Ef. <span className="font-semibold text-gray-900">${Number(p.precio_efectivo || 0).toLocaleString('es-AR')}</span></p>
                            <p className="text-xs text-gray-500">Tr. <span className="font-semibold text-gray-900">${Number(p.precio_transferencia || 0).toLocaleString('es-AR')}</span></p>
                          </div>
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
        {activeTab === 'marcas' && (
          <div className="space-y-4">
            {loadingMarcas ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !marcas?.length ? (
              <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No hay marcas creadas</p>
                {isAdmin && <p className="text-sm mt-1">Creá tu primera marca con el botón + de arriba</p>}
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
                      <React.Fragment key={m.id}>
                        <tr
                          className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggleMarcaAccordion(m.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                              <Tag className="w-3.5 h-3.5 text-blue-500" />
                              {m.nombre}
                              <span className="text-gray-400 text-xs ml-1">{expandedMarcaId === m.id ? '▲' : '▼'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                              m.total_productos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {m.total_productos}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setMarcaModal({ open: true, marca: m })}
                                  title="Editar"
                                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteMarcaConfirm({ open: true, marca: m, productosAfectados: m.total_productos })}
                                  title="Eliminar"
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                        {expandedMarcaId === m.id && (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={isAdmin ? 3 : 2} className="px-4 py-2">
                              {productos?.filter(p => p.marca_id === m.id).length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">Sin productos asignados a esta marca</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th className="text-left py-1.5 pr-4 font-medium">Producto</th>
                                      <th className="text-center py-1.5 pr-4 font-medium">Stock</th>
                                      <th className="text-right py-1.5 pr-4 font-medium">Precio</th>
                                      <th className="text-center py-1.5 font-medium">Estado</th>
                                      {isAdmin && <th className="text-right py-1.5 font-medium">Acciones</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(productos || []).filter(p => p.marca_id === m.id).map(p => (
                                      <tr key={p.id} className="border-t border-gray-100">
                                        <td className="py-2 pr-4 font-medium text-gray-800">{p.nombre}</td>
                                        <td className="py-2 pr-4 text-center">
                                          <span className={`font-semibold ${p.stock <= 3 ? 'text-red-600' : 'text-gray-700'}`}>
                                            {p.stock}
                                          </span>
                                        </td>
                                        <td className="py-2 pr-4 text-right text-gray-700">
                                          ${Number(p.precio_efectivo ?? 0).toLocaleString('es-AR')}
                                        </td>
                                        <td className="py-2 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                            {p.activo ? 'Activo' : 'Inactivo'}
                                          </span>
                                        </td>
                                        {isAdmin && (
                                          <td className="py-2">
                                            <div className="flex items-center justify-end gap-1">
                                              <button
                                                onClick={() => setStockModal({ open: true, producto: p })}
                                                title="Agregar stock"
                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                              >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => setProductoModal({ open: true, producto: p })}
                                                title="Editar"
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleToggleActivo(p)}
                                                title={p.activo ? 'Desactivar' : 'Activar'}
                                                className={`p-1.5 rounded-lg transition-colors ${p.activo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                              >
                                                <Power className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteConfirm({ open: true, producto: p })}
                                                title="Eliminar"
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: ESTADÍSTICAS */}
        {activeTab === 'estadisticas' && (
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

        {/* TAB: VENTAS */}
        {activeTab === 'ventas' && (
          <div className="space-y-4">
            {/* Filtro de fechas para staff (unificado) */}
            {!isAdmin && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Desde</label>
                  <input
                    type="date"
                    value={resumenFechaDesde}
                    onChange={e => setResumenFechaDesde(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Hasta</label>
                  <input
                    type="date"
                    value={resumenFechaHasta}
                    onChange={e => setResumenFechaHasta(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => cargarResumen(resumenFechaDesde, resumenFechaHasta)}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Filtrar
                </button>
              </div>
            )}

            {/* Cards de ganancia */}
            {resumenData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isAdmin ? (
                  <>
                    <div className="bg-white rounded-xl border p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Ganancia bruta</p>
                      <p className="text-xl font-bold text-gray-900">${Number(resumenData.totales.ganancia_bruta).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Ventas ${Number(resumenData.totales.total_ventas).toLocaleString('es-AR')} − Costo ${Number(resumenData.totales.costo_total).toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Ganancia empresa (neta)</p>
                      <p className="text-xl font-bold text-emerald-600">${Number(resumenData.totales.ganancia_empresa).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Bruta − Comisiones profesionales ${Number(resumenData.totales.ganancia_profesionales).toLocaleString('es-AR')}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white rounded-xl border p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Mi ganancia bruta</p>
                      <p className="text-xl font-bold text-gray-900">${Number(resumenData.totales.ganancia_bruta).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Ventas ${Number(resumenData.totales.total_ventas).toLocaleString('es-AR')} − Costo ${Number(resumenData.totales.costo_total).toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Mi comisión</p>
                      <p className="text-xl font-bold text-blue-600">${Number(resumenData.totales.ganancia_profesionales).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Sobre ${Number(resumenData.totales.total_ventas).toLocaleString('es-AR')} en ventas</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Segmented control */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-4 self-start w-fit">
              <button
                className={`px-4 py-2 text-sm font-medium ${ventasSubTab === 'resumen' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setVentasSubTab('resumen')}
              >
                Resumen por producto
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-l border-gray-200 ${ventasSubTab === 'registro' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                onClick={() => {
                  setVentasSubTab('registro');
                  if (!registroData) {
                    if (isAdmin) cargarRegistro(1);
                    else cargarRegistroConFechas(resumenFechaDesde, resumenFechaHasta, 1);
                  }
                }}
              >
                Registro de ventas
              </button>
            </div>

            {ventasSubTab === 'resumen' && isAdmin && <ProductosVentasTab />}

            {ventasSubTab === 'resumen' && !isAdmin && (
              resumenLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : !resumenData || resumenData.por_producto.length === 0 ? (
                <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Sin ventas en el período seleccionado</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-700">Unidades</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Total ventas</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Ganancia bruta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenData.por_producto.map((p, i) => (
                        <tr key={p.producto_id ?? i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.nombre_producto}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{p.cantidad_total}</td>
                          <td className="px-4 py-3 text-right text-gray-700">${Number(p.total_ventas).toLocaleString('es-AR')}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">${Number(p.ganancia_bruta).toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td className="px-4 py-3 font-bold text-gray-900">Total</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900">
                          {resumenData.por_producto.reduce((s, p) => s + p.cantidad_total, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          ${Number(resumenData.totales.total_ventas).toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          ${Number(resumenData.totales.ganancia_bruta).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}

            {ventasSubTab === 'registro' && (
              <div className="space-y-4">
                {/* Filtros solo para admin (staff usa el filtro unificado de arriba) */}
                {isAdmin && (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-600">Desde</label>
                      <input
                        type="date"
                        value={registroFechaDesde}
                        onChange={e => setRegistroFechaDesde(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-600">Hasta</label>
                      <input
                        type="date"
                        value={registroFechaHasta}
                        onChange={e => setRegistroFechaHasta(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => cargarRegistro(1)}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Filtrar
                    </button>
                  </div>
                )}

                {registroLoading ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : !registroData || registroData.rows.length === 0 ? (
                  <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">Sin ventas en el período seleccionado</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-xl border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Fecha venta</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Profesional</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-700">Cant.</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Precio unit.</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Método</th>
                            {isAdmin && <th className="text-right px-4 py-3 font-medium text-gray-700">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {registroData.rows.map(row => (
                            <React.Fragment key={row.id}>
                              <tr className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                  {row.fecha_venta
                                    ? row.fecha_venta.split('T')[0].split('-').reverse().join('/')
                                    : '—'}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">{row.nombre_producto || '—'}</td>
                                <td className="px-4 py-3 text-gray-600">{row.vendedor_nombre || '—'}</td>
                                <td className="px-4 py-3 text-center">{row.cantidad}</td>
                                <td className="px-4 py-3 text-right">${Number(row.precio_unitario || 0).toLocaleString('es-AR')}</td>
                                <td className="px-4 py-3 text-right font-semibold">${Number(row.precio_total || 0).toLocaleString('es-AR')}</td>
                                <td className="px-4 py-3 text-gray-600 capitalize">{row.metodo_pago || '—'}</td>
                                {isAdmin && (
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => { if (editingVentaId === row.id) { setEditingVentaId(null); setEditForm(null); } else { handleEditarVenta(row); } }}
                                        title="Editar"
                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleEliminarVenta(row.id)}
                                        title="Eliminar"
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {isAdmin && editingVentaId === row.id && editForm && (
                                <tr className="border-b bg-blue-50">
                                  <td colSpan={8} className="px-4 py-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Profesional</label>
                                        <select
                                          value={editForm.vendedor_id}
                                          onChange={e => setEditForm(f => f ? { ...f, vendedor_id: e.target.value } : f)}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          {(usuarios || []).map(u => (
                                            <option key={u.id} value={u.id}>{u.nombre}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Fecha venta</label>
                                        <input
                                          type="date"
                                          value={editForm.fecha_venta}
                                          onChange={e => setEditForm(f => f ? { ...f, fecha_venta: e.target.value } : f)}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Producto</label>
                                        <input
                                          type="text"
                                          value={editForm.nombre_producto}
                                          onChange={e => setEditForm(f => f ? { ...f, nombre_producto: e.target.value } : f)}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Cantidad</label>
                                        <input
                                          type="number"
                                          min={1}
                                          value={editForm.cantidad}
                                          onChange={e => {
                                            const cant = Number(e.target.value);
                                            setEditForm(f => f ? { ...f, cantidad: cant, precio_total: cant * f.precio_unitario } : f);
                                          }}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Precio unitario</label>
                                        <input
                                          type="number"
                                          min={0}
                                          value={editForm.precio_unitario}
                                          onChange={e => {
                                            const pu = Number(e.target.value);
                                            setEditForm(f => f ? { ...f, precio_unitario: pu, precio_total: pu * f.cantidad } : f);
                                          }}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Total (calculado)</label>
                                        <input
                                          type="number"
                                          value={editForm.precio_total}
                                          readOnly
                                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-gray-100 text-gray-700"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-600 block mb-1">Método de pago</label>
                                        <select
                                          value={editForm.metodo_pago}
                                          onChange={e => setEditForm(f => f ? { ...f, metodo_pago: e.target.value } : f)}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="efectivo">Efectivo</option>
                                          <option value="transferencia">Transferencia</option>
                                          <option value="pendiente">Pendiente</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={handleGuardarEdicion}
                                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        onClick={() => { setEditingVentaId(null); setEditForm(null); }}
                                        className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginación */}
                    {registroTotalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {registroData.total} ventas — Página {registroPage} de {registroTotalPages}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => cargarRegistro(registroPage - 1)}
                            disabled={registroPage <= 1}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() => cargarRegistro(registroPage + 1)}
                            disabled={registroPage >= registroTotalPages}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: POR PROFESIONAL */}
        {activeTab === 'por-profesional' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Desde</label>
                <input
                  type="date"
                  value={resumenFechaDesde}
                  onChange={e => setResumenFechaDesde(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={resumenFechaHasta}
                  onChange={e => setResumenFechaHasta(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => cargarResumen(resumenFechaDesde, resumenFechaHasta)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Filtrar
              </button>
            </div>

            {resumenLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !resumenData || resumenData.por_profesional.length === 0 ? (
              <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin ventas en el período seleccionado</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Profesional</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Total ventas</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Ganancia bruta</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-700">% Comisión</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Gana profesional</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Gana empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenData.por_profesional.map(p => (
                      <tr key={p.vendedor_id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${Number(p.total_ventas).toLocaleString('es-AR')}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${Number(p.ganancia_bruta).toLocaleString('es-AR')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            {Number(p.comision_producto)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">${Number(p.ganancia_profesional).toLocaleString('es-AR')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">${Number(p.ganancia_empresa).toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-4 py-3 font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">${Number(resumenData.totales.total_ventas).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">${Number(resumenData.totales.ganancia_bruta).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-bold text-blue-600">${Number(resumenData.totales.ganancia_profesionales).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">${Number(resumenData.totales.ganancia_empresa).toLocaleString('es-AR')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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

      {isAdmin && marcaModal.open && (
        <MarcaModal
          marca={marcaModal.marca}
          onClose={() => setMarcaModal({ open: false })}
          onSaved={() => { setMarcaModal({ open: false }); revalidateMarcas(); }}
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
