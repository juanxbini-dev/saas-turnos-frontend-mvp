import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { GastosPorProfesional } from '../components/gastos/GastosPorProfesional';
import { AvisoCambioGanancias } from '../components/gastos/AvisoCambioGanancias';
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
import { filtrarPorTipo, formatMoneda, limpiarPorCategoria, periodoActual, sumarMeses, TEXTOS_MODO, tipoDeFijo } from '../components/gastos/gastos.utils';
import type { GastoMesItem, GastoRecurrente, GastoTipo } from '../types/gastos.types';

// Diseño: backend/docs/gastos-superadmin-v3.md
// Pantalla "estilo planilla": todo el mes a la vista agrupado por rubro, tilde
// por fila y por rubro, alta en un panel inline y doble clic para editar en la
// fila. Los gráficos del año viven en su propia pestaña. Nada se cachea en disco.
// Ingresos (gastos-ingresos-plan): una segunda tabla con los mismos componentes
// en modo 'ingreso' (fijos + únicos cargados a mano en categorías de ingreso).

// Estado del panel inline de alta de una de las dos tablas
interface PanelAlta {
  abierto: boolean;
  preset: GastoFormPreset | null;
  nonce: number;
}
const PANEL_CERRADO: PanelAlta = { abierto: false, preset: null, nonce: 0 };
type Pestania = 'mes' | 'analisis';
const PESTANIAS = [{ id: 'mes', label: 'Mes' }, { id: 'analisis', label: 'Análisis' }];

function GastosContenido() {
  const { bloquear } = useGastosGate();
  const [periodo, setPeriodo] = useState(periodoActual);
  const [pestania, setPestania] = useState<Pestania>('mes');

  // Panel inline de alta, uno por tabla (gastos e ingresos): abierto/cerrado +
  // preset (chips, "＋" de fijos). El preset se limpia al cerrar: si no, al
  // reabrir con "＋ Nuevo gasto" el form se montaría de nuevo con el último chip
  // puesto y se duplicaría el fijo.
  const [paneles, setPaneles] = useState<Record<GastoTipo, PanelAlta>>({ gasto: PANEL_CERRADO, ingreso: PANEL_CERRADO });

  const [editando, setEditando] = useState<{ item: GastoMesItem; esRecurrente: boolean; modo: GastoTipo } | null>(null);
  const [aEliminar, setAEliminar] = useState<{ item: GastoMesItem; modo: GastoTipo } | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [recurrentesAbierto, setRecurrentesAbierto] = useState<GastoTipo | null>(null);
  const [plantilla, setPlantilla] = useState<GastoRecurrente | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);

  const cacheOpts = { ttl: TTL.SHORT, persist: false };
  const evolucionDesde = sumarMeses(periodo, -11);

  const { data: mes, loading: loadingMes, error: errorMes, revalidate: revalidarMes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'mes', periodo), () => gastosService.getMes(periodo), cacheOpts);
  const { data: resumen, loading: loadingResumen, error: errorResumen, revalidate: revalidarResumen } = useFetch(
    buildKey(ENTITIES.GASTOS, 'resumen', periodo), () => gastosService.getResumen(periodo), cacheOpts);
  const { data: detalle, loading: loadingDetalle, error: errorDetalle, revalidate: revalidarDetalle } = useFetch(
    buildKey(ENTITIES.GASTOS, 'detalle', periodo), () => gastosService.getDetalle(periodo), cacheOpts);
  const { data: evolucion, loading: loadingEvolucion, revalidate: revalidarEvolucion } = useFetch(
    buildKey(ENTITIES.GASTOS, 'evolucion', evolucionDesde, periodo), () => gastosService.getEvolucion(evolucionDesde, periodo), cacheOpts);
  const { data: porCategoria, loading: loadingPorCategoria, revalidate: revalidarPorCategoria } = useFetch(
    buildKey(ENTITIES.GASTOS, 'por-categoria', periodo), () => gastosService.getPorCategoria(periodo), cacheOpts);
  const { data: categorias, loading: loadingCategorias, revalidate: revalidarCategorias } = useFetch(
    buildKey(ENTITIES.GASTOS, 'categorias'), () => gastosService.getCategorias(), cacheOpts);
  const { data: recurrentes, loading: loadingRecurrentes, revalidate: revalidarRecurrentes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'recurrentes'), () => gastosService.getRecurrentes(), cacheOpts);

  // Sin mercadería y con el rubro automático renombrado, para la barra por
  // rubro, el donut y la comparativa (gastos-ganancias-spec §4.6)
  const rubros = useMemo(() => limpiarPorCategoria(porCategoria ?? []), [porCategoria]);
  // GET /recurrentes trae los fijos de los dos tipos: cada tarjeta, los suyos
  const fijosGasto = useMemo(() => filtrarPorTipo(recurrentes ?? [], 'gasto'), [recurrentes]);
  const fijosIngreso = useMemo(() => filtrarPorTipo(recurrentes ?? [], 'ingreso'), [recurrentes]);

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

  const abrirPanel = (modo: GastoTipo, valor?: GastoFormPreset) => {
    setPestania('mes');
    setPaneles((ps) => ({ ...ps, [modo]: { abierto: true, preset: valor ?? null, nonce: ps[modo].nonce + 1 } }));
  };

  const cerrarPanel = (modo: GastoTipo) => {
    setPaneles((ps) => ({ ...ps, [modo]: { ...ps[modo], abierto: false, preset: null } }));
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      await gastosService.eliminarGasto(aEliminar.item.id);
      toastService.success(`${TEXTOS_MODO[aEliminar.modo].Singular} eliminado`);
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
      <AvisoCambioGanancias />
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
          <GastosPorProfesional
            detalle={detalle ?? null}
            isLoading={loadingDetalle}
            error={esFalloTokenGastos(errorDetalle) ? null : errorDetalle}
            onReintentar={revalidarDetalle}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              {(['gasto', 'ingreso'] as const).map((modo) => (
                <section key={modo} className="min-w-0" aria-label={`${TEXTOS_MODO[modo].Plural} del mes`}>
                  <GastosTablaMes
                    modo={modo}
                    mes={mes ?? null}
                    periodo={periodo}
                    categorias={categorias ?? []}
                    categoriasCargando={loadingCategorias}
                    isLoading={loadingMes}
                    panelAbierto={paneles[modo].abierto}
                    onTogglePanel={() => (paneles[modo].abierto ? cerrarPanel(modo) : abrirPanel(modo))}
                    onAbrirPanel={(valor) => abrirPanel(modo, valor)}
                    preset={paneles[modo].preset}
                    presetNonce={paneles[modo].nonce}
                    onEditar={(item, esRecurrente) => setEditando({ item, esRecurrente, modo })}
                    onEliminarUnico={(item) => setAEliminar({ item, modo })}
                    onCambio={refrescarTodo}
                  />
                </section>
              ))}
            </div>
            <aside className="min-w-0 space-y-4">
              <GastosPorRubro porCategoria={rubros} isLoading={loadingPorCategoria} />
              <GastosQueEntro detalle={detalle ?? null} isLoading={loadingDetalle} />
              <GastosFijosCard
                recurrentes={fijosGasto}
                isLoading={loadingRecurrentes}
                onNuevo={() => abrirPanel('gasto', { repite: true, foco: 'nombre' })}
                onEditar={setPlantilla}
                onVerTodos={() => setRecurrentesAbierto('gasto')}
              />
              {/* Solo si hay alguno: los ingresos fijos se dan de alta desde la tabla de Ingresos */}
              {fijosIngreso.length > 0 && (
                <GastosFijosCard
                  modo="ingreso"
                  recurrentes={fijosIngreso}
                  isLoading={loadingRecurrentes}
                  onNuevo={() => abrirPanel('ingreso', { repite: true, foco: 'nombre' })}
                  onEditar={setPlantilla}
                  onVerTodos={() => setRecurrentesAbierto('ingreso')}
                />
              )}
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
            <GastosCategoriasChart datos={rubros} isLoading={loadingPorCategoria} />
            <GastosComparativaChart datos={rubros} periodo={periodo} isLoading={loadingPorCategoria} />
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
        modo={editando?.modo ?? 'gasto'}
      />
      <GastosRecurrentesModal
        isOpen={recurrentesAbierto !== null}
        onClose={() => setRecurrentesAbierto(null)}
        modo={recurrentesAbierto ?? 'gasto'}
        recurrentes={recurrentesAbierto === 'ingreso' ? fijosIngreso : fijosGasto}
        periodo={periodo}
        onEditar={(r) => { setRecurrentesAbierto(null); setPlantilla(r); }}
        onNuevo={() => { const modo = recurrentesAbierto ?? 'gasto'; setRecurrentesAbierto(null); abrirPanel(modo, { repite: true, foco: 'nombre' }); }}
        onCategorias={() => { setRecurrentesAbierto(null); setCategoriasAbierto(true); }}
        onCambio={refrescarTodo}
      />
      <GastoRecurrenteFormModal
        isOpen={!!plantilla}
        onClose={() => setPlantilla(null)}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        recurrente={plantilla}
        modo={plantilla ? tipoDeFijo(plantilla) : 'gasto'}
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
        title={`Eliminar ${TEXTOS_MODO[aEliminar?.modo ?? 'gasto'].singular}`}
        message={`¿Eliminar "${aEliminar?.item.nombre}"? No se puede deshacer.`}
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
