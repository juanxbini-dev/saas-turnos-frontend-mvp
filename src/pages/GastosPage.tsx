import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button, Tabs } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { esFalloTokenGastos, gastosService, invalidarCacheGastos } from '../services/gastos.service';
import { toastService } from '../services/toast.service';
import { GastosGate, useGastosGate } from '../components/gastos/GastosGate';
import { GastosSelectorMes } from '../components/gastos/GastosSelectorMes';
import { GastosResumenSimple } from '../components/gastos/GastosResumenSimple';
import { GastosTablaMes } from '../components/gastos/GastosTablaMes';
import { GastosPorRubro } from '../components/gastos/GastosPorRubro';
import { GastosQueEntro } from '../components/gastos/GastosQueEntro';
import { GastosFijosCard } from '../components/gastos/GastosFijosCard';
import { GastosCategoriasCard } from '../components/gastos/GastosCategoriasCard';
import { GastosEvolucionChart } from '../components/gastos/GastosEvolucionChart';
import { GastosCategoriasChart } from '../components/gastos/GastosCategoriasChart';
import { GastosComparativaChart } from '../components/gastos/GastosComparativaChart';
import { EditarGastoModal } from '../components/gastos/EditarGastoModal';
import { GastosRecurrentesModal } from '../components/gastos/GastosRecurrentesModal';
import { GastoRecurrenteFormModal } from '../components/gastos/GastoRecurrenteFormModal';
import { GastosCategoriasModal } from '../components/gastos/GastosCategoriasModal';
import type { GastoFormPreset } from '../components/gastos/GastoFormInline';
import { formatMoneda, periodoActual, sumarMeses } from '../components/gastos/gastos.utils';
import type { GastoMesItem, GastoRecurrente } from '../types/gastos.types';

// Diseño: backend/docs/gastos-superadmin-v3.md
// Pantalla "estilo planilla": todo el mes a la vista agrupado por rubro, tilde
// por fila y por rubro, alta en un panel inline y doble clic para editar en la
// fila. Los gráficos del año viven en su propia pestaña. Nada se cachea en disco.
type Pestania = 'mes' | 'analisis';
const PESTANIAS = [{ id: 'mes', label: 'Mes' }, { id: 'analisis', label: 'Análisis' }];

function GastosContenido() {
  const { bloquear } = useGastosGate();
  const [periodo, setPeriodo] = useState(periodoActual);
  const [pestania, setPestania] = useState<Pestania>('mes');

  // Panel inline de alta: abierto/cerrado + preset (chips, "＋" de fijos). El
  // preset se limpia al cerrar: si no, al reabrir con "＋ Nuevo gasto" el form
  // se montaría de nuevo con el último chip puesto y se duplicaría el fijo.
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [preset, setPreset] = useState<{ valor: GastoFormPreset | null; nonce: number }>({ valor: null, nonce: 0 });

  const [editando, setEditando] = useState<{ item: GastoMesItem; esRecurrente: boolean } | null>(null);
  const [aEliminar, setAEliminar] = useState<GastoMesItem | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [recurrentesAbierto, setRecurrentesAbierto] = useState(false);
  const [plantilla, setPlantilla] = useState<GastoRecurrente | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);

  const cacheOpts = { ttl: TTL.SHORT, persist: false };
  const evolucionDesde = sumarMeses(periodo, -11);

  const { data: mes, loading: loadingMes, error: errorMes, revalidate: revalidarMes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'mes', periodo), () => gastosService.getMes(periodo), cacheOpts);
  const { data: resumen, loading: loadingResumen, error: errorResumen, revalidate: revalidarResumen } = useFetch(
    buildKey(ENTITIES.GASTOS, 'resumen', periodo), () => gastosService.getResumen(periodo), cacheOpts);
  const { data: detalle, loading: loadingDetalle, revalidate: revalidarDetalle } = useFetch(
    buildKey(ENTITIES.GASTOS, 'detalle', periodo), () => gastosService.getDetalle(periodo), cacheOpts);
  const { data: evolucion, loading: loadingEvolucion, revalidate: revalidarEvolucion } = useFetch(
    buildKey(ENTITIES.GASTOS, 'evolucion', evolucionDesde, periodo), () => gastosService.getEvolucion(evolucionDesde, periodo), cacheOpts);
  const { data: porCategoria, loading: loadingPorCategoria, revalidate: revalidarPorCategoria } = useFetch(
    buildKey(ENTITIES.GASTOS, 'por-categoria', periodo), () => gastosService.getPorCategoria(periodo), cacheOpts);
  const { data: categorias, loading: loadingCategorias, revalidate: revalidarCategorias } = useFetch(
    buildKey(ENTITIES.GASTOS, 'categorias'), () => gastosService.getCategorias(), cacheOpts);
  const { data: recurrentes, loading: loadingRecurrentes, revalidate: revalidarRecurrentes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'recurrentes'), () => gastosService.getRecurrentes(), cacheOpts);

  const refrescarTodo = useCallback(() => {
    invalidarCacheGastos();
    revalidarMes(); revalidarResumen(); revalidarDetalle(); revalidarEvolucion();
    revalidarPorCategoria(); revalidarCategorias(); revalidarRecurrentes();
  }, [revalidarMes, revalidarResumen, revalidarDetalle, revalidarEvolucion, revalidarPorCategoria, revalidarCategorias, revalidarRecurrentes]);

  // Errores de carga de lo esencial (mes y resumen). Sin esto, useFetch deja
  // data=null y la tabla mostraría el skeleton para siempre.
  //   - Token de la sección vencido (401/403 GASTOS_TOKEN_*): no lo resuelve
  //     ningún interceptor ni evento global —el de axiosInstance solo reintenta
  //     una vez tras refrescar el JWT—, así que se delega en GastosGate, que
  //     tira el token y vuelve a pedir la contraseña.
  //   - Cualquier otro error: aviso con "Reintentar" en lugar del skeleton.
  const errorCarga = errorMes ?? errorResumen;
  const tokenVencido = esFalloTokenGastos(errorMes) || esFalloTokenGastos(errorResumen);
  useEffect(() => {
    if (tokenVencido) bloquear();
  }, [tokenVencido, bloquear]);

  const abrirPanel = (valor?: GastoFormPreset) => {
    setPestania('mes');
    setPanelAbierto(true);
    setPreset((p) => ({ valor: valor ?? null, nonce: p.nonce + 1 }));
  };

  const cerrarPanel = () => {
    setPanelAbierto(false);
    setPreset((p) => ({ valor: null, nonce: p.nonce }));
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      {/* Cabecera: título, pestañas y mes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
        <GastosSelectorMes periodo={periodo} onChange={setPeriodo} />
      </div>
      <Tabs tabs={PESTANIAS} activeTab={pestania} onChange={(id) => setPestania(id as Pestania)} className="!mb-2" />

      {errorCarga && !tokenVencido ? (
        <div className="bg-white border border-red-200 rounded-xl p-6 flex flex-col items-center text-center gap-3" role="alert">
          <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900">No se pudieron cargar los gastos</p>
          <p className="text-xs text-gray-500">Revisá la conexión y probá de nuevo.</p>
          <Button size="sm" onClick={refrescarTodo}>Reintentar</Button>
        </div>
      ) : pestania === 'mes' ? (
        <div className="space-y-4">
          <GastosResumenSimple resumen={resumen ?? null} detalle={detalle ?? null} isLoading={loadingResumen} />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <section className="min-w-0" aria-label="Gastos del mes">
              <GastosTablaMes
                mes={mes ?? null}
                detalle={detalle ?? null}
                periodo={periodo}
                categorias={categorias ?? []}
                categoriasCargando={loadingCategorias}
                isLoading={loadingMes}
                panelAbierto={panelAbierto}
                onTogglePanel={() => (panelAbierto ? cerrarPanel() : abrirPanel())}
                onAbrirPanel={abrirPanel}
                preset={preset.valor}
                presetNonce={preset.nonce}
                onEditar={(item, esRecurrente) => setEditando({ item, esRecurrente })}
                onEliminarUnico={setAEliminar}
                onCambio={refrescarTodo}
              />
            </section>
            <aside className="min-w-0 space-y-4">
              <GastosPorRubro porCategoria={porCategoria ?? []} isLoading={loadingPorCategoria} />
              <GastosQueEntro detalle={detalle ?? null} isLoading={loadingDetalle} />
              <GastosFijosCard
                recurrentes={recurrentes ?? []}
                isLoading={loadingRecurrentes}
                onNuevo={() => abrirPanel({ repite: true, foco: 'nombre' })}
                onEditar={setPlantilla}
                onVerTodos={() => setRecurrentesAbierto(true)}
              />
              <GastosCategoriasCard
                categorias={categorias ?? []}
                isLoading={loadingCategorias}
                onCambio={refrescarTodo}
                onAbrirModal={() => setCategoriasAbierto(true)}
              />
            </aside>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <GastosEvolucionChart datos={evolucion ?? []} periodoActual={periodo} isLoading={loadingEvolucion} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GastosCategoriasChart datos={porCategoria ?? []} isLoading={loadingPorCategoria} />
            <GastosComparativaChart datos={porCategoria ?? []} periodo={periodo} isLoading={loadingPorCategoria} />
          </div>
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Acumulado del año</h3>
            {loadingResumen || !resumen ? (
              <div className="h-16 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Gastos en lo que va del año</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{formatMoneda(resumen.acumulado_anio)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Promedio por mes</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{formatMoneda(resumen.promedio_mensual_anio)}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modales que se conservan de la v2 */}
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
        onNuevo={() => { setRecurrentesAbierto(false); abrirPanel({ repite: true, foco: 'nombre' }); }}
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
