import { useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { gastosService, invalidarCacheGastos } from '../services/gastos.service';
import { toastService } from '../services/toast.service';
import { GastosGate } from '../components/gastos/GastosGate';
import { GastosSelectorMes } from '../components/gastos/GastosSelectorMes';
import { GastosResumenSimple } from '../components/gastos/GastosResumenSimple';
import { GastosListaMes } from '../components/gastos/GastosListaMes';
import { GastosDetalleAutomatico } from '../components/gastos/GastosDetalleAutomatico';
import { GastosAnalisis } from '../components/gastos/GastosAnalisis';
import { AgregarGastoModal } from '../components/gastos/AgregarGastoModal';
import { EditarGastoModal } from '../components/gastos/EditarGastoModal';
import { GastosRecurrentesModal } from '../components/gastos/GastosRecurrentesModal';
import { GastoRecurrenteFormModal } from '../components/gastos/GastoRecurrenteFormModal';
import { GastosCategoriasModal } from '../components/gastos/GastosCategoriasModal';
import { periodoActual, sumarMeses } from '../components/gastos/gastos.utils';
import type { GastoMesItem, GastoRecurrente } from '../types/gastos.types';

// Diseño: backend/docs/gastos-superadmin.md
// Pantalla pensada para el dueño, no para un analista: tres números arriba, la
// lista del mes en el centro, un solo botón para agregar, y los gráficos
// plegados abajo. Nada de acá se cachea en localStorage.
function GastosContenido() {
  const [periodo, setPeriodo] = useState(periodoActual);

  const [agregar, setAgregar] = useState<{ abierto: boolean; sugerido: { nombre: string; categoria: string; dia?: number } | null }>({ abierto: false, sugerido: null });
  const [editando, setEditando] = useState<{ item: GastoMesItem; esRecurrente: boolean } | null>(null);
  const [aEliminar, setAEliminar] = useState<GastoMesItem | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [recurrentesAbierto, setRecurrentesAbierto] = useState(false);
  const [plantilla, setPlantilla] = useState<GastoRecurrente | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);

  const cacheOpts = { ttl: TTL.SHORT, persist: false };
  const evolucionDesde = sumarMeses(periodo, -11);

  const { data: mes, loading: loadingMes, revalidate: revalidarMes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'mes', periodo), () => gastosService.getMes(periodo), cacheOpts);
  const { data: resumen, loading: loadingResumen, revalidate: revalidarResumen } = useFetch(
    buildKey(ENTITIES.GASTOS, 'resumen', periodo), () => gastosService.getResumen(periodo), cacheOpts);
  const { data: detalle, loading: loadingDetalle, revalidate: revalidarDetalle } = useFetch(
    buildKey(ENTITIES.GASTOS, 'detalle', periodo), () => gastosService.getDetalle(periodo), cacheOpts);
  const { data: evolucion, loading: loadingEvolucion, revalidate: revalidarEvolucion } = useFetch(
    buildKey(ENTITIES.GASTOS, 'evolucion', evolucionDesde, periodo), () => gastosService.getEvolucion(evolucionDesde, periodo), cacheOpts);
  const { data: porCategoria, loading: loadingCategorias, revalidate: revalidarPorCategoria } = useFetch(
    buildKey(ENTITIES.GASTOS, 'por-categoria', periodo), () => gastosService.getPorCategoria(periodo), cacheOpts);
  const { data: categorias, revalidate: revalidarCategorias } = useFetch(
    buildKey(ENTITIES.GASTOS, 'categorias'), () => gastosService.getCategorias(), cacheOpts);
  const { data: recurrentes, revalidate: revalidarRecurrentes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'recurrentes'), () => gastosService.getRecurrentes(), cacheOpts);

  const refrescarTodo = useCallback(() => {
    invalidarCacheGastos();
    revalidarMes(); revalidarResumen(); revalidarDetalle(); revalidarEvolucion();
    revalidarPorCategoria(); revalidarCategorias(); revalidarRecurrentes();
  }, [revalidarMes, revalidarResumen, revalidarDetalle, revalidarEvolucion, revalidarPorCategoria, revalidarCategorias, revalidarRecurrentes]);

  // Tildar "pagado" es la acción más frecuente: un click, sin abrir nada
  const togglePagado = async (item: GastoMesItem, esRecurrente: boolean) => {
    const nuevoEstado = item.estado === 'pagado' ? 'pendiente' : 'pagado';
    try {
      if (esRecurrente) {
        await gastosService.guardarOverride(item.recurrente_id!, periodo, { estado: nuevoEstado });
      } else {
        await gastosService.actualizarGasto(item.id, { estado: nuevoEstado });
      }
      refrescarTodo();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo cambiar el estado');
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      await gastosService.eliminarGasto(aEliminar.id);
      toastService.success('Gasto eliminado');
      setAEliminar(null);
      refrescarTodo();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabecera: título + mes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
        <GastosSelectorMes periodo={periodo} onChange={setPeriodo} />
      </div>

      {/* Tres números */}
      <GastosResumenSimple resumen={resumen ?? null} isLoading={loadingResumen} />

      {/* La lista del mes: el centro de la pantalla */}
      <GastosListaMes
        mes={mes ?? null}
        periodo={periodo}
        isLoading={loadingMes}
        onAgregar={(sugerido) => setAgregar({ abierto: true, sugerido: sugerido ?? null })}
        onEditar={(item, esRecurrente) => setEditando({ item, esRecurrente })}
        onEliminarUnico={setAEliminar}
        onTogglePagado={togglePagado}
        onVerRecurrentes={() => setRecurrentesAbierto(true)}
      />

      {/* Qué entró y qué salió solo: la explicación de los números automáticos */}
      <GastosDetalleAutomatico detalle={detalle ?? null} isLoading={loadingDetalle} />

      {/* Gráficos, plegados */}
      <GastosAnalisis
        periodo={periodo}
        evolucion={evolucion ?? []}
        porCategoria={porCategoria ?? []}
        loadingEvolucion={loadingEvolucion}
        loadingCategorias={loadingCategorias}
      />

      {/* Modales */}
      <AgregarGastoModal
        isOpen={agregar.abierto}
        onClose={() => setAgregar({ abierto: false, sugerido: null })}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        sugerido={agregar.sugerido}
      />
      <EditarGastoModal
        isOpen={!!editando}
        onClose={() => setEditando(null)}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        item={editando?.item ?? null}
        esRecurrente={editando?.esRecurrente ?? false}
      />
      <GastosRecurrentesModal
        isOpen={recurrentesAbierto}
        onClose={() => setRecurrentesAbierto(false)}
        recurrentes={recurrentes ?? []}
        periodo={periodo}
        onEditar={(r) => { setRecurrentesAbierto(false); setPlantilla(r); }}
        onNuevo={() => { setRecurrentesAbierto(false); setAgregar({ abierto: true, sugerido: null }); }}
        onCategorias={() => { setRecurrentesAbierto(false); setCategoriasAbierto(true); }}
        onCambio={refrescarTodo}
      />
      <GastoRecurrenteFormModal
        isOpen={!!plantilla}
        onClose={() => setPlantilla(null)}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        recurrente={plantilla}
      />
      <GastosCategoriasModal
        isOpen={categoriasAbierto}
        onClose={() => setCategoriasAbierto(false)}
        categorias={categorias ?? []}
        onCambio={refrescarTodo}
      />
      <ConfirmDialog
        isOpen={!!aEliminar}
        onClose={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={eliminando}
        title="Eliminar gasto"
        message={`¿Eliminar "${aEliminar?.nombre}"? No se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  );
}

function GastosPage() {
  return (
    <GastosGate>
      <GastosContenido />
    </GastosGate>
  );
}

export default GastosPage;
