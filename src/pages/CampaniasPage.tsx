import { useCallback, useEffect, useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { campaniasService } from '../services/campanias.service';
import { CampaniasGate, useBloqueoPorToken } from '../components/campanias/CampaniasGate';
import { CampaniaEstadoCard } from '../components/campanias/CampaniaEstadoCard';
import { CampaniaConfigForm } from '../components/campanias/CampaniaConfigForm';
import { CampaniaVistaPrevia } from '../components/campanias/CampaniaVistaPrevia';
import { CampaniaHistorial } from '../components/campanias/CampaniaHistorial';
import { CampaniaMetricas } from '../components/campanias/CampaniaMetricas';
import type { Campania } from '../types/campanias.types';

// Diseño: backend/docs/campanias-n8n-spec.md §4
// Solo super_admin + contraseña de la sección (mismo patrón que Gastos). Cada
// sección pide lo suyo y falla por separado: un error en el historial no tapa
// la tarjeta de encendido. La tarjeta y la configuración comparten un único
// pedido porque muestran el mismo recurso (GET /api/campanias/recencia).
function CampaniasContenido() {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.CAMPANIAS, 'recencia', 'config'),
    () => campaniasService.getCampania('recencia'),
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Campañas</h1>
        <p className="text-gray-600 mt-2">Mensajes automáticos de WhatsApp para que tus clientes vuelvan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <CampaniaEstadoCard
          campania={campania}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onCambio={handleCambio}
        />
        <CampaniaConfigForm
          campania={campania}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onGuardado={handleCambio}
        />
      </div>

      <CampaniaVistaPrevia refresco={refresco} />
      <CampaniaHistorial />
      <CampaniaMetricas />
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
