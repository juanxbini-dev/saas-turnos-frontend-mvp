import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useNavegacionPestanias } from '../hooks/useNavegacionPestanias';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { campaniasService } from '../services/campanias.service';
import { CampaniasGate, useBloqueoPorToken } from '../components/campanias/CampaniasGate';
import { CampaniaEstadoCard } from '../components/campanias/CampaniaEstadoCard';
import { CampaniaConfigForm } from '../components/campanias/CampaniaConfigForm';
import { CampaniaVistaPrevia } from '../components/campanias/CampaniaVistaPrevia';
import { CampaniaHistorial } from '../components/campanias/CampaniaHistorial';
import { CampaniaMetricas } from '../components/campanias/CampaniaMetricas';
import type { Campania, CampaniaTipo } from '../types/campanias.types';

// Diseño: backend/docs/campanias-n8n-spec.md §4
// Solo super_admin + contraseña de la sección (mismo patrón que Gastos). Cada
// sección pide lo suyo y falla por separado: un error en el historial no tapa
// la tarjeta de encendido. La tarjeta y la configuración comparten un único
// pedido porque muestran el mismo recurso (GET /api/campanias/recencia).
//
// El tipo de campaña se define UNA vez, acá: las secciones lo reciben como prop
// (o lo leen de la campaña que les llega). Sumar otra campaña es sumar otro
// <CampaniaPanel tipo="…" />, sin tocar los componentes.
interface CampaniaPanelProps {
  tipo: CampaniaTipo;
}

function CampaniaPanel({ tipo }: CampaniaPanelProps) {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.CAMPANIAS, tipo, 'config'),
    () => campaniasService.getCampania(tipo),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  // El PATCH responde con la campaña ya actualizada: se muestra al instante y
  // se suelta cuando llega la revalidación.
  const [recienGuardada, setRecienGuardada] = useState<Campania | null>(null);
  useEffect(() => { setRecienGuardada(null); }, [data]);

  // Cualquier cambio de la campaña recalcula la vista previa al instante
  const [refresco, setRefresco] = useState(0);

  const handleCambio = useCallback((actualizada: Campania) => {
    setRecienGuardada(actualizada);
    setRefresco((n) => n + 1);
    revalidate();
  }, [revalidate]);

  const campania = recienGuardada ?? data ?? null;
  const hayError = !!error && !tokenRechazado && !campania;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <CampaniaEstadoCard
          campania={campania}
          tipo={tipo}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onCambio={handleCambio}
        />
        <CampaniaConfigForm
          campania={campania}
          tipo={tipo}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onGuardado={handleCambio}
        />
      </div>

      <CampaniaVistaPrevia tipo={tipo} refresco={refresco} />
      <CampaniaHistorial tipo={tipo} />
      <CampaniaMetricas tipo={tipo} />
    </>
  );
}

// Una pestaña por campaña (C2). La elegida queda en la URL (?campania=…) para
// que un recargo o un link vuelvan a la misma; sin parámetro (o con uno que no
// existe) se abre "Ya te toca volver".
const PESTANIAS: { tipo: CampaniaTipo; label: string }[] = [
  { tipo: 'recencia', label: 'Ya te toca volver' },
  { tipo: 'post_servicio', label: 'Gracias por venir' },
];

const TIPOS_PESTANIAS = PESTANIAS.map((p) => p.tipo);

const PARAM_CAMPANIA = 'campania';

function tipoDeParam(valor: string | null): CampaniaTipo {
  return PESTANIAS.find((p) => p.tipo === valor)?.tipo ?? 'recencia';
}

function CampaniasContenido() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipo = tipoDeParam(searchParams.get(PARAM_CAMPANIA));

  const elegir = (nuevo: CampaniaTipo) => {
    if (nuevo === tipo) return;
    const params = new URLSearchParams(searchParams);
    if (nuevo === 'recencia') params.delete(PARAM_CAMPANIA);
    else params.set(PARAM_CAMPANIA, nuevo);
    setSearchParams(params, { replace: true });
  };

  const teclado = useNavegacionPestanias(TIPOS_PESTANIAS, tipo, elegir);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Campañas</h1>
        <p className="text-gray-600 mt-2">Mensajes automáticos de WhatsApp para que tus clientes vuelvan</p>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-6" role="tablist" aria-label="Campañas">
          {PESTANIAS.map((p) => {
            const activa = p.tipo === tipo;
            return (
              <button
                key={p.tipo}
                ref={teclado.registrar(p.tipo)}
                type="button"
                role="tab"
                id={`campania-tab-${p.tipo}`}
                aria-selected={activa}
                aria-controls={`campania-panel-${p.tipo}`}
                tabIndex={teclado.tabIndex(p.tipo)}
                onClick={() => elegir(p.tipo)}
                onKeyDown={(e) => teclado.onKeyDown(e, p.tipo)}
                className={`whitespace-nowrap py-2.5 px-1 border-b-2 font-medium text-base transition-colors ${
                  activa
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* `key`: al cambiar de pestaña se arranca de cero (filtros, página, guardado reciente) */}
      <div
        role="tabpanel"
        id={`campania-panel-${tipo}`}
        aria-labelledby={`campania-tab-${tipo}`}
        className="space-y-4"
      >
        <CampaniaPanel key={tipo} tipo={tipo} />
      </div>
    </div>
  );
}

function CampaniasPage() {
  return (
    <CampaniasGate>
      <CampaniasContenido />
    </CampaniasGate>
  );
}

export default CampaniasPage;
