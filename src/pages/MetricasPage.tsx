import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { metricasService } from '../services/metricas.service';
import { usuarioService } from '../services/usuario.service';
import { MetricasResumenCards } from '../components/metricas/MetricasResumenCards';
import { MetricasEvolucionChart } from '../components/metricas/MetricasEvolucionChart';
import { MetricasEquipoTabla } from '../components/metricas/MetricasEquipoTabla';
import { MetricasClientesNuevos } from '../components/metricas/MetricasClientesNuevos';
import { MetricasComparativa } from '../components/metricas/MetricasComparativa';
import { UsuarioMetricasModal } from '../components/usuarios/UsuarioMetricasModal';
import type { MetricasPeriodo } from '../types/metricas.types';
import type { Usuario } from '../types/usuario.types';

type ModoPeriodo = 'mes' | 'anio';

const toLocalStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const periodoDe = (base: Date, modo: ModoPeriodo): MetricasPeriodo =>
  modo === 'mes'
    ? {
        fecha_desde: toLocalStr(new Date(base.getFullYear(), base.getMonth(), 1)),
        fecha_hasta: toLocalStr(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
      }
    : {
        fecha_desde: `${base.getFullYear()}-01-01`,
        fecha_hasta: `${base.getFullYear()}-12-31`,
      };

function MetricasPage() {
  const [modo, setModo] = useState<ModoPeriodo>('mes');
  const [base, setBase] = useState(() => new Date());
  const [detalleUsuario, setDetalleUsuario] = useState<Usuario | null>(null);

  const periodo = useMemo(() => periodoDe(base, modo), [base, modo]);
  const baseAnterior = useMemo(
    () => modo === 'mes'
      ? new Date(base.getFullYear(), base.getMonth() - 1, 1)
      : new Date(base.getFullYear() - 1, 0, 1),
    [base, modo]
  );
  const periodoAnterior = useMemo(() => periodoDe(baseAnterior, modo), [baseAnterior, modo]);

  const agrupar = modo === 'mes' ? 'dia' : 'mes';
  const etiquetaComparacion = modo === 'mes' ? 'vs mes anterior' : 'vs año anterior';
  const cacheKeyPeriodo = `${modo}-${periodo.fecha_desde}`;

  const now = new Date();
  const esPeriodoActual = modo === 'mes'
    ? base.getFullYear() === now.getFullYear() && base.getMonth() === now.getMonth()
    : base.getFullYear() === now.getFullYear();

  const etiquetaPeriodo = useMemo(() => {
    if (modo === 'anio') return base.getFullYear().toString();
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(base);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [base, modo]);

  const navegar = (direccion: -1 | 1) => {
    setBase(modo === 'mes'
      ? new Date(base.getFullYear(), base.getMonth() + direccion, 1)
      : new Date(base.getFullYear() + direccion, base.getMonth(), 1));
  };

  // Datos del período
  const {
    data: resumen,
    loading: loadingResumen,
    error: errorResumen,
    revalidate: revalidateResumen,
  } = useFetch(
    buildKey(ENTITIES.METRICAS, 'resumen', cacheKeyPeriodo),
    () => metricasService.getResumen(periodo),
    { ttl: TTL.MEDIUM }
  );

  const { data: resumenAnterior } = useFetch(
    buildKey(ENTITIES.METRICAS, 'resumen', `${modo}-${periodoAnterior.fecha_desde}`),
    () => metricasService.getResumen(periodoAnterior),
    { ttl: TTL.MEDIUM }
  );

  const { data: evolucion, loading: loadingEvolucion } = useFetch(
    buildKey(ENTITIES.METRICAS, 'evolucion', cacheKeyPeriodo),
    () => metricasService.getEvolucion(periodo, agrupar),
    { ttl: TTL.MEDIUM }
  );

  const { data: equipo, loading: loadingEquipo } = useFetch(
    buildKey(ENTITIES.METRICAS, 'equipo', cacheKeyPeriodo),
    () => metricasService.getEquipo(periodo),
    { ttl: TTL.MEDIUM }
  );

  const { data: clientesNuevos, loading: loadingClientesNuevos } = useFetch(
    buildKey(ENTITIES.METRICAS, 'clientes-nuevos', cacheKeyPeriodo),
    () => metricasService.getClientesNuevos(periodo),
    { ttl: TTL.MEDIUM }
  );

  const { data: comparativa, loading: loadingComparativa } = useFetch(
    buildKey(ENTITIES.METRICAS, 'comparativa', cacheKeyPeriodo),
    () => metricasService.getComparativa(periodo, agrupar),
    { ttl: TTL.MEDIUM }
  );

  // Lista de usuarios para abrir el modal de detalle por profesional
  const { data: usuariosData } = useFetch(
    buildKey(ENTITIES.USUARIOS, 'metricas'),
    () => usuarioService.getUsuarios(),
    { ttl: TTL.MEDIUM }
  );
  const usuarios: Usuario[] = Array.isArray(usuariosData)
    ? usuariosData
    : Array.isArray((usuariosData as any)?.data)
      ? (usuariosData as any).data
      : [];

  const handleVerDetalle = (profesionalId: string) => {
    const usuario = usuarios.find(u => u.id === profesionalId);
    if (usuario) setDetalleUsuario(usuario);
  };

  if (errorResumen) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="text-sm font-medium">Error de carga</p>
          <p className="text-sm mt-1">No se pudieron cargar las métricas. Por favor, intenta nuevamente.</p>
          <button
            onClick={() => revalidateResumen()}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
        <p className="text-gray-600 mt-2">Análisis del negocio y rendimiento del equipo</p>
      </div>

      {/* Selector de período */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" leftIcon={ChevronLeft} onClick={() => navegar(-1)}>
            Anterior
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-36 text-center">{etiquetaPeriodo}</h2>
          <Button variant="ghost" size="sm" rightIcon={ChevronRight} disabled={esPeriodoActual} onClick={() => navegar(1)}>
            Siguiente
          </Button>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 self-start">
          {(['mes', 'anio'] as ModoPeriodo[]).map((m) => (
            <button
              key={m}
              onClick={() => { setModo(m); setBase(new Date()); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modo === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m === 'mes' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6">
        <MetricasResumenCards
          resumen={resumen ?? {
            total_venta: 0, total_venta_servicios: 0, total_venta_productos: 0, total_pendiente: 0,
            turnos_completados: 0, turnos_cancelados: 0, tasa_cancelacion: 0, ticket_promedio: 0,
            cantidad_productos_vendidos: 0, clientes_activos: 0, clientes_nuevos: 0,
          }}
          resumenAnterior={resumenAnterior ?? null}
          etiquetaComparacion={etiquetaComparacion}
          isLoading={loadingResumen}
        />
      </div>

      {/* Evolución */}
      <div className="mb-6">
        <MetricasEvolucionChart
          datos={evolucion ?? []}
          agrupar={agrupar}
          fechaDesde={periodo.fecha_desde}
          fechaHasta={periodo.fecha_hasta}
          isLoading={loadingEvolucion}
        />
      </div>

      {/* Clientes nuevos y profesional elegido */}
      <div className="mb-6">
        <MetricasClientesNuevos
          data={clientesNuevos ?? null}
          isLoading={loadingClientesNuevos}
        />
      </div>

      {/* Equipo */}
      <div className="mb-6">
        <MetricasEquipoTabla
          equipo={equipo ?? []}
          isLoading={loadingEquipo}
          onVerDetalle={handleVerDetalle}
        />
      </div>

      {/* Comparativa detallada de profesionales */}
      <MetricasComparativa
        comparativa={comparativa ?? []}
        agrupar={agrupar}
        fechaDesde={periodo.fecha_desde}
        fechaHasta={periodo.fecha_hasta}
        isLoading={loadingComparativa}
      />

      {/* Detalle mensual por profesional (reutiliza el modal de Usuarios) */}
      <UsuarioMetricasModal
        usuario={detalleUsuario}
        isOpen={!!detalleUsuario}
        onClose={() => setDetalleUsuario(null)}
      />
    </div>
  );
}

export default MetricasPage;
