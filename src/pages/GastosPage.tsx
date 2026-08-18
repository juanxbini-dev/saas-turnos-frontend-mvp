import { useCallback, useState } from 'react';
import { Tags } from 'lucide-react';
import { Button } from '../components/ui';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { gastosService, invalidarCacheGastos } from '../services/gastos.service';
import { toastService } from '../services/toast.service';
import { GastosGate } from '../components/gastos/GastosGate';
import { GastosSelectorMes } from '../components/gastos/GastosSelectorMes';
import { GastosResumenCards } from '../components/gastos/GastosResumenCards';
import { GastosEvolucionChart } from '../components/gastos/GastosEvolucionChart';
import { GastosCategoriasChart } from '../components/gastos/GastosCategoriasChart';
import { GastosComparativaChart } from '../components/gastos/GastosComparativaChart';
import { GastosTablaMes } from '../components/gastos/GastosTablaMes';
import { GastoFormModal } from '../components/gastos/GastoFormModal';
import { GastoRecurrenteFormModal } from '../components/gastos/GastoRecurrenteFormModal';
import { GastoOverrideModal } from '../components/gastos/GastoOverrideModal';
import { GastosCategoriasModal } from '../components/gastos/GastosCategoriasModal';
import { GastosRecurrentesModal } from '../components/gastos/GastosRecurrentesModal';
import { periodoActual, sumarMeses } from '../components/gastos/gastos.utils';
import type { GastoMesItem, GastoRecurrente } from '../types/gastos.types';

// Diseño: backend/docs/gastos-superadmin.md
// La sección está detrás de dos llaves: la sesión de super admin (SuperAdminRoute)
// y la contraseña de la sección (GastosGate). Nada de acá se cachea en localStorage.
function GastosContenido() {
  const [periodo, setPeriodo] = useState(periodoActual);

  // Modales
  const [formUnico, setFormUnico] = useState<{ abierto: boolean; gasto: GastoMesItem | null }>({ abierto: false, gasto: null });
  const [formRecurrente, setFormRecurrente] = useState<{ abierto: boolean; recurrente: GastoRecurrente | null }>({ abierto: false, recurrente: null });
  const [override, setOverride] = useState<GastoMesItem | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);
  const [recurrentesAbierto, setRecurrentesAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<GastoMesItem | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Datos: TTL corto y sin persistir (datos sensibles, no van a localStorage)
  const cacheOpts = { ttl: TTL.SHORT, persist: false };
  const evolucionDesde = sumarMeses(periodo, -11);

  const { data: mes, loading: loadingMes, revalidate: revalidarMes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'mes', periodo),
    () => gastosService.getMes(periodo),
    cacheOpts
  );
  const { data: resumen, loading: loadingResumen, revalidate: revalidarResumen } = useFetch(
    buildKey(ENTITIES.GASTOS, 'resumen', periodo),
    () => gastosService.getResumen(periodo),
    cacheOpts
  );
  const { data: evolucion, loading: loadingEvolucion, revalidate: revalidarEvolucion } = useFetch(
    buildKey(ENTITIES.GASTOS, 'evolucion', evolucionDesde, periodo),
    () => gastosService.getEvolucion(evolucionDesde, periodo),
    cacheOpts
  );
  const { data: porCategoria, loading: loadingCategorias, revalidate: revalidarPorCategoria } = useFetch(
    buildKey(ENTITIES.GASTOS, 'por-categoria', periodo),
    () => gastosService.getPorCategoria(periodo),
    cacheOpts
  );
  const { data: categorias, revalidate: revalidarCategorias } = useFetch(
    buildKey(ENTITIES.GASTOS, 'categorias'),
    () => gastosService.getCategorias(),
    cacheOpts
  );
  const { data: recurrentes, revalidate: revalidarRecurrentes } = useFetch(
    buildKey(ENTITIES.GASTOS, 'recurrentes'),
    () => gastosService.getRecurrentes(),
    cacheOpts
  );

  // Cualquier cambio invalida todo el prefijo y refresca lo que está en pantalla
  const refrescarTodo = useCallback(() => {
    invalidarCacheGastos();
    revalidarMes();
    revalidarResumen();
    revalidarEvolucion();
    revalidarPorCategoria();
    revalidarCategorias();
    revalidarRecurrentes();
  }, [revalidarMes, revalidarResumen, revalidarEvolucion, revalidarPorCategoria, revalidarCategorias, revalidarRecurrentes]);

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

  const abrirEdicionPlantilla = (r: GastoRecurrente) => {
    setRecurrentesAbierto(false);
    setFormRecurrente({ abierto: true, recurrente: r });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
          <p className="text-gray-600 mt-2">Control de gastos de la peluquería mes a mes</p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={Tags} onClick={() => setCategoriasAbierto(true)}>
          Categorías
        </Button>
      </div>

      {/* Selector de mes */}
      <div className="mb-6">
        <GastosSelectorMes periodo={periodo} onChange={setPeriodo} />
      </div>

      {/* KPIs */}
      <div className="mb-6">
        <GastosResumenCards resumen={resumen ?? null} isLoading={loadingResumen} />
      </div>

      {/* Evolución 12 meses */}
      <div className="mb-6">
        <GastosEvolucionChart datos={evolucion ?? []} periodoActual={periodo} isLoading={loadingEvolucion} />
      </div>

      {/* Reparto y comparativa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GastosCategoriasChart datos={porCategoria ?? []} isLoading={loadingCategorias} />
        <GastosComparativaChart datos={porCategoria ?? []} periodo={periodo} isLoading={loadingCategorias} />
      </div>

      {/* Detalle del mes */}
      <GastosTablaMes
        mes={mes ?? null}
        isLoading={loadingMes}
        onNuevoUnico={() => setFormUnico({ abierto: true, gasto: null })}
        onEditarUnico={(item) => setFormUnico({ abierto: true, gasto: item })}
        onEliminarUnico={setAEliminar}
        onNuevoRecurrente={() => setFormRecurrente({ abierto: true, recurrente: null })}
        onEditarMesRecurrente={setOverride}
        onGestionarRecurrentes={() => setRecurrentesAbierto(true)}
      />

      {/* Modales */}
      <GastoFormModal
        isOpen={formUnico.abierto}
        onClose={() => setFormUnico({ abierto: false, gasto: null })}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        gasto={formUnico.gasto}
      />
      <GastoRecurrenteFormModal
        isOpen={formRecurrente.abierto}
        onClose={() => setFormRecurrente({ abierto: false, recurrente: null })}
        onGuardado={refrescarTodo}
        periodo={periodo}
        categorias={categorias ?? []}
        recurrente={formRecurrente.recurrente}
      />
      <GastoOverrideModal
        isOpen={!!override}
        onClose={() => setOverride(null)}
        onGuardado={refrescarTodo}
        periodo={periodo}
        item={override}
      />
      <GastosCategoriasModal
        isOpen={categoriasAbierto}
        onClose={() => setCategoriasAbierto(false)}
        categorias={categorias ?? []}
        onCambio={refrescarTodo}
      />
      <GastosRecurrentesModal
        isOpen={recurrentesAbierto}
        onClose={() => setRecurrentesAbierto(false)}
        recurrentes={recurrentes ?? []}
        periodo={periodo}
        onEditar={abrirEdicionPlantilla}
        onNuevo={() => { setRecurrentesAbierto(false); setFormRecurrente({ abierto: true, recurrente: null }); }}
        onCambio={refrescarTodo}
      />
      <ConfirmDialog
        isOpen={!!aEliminar}
        onClose={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={eliminando}
        title="Eliminar gasto"
        message={`¿Eliminar "${aEliminar?.nombre}"? Esta acción no se puede deshacer.`}
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
